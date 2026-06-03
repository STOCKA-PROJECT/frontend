import type { StockaDatabase } from "../db/database";
import type { PieceTypeAttributeDoc } from "../db/schemas";
import { enqueueDelete, enqueueUpsert, newId, nowIso } from "../sync/outbox";

/**
 * Offline-first writes for type-level piece attributes. Like the org-level repository but the
 * attribute belongs to a piece type, referenced by {@code pieceTypeSyncId}.
 */

export interface PieceTypeAttributeInput {
  pieceTypeSyncId: string;
  name: string;
  displayName?: string | null;
  type: string;
  required?: boolean;
  position?: number;
  validatorsJson?: string | null;
}

function mutationDoc(doc: PieceTypeAttributeDoc): Record<string, unknown> {
  return {
    pieceTypeSyncId: doc.pieceTypeSyncId,
    name: doc.name,
    displayName: doc.displayName,
    type: doc.type,
    required: doc.required,
    position: doc.position,
    validatorsJson: doc.validatorsJson,
  };
}

export async function createPieceTypeAttribute(
  db: StockaDatabase,
  input: PieceTypeAttributeInput,
): Promise<PieceTypeAttributeDoc> {
  const syncId = newId();
  const doc: PieceTypeAttributeDoc = {
    syncId,
    rev: 0,
    pieceTypeSyncId: input.pieceTypeSyncId,
    name: input.name,
    displayName: input.displayName ?? input.name,
    type: input.type,
    required: input.required ?? true,
    position: input.position ?? 0,
    validatorsJson: input.validatorsJson ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
    _localDirty: true,
  };
  await db.pieceTypeAttributes.upsert(doc);
  await enqueueUpsert(db, "pieceTypeAttributes", syncId, null, mutationDoc(doc));
  return doc;
}

export async function updatePieceTypeAttribute(
  db: StockaDatabase,
  syncId: string,
  patch: Partial<Omit<PieceTypeAttributeInput, "pieceTypeSyncId">>,
): Promise<void> {
  const existing = await db.pieceTypeAttributes.findOne(syncId).exec();
  if (!existing) {
    throw new Error(`pieceTypeAttribute ${syncId} not found`);
  }
  const current = existing.toJSON() as PieceTypeAttributeDoc;
  const next: PieceTypeAttributeDoc = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
    _localDirty: true,
  };
  await db.pieceTypeAttributes.upsert(next);
  await enqueueUpsert(db, "pieceTypeAttributes", syncId, current.rev, mutationDoc(next));
}

export async function deletePieceTypeAttribute(db: StockaDatabase, syncId: string): Promise<void> {
  const existing = await db.pieceTypeAttributes.findOne(syncId).exec();
  if (!existing) {
    return;
  }
  const current = existing.toJSON() as PieceTypeAttributeDoc;
  await db.pieceTypeAttributes.upsert({ ...current, deletedAt: nowIso(), _localDirty: true });
  await enqueueDelete(db, "pieceTypeAttributes", syncId, current.rev);
}
