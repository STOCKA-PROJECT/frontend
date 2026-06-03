import type { StockaDatabase } from "../db/database";
import type { LocationDoc } from "../db/schemas";
import { enqueueDelete, enqueueUpsert, newId, nowIso } from "../sync/outbox";

/**
 * Offline-first writes for locations: every mutation updates the local RxDB store immediately
 * (so the UI is instant) and enqueues a mutation in the outbox for the next push. The store's
 * public shape is unchanged from the caller's perspective; only the data source moved offline.
 */

export interface CreateLocationInput {
  name: string;
  description?: string | null;
  parentSyncId?: string | null;
}

export interface UpdateLocationPatch {
  name?: string;
  description?: string | null;
  parentSyncId?: string | null;
}

/**
 * Creates a location locally with a fresh {@code syncId} and queues an upsert.
 *
 * @param db    local database
 * @param input the new location's fields
 * @returns the created local document
 */
export async function createLocation(
  db: StockaDatabase,
  input: CreateLocationInput,
): Promise<LocationDoc> {
  const syncId = newId();
  const doc: LocationDoc = {
    syncId,
    rev: 0,
    name: input.name,
    description: input.description ?? null,
    parentSyncId: input.parentSyncId ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
    _localDirty: true,
  };
  await db.locations.upsert(doc);
  await enqueueUpsert(db, "locations", syncId, null, {
    name: doc.name,
    description: doc.description,
    parentSyncId: doc.parentSyncId,
  });
  return doc;
}

/**
 * Applies a partial update locally and queues an upsert based on the current rev.
 *
 * @param db     local database
 * @param syncId location identity
 * @param patch  fields to change
 */
export async function updateLocation(
  db: StockaDatabase,
  syncId: string,
  patch: UpdateLocationPatch,
): Promise<void> {
  const existing = await db.locations.findOne(syncId).exec();
  if (!existing) {
    throw new Error(`location ${syncId} not found`);
  }
  const current = existing.toJSON() as LocationDoc;
  const next: LocationDoc = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
    _localDirty: true,
  };
  await db.locations.upsert(next);
  await enqueueUpsert(db, "locations", syncId, current.rev, {
    name: next.name,
    description: next.description,
    parentSyncId: next.parentSyncId,
  });
}

/**
 * Soft-deletes a location locally (sets {@code deletedAt}) and queues a delete.
 *
 * @param db     local database
 * @param syncId location identity
 */
export async function deleteLocation(db: StockaDatabase, syncId: string): Promise<void> {
  const existing = await db.locations.findOne(syncId).exec();
  if (!existing) {
    return;
  }
  const current = existing.toJSON() as LocationDoc;
  await db.locations.upsert({ ...current, deletedAt: nowIso(), _localDirty: true });
  await enqueueDelete(db, "locations", syncId, current.rev);
}
