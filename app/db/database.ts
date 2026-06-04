import {
  createRxDatabase,
  type RxCollection,
  type RxDatabase,
  type RxJsonSchema,
  type RxStorage,
} from "rxdb";

import {
  attachmentQueueSchema,
  attachmentSchema,
  locationSchema,
  orgAttributeSchema,
  outboxSchema,
  pieceSchema,
  pieceTypeAttributeSchema,
  pieceTypeSchema,
  syncStateSchema,
  type AttachmentDoc,
  type AttachmentQueueDoc,
  type LocationDoc,
  type OrgAttributeDoc,
  type OutboxDoc,
  type PieceDoc,
  type PieceTypeAttributeDoc,
  type PieceTypeDoc,
  type SyncStateDoc,
} from "./schemas";

/** The typed collection map of the Stocka offline database. */
export type StockaCollections = {
  pieceTypes: RxCollection<PieceTypeDoc>;
  pieceTypeAttributes: RxCollection<PieceTypeAttributeDoc>;
  locations: RxCollection<LocationDoc>;
  orgAttributes: RxCollection<OrgAttributeDoc>;
  pieces: RxCollection<PieceDoc>;
  attachments: RxCollection<AttachmentDoc>;
  attachmentQueue: RxCollection<AttachmentQueueDoc>;
  outbox: RxCollection<OutboxDoc>;
  syncState: RxCollection<SyncStateDoc>;
};

export type StockaDatabase = RxDatabase<StockaCollections>;

/**
 * Per-collection list of fields to encrypt at rest (R29). Only fields that are never used as a
 * query selector, index or sort key may be encrypted — everything here is read after RxDB has
 * decrypted the document (e.g. names are filtered/sorted client-side, never via a Mango query), and
 * the binary payloads (`contentBase64`, outbox `doc`) carry the most sensitive data. The encryption
 * is applied only when a password is supplied (desktop); tests/web open the plain schemas.
 */
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  pieceTypes: ["name"],
  pieceTypeAttributes: ["name", "displayName", "validatorsJson"],
  locations: ["name", "description"],
  orgAttributes: ["name", "displayName", "validatorsJson"],
  pieces: ["name", "serialNumber", "description"],
  attachments: ["originalFilename"],
  attachmentQueue: ["contentBase64", "originalFilename"],
  outbox: ["doc"],
};

/** Returns the schema unchanged, or a clone declaring its encrypted fields when {@code encrypt}. */
function schemaFor<T>(name: string, schema: RxJsonSchema<T>, encrypt: boolean): RxJsonSchema<T> {
  const fields = ENCRYPTED_FIELDS[name];
  if (!encrypt || !fields || fields.length === 0) {
    return schema;
  }
  return { ...schema, encrypted: fields };
}

/**
 * Creates the Stocka offline database and registers all syncable collections.
 *
 * The storage is injected so the desktop app can use Dexie/IndexedDB while tests use the in-memory
 * storage. The database is namespaced per signed-in user (caller passes a unique `name`) so a
 * shared device never leaks one account's organization data into another (DECISIONS-AND-RISKS R28).
 *
 * <p>When {@code password} is supplied (desktop, with an encryption-wrapped storage), the sensitive
 * fields in {@link ENCRYPTED_FIELDS} are encrypted at rest (R29). Tests and the web fallback pass no
 * password and open the plain schemas.
 *
 * @param storage  RxDB storage engine (e.g. Dexie in the app, memory in tests; wrap it with the
 *                 encryption plugin when passing a password)
 * @param name     database name (namespace it per user account)
 * @param password optional encryption password; enables field-level encryption at rest
 * @returns the ready database with all collections added
 */
export async function createStockaDatabase(
  storage: RxStorage<unknown, unknown>,
  name = "stocka",
  password?: string,
): Promise<StockaDatabase> {
  const encrypt = !!password;
  const db = await createRxDatabase<StockaCollections>({
    name,
    storage,
    eventReduce: true,
    ...(password ? { password } : {}),
  });

  await db.addCollections({
    pieceTypes: { schema: schemaFor("pieceTypes", pieceTypeSchema, encrypt) },
    pieceTypeAttributes: { schema: schemaFor("pieceTypeAttributes", pieceTypeAttributeSchema, encrypt) },
    locations: { schema: schemaFor("locations", locationSchema, encrypt) },
    orgAttributes: { schema: schemaFor("orgAttributes", orgAttributeSchema, encrypt) },
    pieces: { schema: schemaFor("pieces", pieceSchema, encrypt) },
    attachments: { schema: schemaFor("attachments", attachmentSchema, encrypt) },
    attachmentQueue: { schema: schemaFor("attachmentQueue", attachmentQueueSchema, encrypt) },
    outbox: { schema: schemaFor("outbox", outboxSchema, encrypt) },
    syncState: { schema: syncStateSchema },
  });

  return db;
}
