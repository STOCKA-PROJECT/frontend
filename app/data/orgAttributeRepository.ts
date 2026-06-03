import type { StockaDatabase } from "../db/database";
import type { OrgAttributeDoc } from "../db/schemas";
import { enqueueDelete, enqueueUpsert, newId, nowIso } from "../sync/outbox";

/**
 * Offline-first writes for organization-level piece attributes. Mirrors the other repositories:
 * write RxDB immediately and enqueue a mutation matching the backend push contract.
 */

export interface OrgAttributeInput {
  name: string;
  displayName?: string | null;
  type: string;
  required?: boolean;
  position?: number;
  validatorsJson?: string | null;
}

function mutationDoc(doc: OrgAttributeDoc): Record<string, unknown> {
  return {
    name: doc.name,
    displayName: doc.displayName,
    type: doc.type,
    required: doc.required,
    position: doc.position,
    validatorsJson: doc.validatorsJson,
  };
}

export async function createOrgAttribute(
  db: StockaDatabase,
  input: OrgAttributeInput,
): Promise<OrgAttributeDoc> {
  const syncId = newId();
  const doc: OrgAttributeDoc = {
    syncId,
    rev: 0,
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
  await db.orgAttributes.upsert(doc);
  await enqueueUpsert(db, "orgAttributes", syncId, null, mutationDoc(doc));
  return doc;
}

export async function updateOrgAttribute(
  db: StockaDatabase,
  syncId: string,
  patch: Partial<OrgAttributeInput>,
): Promise<void> {
  const existing = await db.orgAttributes.findOne(syncId).exec();
  if (!existing) {
    throw new Error(`orgAttribute ${syncId} not found`);
  }
  const current = existing.toJSON() as OrgAttributeDoc;
  const next: OrgAttributeDoc = { ...current, ...patch, updatedAt: nowIso(), _localDirty: true };
  await db.orgAttributes.upsert(next);
  await enqueueUpsert(db, "orgAttributes", syncId, current.rev, mutationDoc(next));
}

export async function deleteOrgAttribute(db: StockaDatabase, syncId: string): Promise<void> {
  const existing = await db.orgAttributes.findOne(syncId).exec();
  if (!existing) {
    return;
  }
  const current = existing.toJSON() as OrgAttributeDoc;
  await db.orgAttributes.upsert({ ...current, deletedAt: nowIso(), _localDirty: true });
  await enqueueDelete(db, "orgAttributes", syncId, current.rev);
}
