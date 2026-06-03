import type { RxJsonSchema } from "rxdb";

import type {
  AttachmentSync,
  LocationSync,
  OrgAttributeSync,
  PieceSync,
  PieceTypeAttributeSync,
  PieceTypeSync,
} from "../sync/types";

/**
 * RxDB schemas for the offline store. Each document is keyed by its `syncId` (the client-stable
 * identity), carries the server `rev` (pull cursor) and keeps `deletedAt` as a tombstone marker so
 * queries can filter it out without losing the record. `_localDirty` flags rows with unsynced
 * local edits (driven by the outbox, used in the write path).
 */

const SYNC_ID = { type: "string", maxLength: 36 } as const;

/** Local-only bookkeeping fields present on every collection. */
type LocalMeta = { _localDirty?: boolean };

export type LocationDoc = LocationSync & LocalMeta;
export type PieceDoc = PieceSync & LocalMeta;
export type PieceTypeDoc = PieceTypeSync & LocalMeta;
export type PieceTypeAttributeDoc = PieceTypeAttributeSync & LocalMeta;
export type OrgAttributeDoc = OrgAttributeSync & LocalMeta;
export type AttachmentDoc = AttachmentSync & LocalMeta;

export const locationSchema: RxJsonSchema<LocationDoc> = {
  version: 0,
  primaryKey: "syncId",
  type: "object",
  properties: {
    syncId: SYNC_ID,
    rev: { type: "number" },
    name: { type: "string" },
    description: { type: ["string", "null"] },
    parentSyncId: { type: ["string", "null"], maxLength: 36 },
    createdAt: { type: ["string", "null"] },
    updatedAt: { type: ["string", "null"] },
    deletedAt: { type: ["string", "null"] },
    _localDirty: { type: "boolean" },
  },
  required: ["syncId", "rev", "name"],
};

export const pieceSchema: RxJsonSchema<PieceDoc> = {
  version: 0,
  primaryKey: "syncId",
  type: "object",
  properties: {
    syncId: SYNC_ID,
    rev: { type: "number" },
    name: { type: "string" },
    serialNumber: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    status: { type: "string" },
    ownerUserId: { type: ["number", "null"] },
    locationSyncId: { type: ["string", "null"], maxLength: 36 },
    coverAttachmentSyncId: { type: ["string", "null"], maxLength: 36 },
    pieceTypeSyncIds: { type: "array", items: { type: "string" } },
    typeAttributeValues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          attributeSyncId: { type: "string" },
          value: { type: ["string", "null"] },
        },
      },
    },
    orgAttributeValues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          attributeSyncId: { type: "string" },
          value: { type: ["string", "null"] },
        },
      },
    },
    createdAt: { type: ["string", "null"] },
    updatedAt: { type: ["string", "null"] },
    deletedAt: { type: ["string", "null"] },
    _localDirty: { type: "boolean" },
  },
  required: ["syncId", "rev", "name", "status"],
};

export const pieceTypeSchema: RxJsonSchema<PieceTypeDoc> = {
  version: 0,
  primaryKey: "syncId",
  type: "object",
  properties: {
    syncId: SYNC_ID,
    rev: { type: "number" },
    name: { type: "string" },
    createdAt: { type: ["string", "null"] },
    updatedAt: { type: ["string", "null"] },
    deletedAt: { type: ["string", "null"] },
    _localDirty: { type: "boolean" },
  },
  required: ["syncId", "rev", "name"],
};

const attributeProps = {
  syncId: SYNC_ID,
  rev: { type: "number" },
  name: { type: "string" },
  displayName: { type: "string" },
  type: { type: "string" },
  required: { type: "boolean" },
  position: { type: "number" },
  validatorsJson: { type: ["string", "null"] },
  createdAt: { type: ["string", "null"] },
  updatedAt: { type: ["string", "null"] },
  deletedAt: { type: ["string", "null"] },
  _localDirty: { type: "boolean" },
} as const;

export const pieceTypeAttributeSchema: RxJsonSchema<PieceTypeAttributeDoc> = {
  version: 0,
  primaryKey: "syncId",
  type: "object",
  properties: {
    ...attributeProps,
    pieceTypeSyncId: { type: "string", maxLength: 36 },
  },
  required: ["syncId", "rev", "pieceTypeSyncId", "name"],
};

export const orgAttributeSchema: RxJsonSchema<OrgAttributeDoc> = {
  version: 0,
  primaryKey: "syncId",
  type: "object",
  properties: { ...attributeProps },
  required: ["syncId", "rev", "name"],
};

/**
 * A queued local mutation awaiting push. Local-only (never synced). `status` is {@code pending}
 * until acknowledged; rejected mutations become {@code failed} (a dead-letter the UI surfaces,
 * DECISIONS-AND-RISKS R8).
 */
export interface OutboxDoc {
  mutationId: string;
  targetCollection: string;
  op: "upsert" | "delete";
  syncId: string;
  baseRev: number | null;
  doc: Record<string, unknown> | null;
  createdAt: string;
  attempts: number;
  status: "pending" | "failed";
  errorCode: string | null;
}

export const outboxSchema: RxJsonSchema<OutboxDoc> = {
  version: 0,
  primaryKey: "mutationId",
  type: "object",
  properties: {
    mutationId: SYNC_ID,
    targetCollection: { type: "string" },
    op: { type: "string" },
    syncId: { type: "string", maxLength: 36 },
    baseRev: { type: ["number", "null"] },
    doc: { type: ["object", "null"] },
    createdAt: { type: "string", maxLength: 30 },
    attempts: { type: "number" },
    status: { type: "string", maxLength: 10 },
    errorCode: { type: ["string", "null"] },
  },
  required: ["mutationId", "targetCollection", "op", "syncId", "createdAt", "status"],
  indexes: ["createdAt"],
};

export const attachmentSchema: RxJsonSchema<AttachmentDoc> = {
  version: 0,
  primaryKey: "syncId",
  type: "object",
  properties: {
    syncId: SYNC_ID,
    rev: { type: "number" },
    pieceSyncId: { type: "string", maxLength: 36 },
    kind: { type: "string" },
    originalFilename: { type: "string" },
    mimeType: { type: "string" },
    sizeBytes: { type: "number" },
    r2Key: { type: ["string", "null"] },
    createdAt: { type: ["string", "null"] },
    deletedAt: { type: ["string", "null"] },
    _localDirty: { type: "boolean" },
  },
  required: ["syncId", "rev", "pieceSyncId"],
};
