import {
  createRxDatabase,
  type RxCollection,
  type RxDatabase,
  type RxStorage,
} from "rxdb";

import {
  attachmentSchema,
  locationSchema,
  orgAttributeSchema,
  pieceSchema,
  pieceTypeAttributeSchema,
  pieceTypeSchema,
  type AttachmentDoc,
  type LocationDoc,
  type OrgAttributeDoc,
  type PieceDoc,
  type PieceTypeAttributeDoc,
  type PieceTypeDoc,
} from "./schemas";

/** The typed collection map of the Stocka offline database. */
export type StockaCollections = {
  pieceTypes: RxCollection<PieceTypeDoc>;
  pieceTypeAttributes: RxCollection<PieceTypeAttributeDoc>;
  locations: RxCollection<LocationDoc>;
  orgAttributes: RxCollection<OrgAttributeDoc>;
  pieces: RxCollection<PieceDoc>;
  attachments: RxCollection<AttachmentDoc>;
};

export type StockaDatabase = RxDatabase<StockaCollections>;

/**
 * Creates the Stocka offline database and registers all syncable collections.
 *
 * The storage is injected so the desktop app can use Dexie/IndexedDB while tests use the in-memory
 * storage. The database is namespaced per signed-in user (caller passes a unique `name`) so a
 * shared device never leaks one account's organization data into another (DECISIONS-AND-RISKS R28).
 *
 * @param storage RxDB storage engine (e.g. Dexie in the app, memory in tests)
 * @param name database name (namespace it per user account)
 * @returns the ready database with all collections added
 */
export async function createStockaDatabase(
  storage: RxStorage<unknown, unknown>,
  name = "stocka",
): Promise<StockaDatabase> {
  const db = await createRxDatabase<StockaCollections>({
    name,
    storage,
    eventReduce: true,
  });

  await db.addCollections({
    pieceTypes: { schema: pieceTypeSchema },
    pieceTypeAttributes: { schema: pieceTypeAttributeSchema },
    locations: { schema: locationSchema },
    orgAttributes: { schema: orgAttributeSchema },
    pieces: { schema: pieceSchema },
    attachments: { schema: attachmentSchema },
  });

  return db;
}
