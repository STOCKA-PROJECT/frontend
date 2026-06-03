import type { StockaDatabase } from "../db/database";
import type { PieceTypeDoc } from "../db/schemas";
import { enqueueDelete, enqueueUpsert, newId, nowIso } from "../sync/outbox";

/**
 * Offline-first writes for piece types: write the local RxDB store immediately and enqueue a
 * mutation for the next push. Mirrors {@code locationRepository}.
 */

export interface CreatePieceTypeInput {
  name: string;
}

export async function createPieceType(
  db: StockaDatabase,
  input: CreatePieceTypeInput,
): Promise<PieceTypeDoc> {
  const syncId = newId();
  const doc: PieceTypeDoc = {
    syncId,
    rev: 0,
    name: input.name,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
    _localDirty: true,
  };
  await db.pieceTypes.upsert(doc);
  await enqueueUpsert(db, "pieceTypes", syncId, null, { name: doc.name });
  return doc;
}

export async function renamePieceType(
  db: StockaDatabase,
  syncId: string,
  name: string,
): Promise<void> {
  const existing = await db.pieceTypes.findOne(syncId).exec();
  if (!existing) {
    throw new Error(`pieceType ${syncId} not found`);
  }
  const current = existing.toJSON() as PieceTypeDoc;
  await db.pieceTypes.upsert({ ...current, name, updatedAt: nowIso(), _localDirty: true });
  await enqueueUpsert(db, "pieceTypes", syncId, current.rev, { name });
}

export async function deletePieceType(db: StockaDatabase, syncId: string): Promise<void> {
  const existing = await db.pieceTypes.findOne(syncId).exec();
  if (!existing) {
    return;
  }
  const current = existing.toJSON() as PieceTypeDoc;
  await db.pieceTypes.upsert({ ...current, deletedAt: nowIso(), _localDirty: true });
  await enqueueDelete(db, "pieceTypes", syncId, current.rev);
}
