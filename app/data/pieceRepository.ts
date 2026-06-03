import type { StockaDatabase } from "../db/database";
import type { PieceDoc } from "../db/schemas";
import { enqueueDelete, enqueueUpsert, newId, nowIso } from "../sync/outbox";
import type { AttributeValueSync } from "../sync/types";

/**
 * Offline-first writes for pieces (the aggregate). Each mutation writes the local RxDB document
 * immediately (instant UI) and enqueues a mutation carrying the editable fields and references by
 * {@code syncId}, matching the backend push contract. The server recomputes {@code status} and
 * returns the canonical aggregate (incl. attribute values), which the outbox reconciles back.
 */

export interface CreatePieceInput {
  name: string;
  serialNumber?: string | null;
  description?: string | null;
  pieceTypeSyncIds: string[];
  locationSyncId?: string | null;
  ownerUserId?: number | null;
  typeAttributeValues?: AttributeValueSync[];
  orgAttributeValues?: AttributeValueSync[];
}

export type UpdatePiecePatch = Partial<CreatePieceInput>;

/** Builds the mutation payload (editable fields + refs by syncId) sent to the backend. */
function mutationDoc(doc: PieceDoc): Record<string, unknown> {
  return {
    name: doc.name,
    serialNumber: doc.serialNumber,
    description: doc.description,
    pieceTypeSyncIds: doc.pieceTypeSyncIds,
    locationSyncId: doc.locationSyncId,
    ownerUserId: doc.ownerUserId,
    typeAttributeValues: doc.typeAttributeValues,
    orgAttributeValues: doc.orgAttributeValues,
  };
}

export async function createPiece(db: StockaDatabase, input: CreatePieceInput): Promise<PieceDoc> {
  const syncId = newId();
  const doc: PieceDoc = {
    syncId,
    rev: 0,
    name: input.name,
    serialNumber: input.serialNumber ?? null,
    description: input.description ?? null,
    // Optimistic local status; the server recomputes it and the reconcile corrects it.
    status: "PENDING",
    ownerUserId: input.ownerUserId ?? null,
    locationSyncId: input.locationSyncId ?? null,
    coverAttachmentSyncId: null,
    pieceTypeSyncIds: input.pieceTypeSyncIds,
    typeAttributeValues: input.typeAttributeValues ?? [],
    orgAttributeValues: input.orgAttributeValues ?? [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
    _localDirty: true,
  };
  await db.pieces.upsert(doc);
  await enqueueUpsert(db, "pieces", syncId, null, mutationDoc(doc));
  return doc;
}

export async function updatePiece(
  db: StockaDatabase,
  syncId: string,
  patch: UpdatePiecePatch,
): Promise<void> {
  const existing = await db.pieces.findOne(syncId).exec();
  if (!existing) {
    throw new Error(`piece ${syncId} not found`);
  }
  const current = existing.toJSON() as PieceDoc;
  const next: PieceDoc = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
    _localDirty: true,
  };
  await db.pieces.upsert(next);
  await enqueueUpsert(db, "pieces", syncId, current.rev, mutationDoc(next));
}

export async function deletePiece(db: StockaDatabase, syncId: string): Promise<void> {
  const existing = await db.pieces.findOne(syncId).exec();
  if (!existing) {
    return;
  }
  const current = existing.toJSON() as PieceDoc;
  await db.pieces.upsert({ ...current, deletedAt: nowIso(), _localDirty: true });
  await enqueueDelete(db, "pieces", syncId, current.rev);
}
