import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStockaDatabase, type StockaDatabase } from "../db/database";
import type { AttachmentSync } from "./types";
import {
  arrayBufferToBase64,
  base64ToBlob,
  pushAttachments,
  queueAttachmentDelete,
  queueAttachmentUpload,
  type AttachmentTransport,
} from "./attachments";

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

function serverMeta(syncId: string): AttachmentSync {
  return {
    syncId,
    rev: 7,
    pieceSyncId: "p1",
    kind: "DOCUMENT",
    originalFilename: "doc.pdf",
    mimeType: "application/pdf",
    sizeBytes: 3,
    r2Key: "orgs/1/pieces/1/doc.pdf",
    createdAt: null,
    deletedAt: null,
  };
}

describe("attachment binary queue", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    db = await createStockaDatabase(getRxStorageMemory(), "at" + Math.random().toString(36).slice(2));
  });

  afterEach(async () => {
    await db.remove();
  });

  it("round-trips base64 <-> blob bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3, 250]).buffer;
    const b64 = arrayBufferToBase64(bytes);
    const blob = base64ToBlob(b64, "application/octet-stream");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 250]));
  });

  it("queues an upload with optimistic metadata, then reconciles the server rev/key", async () => {
    const meta = await queueAttachmentUpload(db, {
      pieceSyncId: "p1",
      kind: "DOCUMENT",
      originalFilename: "doc.pdf",
      mimeType: "application/pdf",
      contentBase64: arrayBufferToBase64(new Uint8Array([1, 2, 3]).buffer),
      sizeBytes: 3,
    });
    expect((await db.attachments.findOne(meta.syncId).exec())?.toJSON().r2Key).toBeNull();

    const calls: string[] = [];
    const transport: AttachmentTransport = {
      async upload(input) {
        calls.push(input.attachmentSyncId);
        return serverMeta(input.attachmentSyncId);
      },
      async remove() {},
    };

    const outcome = await pushAttachments(db, transport);
    expect(outcome.uploaded).toBe(1);
    expect(outcome.pending).toBe(0);
    expect(calls).toEqual([meta.syncId]);
    const reconciled = (await db.attachments.findOne(meta.syncId).exec())?.toJSON();
    expect(reconciled?.rev).toBe(7);
    expect(reconciled?.r2Key).toBe("orgs/1/pieces/1/doc.pdf");
    expect(await db.attachmentQueue.find().exec()).toHaveLength(0);
  });

  it("dead-letters a permanent (4xx) failure but keeps a transient (5xx) one pending", async () => {
    await queueAttachmentUpload(db, {
      pieceSyncId: "p1", kind: "DOCUMENT", originalFilename: "a.pdf",
      mimeType: "application/pdf", contentBase64: "AAA=", sizeBytes: 1,
    });
    const fail4xx: AttachmentTransport = {
      async upload() { throw new HttpError(400); },
      async remove() {},
    };
    let r = await pushAttachments(db, fail4xx);
    expect(r.failed).toBe(1);
    expect((await db.attachmentQueue.find({ selector: { status: "failed" } }).exec())).toHaveLength(1);

    await queueAttachmentUpload(db, {
      pieceSyncId: "p1", kind: "DOCUMENT", originalFilename: "b.pdf",
      mimeType: "application/pdf", contentBase64: "AAA=", sizeBytes: 1,
    });
    const fail5xx: AttachmentTransport = {
      async upload() { throw new HttpError(503); },
      async remove() {},
    };
    r = await pushAttachments(db, fail5xx);
    expect(r.pending).toBe(1); // the 5xx one stays pending for retry
  });

  it("drops a still-queued upload when the same attachment is deleted before it syncs", async () => {
    const meta = await queueAttachmentUpload(db, {
      pieceSyncId: "p1", kind: "DOCUMENT", originalFilename: "a.pdf",
      mimeType: "application/pdf", contentBase64: "AAA=", sizeBytes: 1,
    });
    await queueAttachmentDelete(db, meta.syncId);
    // No upload and no delete should remain — the queued upload is simply removed.
    expect(await db.attachmentQueue.find().exec()).toHaveLength(0);
    expect((await db.attachments.findOne(meta.syncId).exec())?.toJSON().deletedAt).not.toBeNull();
  });

  it("queues a server delete for an already-uploaded attachment", async () => {
    // Simulate a synced attachment (no pending upload in the queue).
    await db.attachments.upsert({
      syncId: "x1", rev: 5, pieceSyncId: "p1", kind: "DOCUMENT", originalFilename: "a.pdf",
      mimeType: "application/pdf", sizeBytes: 1, r2Key: "k", createdAt: null, deletedAt: null,
    });
    await queueAttachmentDelete(db, "x1");
    const removed: string[] = [];
    const transport: AttachmentTransport = {
      async upload() { throw new Error("unexpected"); },
      async remove(id) { removed.push(id); },
    };
    const outcome = await pushAttachments(db, transport);
    expect(outcome.deleted).toBe(1);
    expect(removed).toEqual(["x1"]);
  });
});
