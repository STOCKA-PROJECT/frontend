import type { StockaDatabase } from "../db/database";
import type { SyncCollection } from "./types";

/** Generates a client-stable UUID (Web Crypto, available in the WebView and in Node). */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}

/** Current time as an ISO-8601 string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Enqueues an {@code upsert} mutation for later push.
 *
 * @param db         local database
 * @param collection target collection
 * @param syncId     document identity
 * @param baseRev    rev the edit was based on ({@code null} for a fresh create)
 * @param doc        the document payload to send
 */
export async function enqueueUpsert(
  db: StockaDatabase,
  collection: SyncCollection,
  syncId: string,
  baseRev: number | null,
  doc: Record<string, unknown>,
): Promise<void> {
  await db.outbox.insert({
    mutationId: newId(),
    targetCollection: collection,
    op: "upsert",
    syncId,
    baseRev,
    doc,
    createdAt: nowIso(),
    attempts: 0,
    status: "pending",
    errorCode: null,
  });
}

/**
 * Enqueues a {@code delete} mutation for later push.
 *
 * @param db         local database
 * @param collection target collection
 * @param syncId     document identity
 * @param baseRev    rev the delete was based on
 */
export async function enqueueDelete(
  db: StockaDatabase,
  collection: SyncCollection,
  syncId: string,
  baseRev: number | null,
): Promise<void> {
  await db.outbox.insert({
    mutationId: newId(),
    targetCollection: collection,
    op: "delete",
    syncId,
    baseRev,
    doc: null,
    createdAt: nowIso(),
    attempts: 0,
    status: "pending",
    errorCode: null,
  });
}
