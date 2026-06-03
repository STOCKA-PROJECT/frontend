import type { StockaDatabase } from "../db/database";
import type { CheckpointStore } from "./pull";

/** RxDB document id holding the pull checkpoint. */
const CHECKPOINT_DOC_ID = "pull";

/**
 * A {@link CheckpointStore} backed by the local {@code syncState} collection, so the per-collection
 * pull cursor survives app restarts and an interrupted sync resumes where it left off
 * (DECISIONS-AND-RISKS R26).
 *
 * @param db the local database
 * @returns a persistent checkpoint store
 */
export function createRxCheckpointStore(db: StockaDatabase): CheckpointStore {
  return {
    async load() {
      const doc = await db.syncState.findOne(CHECKPOINT_DOC_ID).exec();
      return doc?.checkpoint ?? {};
    },
    async save(checkpoint) {
      await db.syncState.upsert({ id: CHECKPOINT_DOC_ID, checkpoint });
    },
  };
}
