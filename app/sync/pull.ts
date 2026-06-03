import type { StockaDatabase } from "../db/database";
import { applyChanges } from "./apply";
import type { SyncChangesResponse } from "./types";

/** Persists/loads the per-collection pull checkpoint (e.g. in a local meta collection). */
export interface CheckpointStore {
  load(): Promise<Record<string, number>>;
  save(checkpoint: Record<string, number>): Promise<void>;
}

/** Fetches one page of changes from the backend for the given `since` cursor. */
export type PullFetch = (since: string | null) => Promise<SyncChangesResponse>;

/**
 * Serializes a per-collection checkpoint into the `since` query value expected by the backend
 * (`"collection:rev,collection:rev"`); entries at 0 are omitted (full pull for that collection).
 *
 * @param checkpoint per-collection rev map
 * @returns the `since` string, or `null` when nothing has been pulled yet
 */
export function serializeCheckpoint(checkpoint: Record<string, number>): string | null {
  const parts = Object.entries(checkpoint)
    .filter(([, rev]) => rev > 0)
    .map(([collection, rev]) => `${collection}:${rev}`);
  return parts.length ? parts.join(",") : null;
}

/**
 * Runs the pull loop until the server reports no more changes, applying each page to the local
 * database and persisting the advancing checkpoint so an interrupted sync resumes where it left
 * off (DECISIONS-AND-RISKS R26).
 *
 * @param db            the local database
 * @param fetchChanges  fetches a page of changes for a `since` cursor
 * @param checkpoints   checkpoint persistence
 * @param maxPages      safety cap on the number of pages pulled in one run
 * @returns the final checkpoint reached
 */
export async function runPull(
  db: StockaDatabase,
  fetchChanges: PullFetch,
  checkpoints: CheckpointStore,
  maxPages = 1000,
): Promise<Record<string, number>> {
  let checkpoint = await checkpoints.load();

  for (let page = 0; page < maxPages; page++) {
    const response = await fetchChanges(serializeCheckpoint(checkpoint));
    await applyChanges(db, response.changes);
    checkpoint = { ...checkpoint, ...response.checkpoint };
    await checkpoints.save(checkpoint);
    if (!response.hasMore) {
      break;
    }
  }

  return checkpoint;
}
