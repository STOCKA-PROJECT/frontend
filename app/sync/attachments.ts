import type { StockaDatabase } from "../db/database";
import type { AttachmentDoc, AttachmentQueueDoc } from "../db/schemas";
import { newId, nowIso } from "./outbox";
import type { AttachmentSync } from "./types";

/**
 * Offline attachment binary queue (DECISIONS-AND-RISKS R15–R17). Binaries ride a queue separate
 * from the data outbox so a large file never blocks data convergence: data mutations sync first,
 * then attachments are uploaded best-effort. Each operation is idempotent on the server by the
 * client-assigned attachment {@code syncId}.
 */

/** Transport for attachment binaries (mirrors the backend `/sync/v1/attachments` endpoints). */
export interface AttachmentTransport {
  /** Uploads a binary; returns the canonical server metadata. */
  upload(input: {
    pieceSyncId: string;
    attachmentSyncId: string;
    kind: string;
    originalFilename: string;
    mimeType: string;
    contentBase64: string;
  }): Promise<AttachmentSync>;
  /** Soft-deletes an attachment by its syncId. */
  remove(attachmentSyncId: string): Promise<void>;
}

/** Tally of one attachment-push pass. */
export interface AttachmentPushOutcome {
  uploaded: number;
  deleted: number;
  failed: number;
  pending: number;
}

/** HTTP-ish error carrying a status, so the queue can tell 4xx (drop) from 5xx/network (retry). */
interface StatusError {
  status?: number;
}

function statusOf(error: unknown): number | undefined {
  return (error as StatusError | null)?.status;
}

/** A 4xx (except 429) is a permanent rejection; everything else is worth retrying. */
function isPermanent(error: unknown): boolean {
  const status = statusOf(error);
  return status !== undefined && status >= 400 && status < 500 && status !== 429;
}

/** Decodes a base64 string to a Blob with the given MIME type (WebView + Node compatible). */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/** Encodes an ArrayBuffer to base64 (for queuing a picked file's bytes). */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Queues a binary upload and writes optimistic local metadata so the UI shows it immediately. */
export async function queueAttachmentUpload(
  db: StockaDatabase,
  input: {
    pieceSyncId: string;
    kind: string;
    originalFilename: string;
    mimeType: string;
    contentBase64: string;
    sizeBytes: number;
  },
): Promise<AttachmentDoc> {
  const attachmentSyncId = newId();
  const meta: AttachmentDoc = {
    syncId: attachmentSyncId,
    rev: 0,
    pieceSyncId: input.pieceSyncId,
    kind: input.kind,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    r2Key: null,
    createdAt: nowIso(),
    deletedAt: null,
    _localDirty: true,
  };
  await db.attachments.upsert(meta);
  await db.attachmentQueue.insert({
    queueId: newId(),
    op: "upload",
    attachmentSyncId,
    pieceSyncId: input.pieceSyncId,
    kind: input.kind,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    contentBase64: input.contentBase64,
    createdAt: nowIso(),
    attempts: 0,
    status: "pending",
    errorCode: null,
  });
  return meta;
}

/** Tombstones local attachment metadata and queues a server delete. */
export async function queueAttachmentDelete(db: StockaDatabase, attachmentSyncId: string): Promise<void> {
  const existing = await db.attachments.findOne(attachmentSyncId).exec();
  if (existing) {
    const current = existing.toJSON() as AttachmentDoc;
    await db.attachments.upsert({ ...current, deletedAt: nowIso(), _localDirty: true });
  }
  // If the upload is still queued (never reached the server), just drop it — nothing to delete.
  const pendingUpload = await db.attachmentQueue
    .findOne({ selector: { attachmentSyncId, op: "upload" } })
    .exec();
  if (pendingUpload) {
    await pendingUpload.remove();
    return;
  }
  await db.attachmentQueue.insert({
    queueId: newId(),
    op: "delete",
    attachmentSyncId,
    pieceSyncId: existing ? (existing.toJSON() as AttachmentDoc).pieceSyncId : "",
    kind: "",
    originalFilename: "",
    mimeType: "",
    sizeBytes: 0,
    contentBase64: null,
    createdAt: nowIso(),
    attempts: 0,
    status: "pending",
    errorCode: null,
  });
}

/**
 * Drains the attachment queue best-effort. Successful uploads reconcile local metadata with the
 * server's canonical document; permanent (4xx) failures are dead-lettered ({@code status: failed},
 * R8); transient ones are left pending for the next pass. Never throws — attachment failures must
 * not abort the data sync.
 *
 * @param db        the local database
 * @param transport the attachment transport
 * @returns a tally of the pass
 */
export async function pushAttachments(
  db: StockaDatabase,
  transport: AttachmentTransport,
): Promise<AttachmentPushOutcome> {
  const pending = await db.attachmentQueue
    .find({ selector: { status: "pending" }, sort: [{ createdAt: "asc" }] })
    .exec();
  let uploaded = 0;
  let deleted = 0;
  let failed = 0;

  for (const doc of pending) {
    const item = doc.toJSON() as AttachmentQueueDoc;
    try {
      if (item.op === "upload") {
        const server = await transport.upload({
          pieceSyncId: item.pieceSyncId,
          attachmentSyncId: item.attachmentSyncId,
          kind: item.kind,
          originalFilename: item.originalFilename,
          mimeType: item.mimeType,
          contentBase64: item.contentBase64 ?? "",
        });
        const local = await db.attachments.findOne(item.attachmentSyncId).exec();
        if (local) {
          await db.attachments.upsert({
            ...(local.toJSON() as AttachmentDoc),
            rev: server.rev,
            r2Key: server.r2Key,
            _localDirty: false,
          });
        }
        uploaded++;
      } else {
        await transport.remove(item.attachmentSyncId);
        deleted++;
      }
      await doc.remove();
    } catch (error) {
      if (isPermanent(error)) {
        await doc.patch({ status: "failed", attempts: item.attempts + 1, errorCode: String(statusOf(error) ?? "4xx") });
        failed++;
      } else {
        await doc.patch({ attempts: item.attempts + 1 });
        // Leave pending for a backed-off retry.
      }
    }
  }

  const stillPending = await db.attachmentQueue.find({ selector: { status: "pending" } }).exec();
  return { uploaded, deleted, failed, pending: stillPending.length };
}
