import type { StockaDatabase } from "../db/database";
import type { SyncChanges } from "./types";

/**
 * Applies a page of pulled changes to the local database, in the dependency order clients must
 * follow (types -> type attributes -> locations -> org attributes -> pieces -> attachments) so a
 * document never lands before something it references.
 *
 * Documents are upserted as-is, tombstones included (a tombstone carries a non-null `deletedAt`);
 * UI queries filter `deletedAt === null`. Keeping tombstones lets a later pull observe an
 * un-delete and keeps the pull cursor monotonic.
 *
 * @param db      the local database
 * @param changes the per-collection change lists from one pull page
 */
export async function applyChanges(db: StockaDatabase, changes: SyncChanges): Promise<void> {
  if (changes.pieceTypes?.length) {
    await db.pieceTypes.bulkUpsert(changes.pieceTypes);
  }
  if (changes.pieceTypeAttributes?.length) {
    await db.pieceTypeAttributes.bulkUpsert(changes.pieceTypeAttributes);
  }
  if (changes.locations?.length) {
    await db.locations.bulkUpsert(changes.locations);
  }
  if (changes.orgAttributes?.length) {
    await db.orgAttributes.bulkUpsert(changes.orgAttributes);
  }
  if (changes.pieces?.length) {
    await db.pieces.bulkUpsert(changes.pieces);
  }
  if (changes.attachments?.length) {
    await db.attachments.bulkUpsert(changes.attachments);
  }
}
