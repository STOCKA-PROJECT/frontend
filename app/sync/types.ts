/**
 * Wire types for the offline sync feed. These mirror the backend DTOs
 * (`com.stocka.backend.modules.sync.dto.*`) exactly, so the desktop client and the server share a
 * single contract. Timestamps are ISO-8601 strings (Jackson serialization of `LocalDateTime`).
 */

/** Embedded attribute value of a piece (attribute referenced by syncId). */
export interface AttributeValueSync {
  attributeSyncId: string;
  value: string | null;
}

/** A location document (tree node) in the sync feed. */
export interface LocationSync {
  syncId: string;
  rev: number;
  name: string;
  description: string | null;
  parentSyncId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

/** A piece aggregate document in the sync feed. */
export interface PieceSync {
  syncId: string;
  rev: number;
  name: string;
  serialNumber: string | null;
  description: string | null;
  status: string;
  ownerUserId: number | null;
  locationSyncId: string | null;
  coverAttachmentSyncId: string | null;
  pieceTypeSyncIds: string[];
  typeAttributeValues: AttributeValueSync[];
  orgAttributeValues: AttributeValueSync[];
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

/** A piece type document. */
export interface PieceTypeSync {
  syncId: string;
  rev: number;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

/** A type-level attribute definition document. */
export interface PieceTypeAttributeSync {
  syncId: string;
  rev: number;
  pieceTypeSyncId: string;
  name: string;
  displayName: string;
  type: string;
  required: boolean;
  position: number;
  validatorsJson: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

/** An organization-level attribute definition document. */
export interface OrgAttributeSync {
  syncId: string;
  rev: number;
  name: string;
  displayName: string;
  type: string;
  required: boolean;
  position: number;
  validatorsJson: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

/** Attachment metadata document (binary lives in R2, fetched on demand). */
export interface AttachmentSync {
  syncId: string;
  rev: number;
  pieceSyncId: string;
  kind: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  r2Key: string | null;
  createdAt: string | null;
  deletedAt: string | null;
}

/** Per-collection change lists returned by the pull endpoint. */
export interface SyncChanges {
  pieceTypes: PieceTypeSync[];
  pieceTypeAttributes: PieceTypeAttributeSync[];
  locations: LocationSync[];
  orgAttributes: OrgAttributeSync[];
  pieces: PieceSync[];
  attachments: AttachmentSync[];
}

/** Response of `GET /organizations/{slug}/sync/v1/changes`. */
export interface SyncChangesResponse {
  changes: SyncChanges;
  checkpoint: Record<string, number>;
  hasMore: boolean;
  minClientVersion: number;
}

/** The collection names, in the dependency order clients must apply them. */
export const SYNC_COLLECTIONS = [
  "pieceTypes",
  "pieceTypeAttributes",
  "locations",
  "orgAttributes",
  "pieces",
  "attachments",
] as const;

export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];
