import type { StockaDatabase } from "../db/database";
import { type CheckpointStore, type PullFetch, runPull } from "./pull";
import { type PushFetch, type PushOutcome, pushOutbox } from "./push";

/** Transport + persistence the sync engine needs. */
export interface SyncEngineDeps {
  pull: PullFetch;
  push: PushFetch;
  checkpoints: CheckpointStore;
}

/** Summary of one sync run. */
export interface SyncRunResult {
  push: PushOutcome;
  checkpoint: Record<string, number>;
}

/**
 * Runs one full synchronization: first drains the local outbox (so offline edits reach the
 * server), then pulls the latest changes (which also brings back the server's canonical version of
 * what we just pushed, plus anyone else's changes). Last-write-wins makes the order safe.
 *
 * Throws if the transport fails (network/5xx): the outbox and checkpoint are left intact for a
 * backed-off retry, which is safe thanks to mutationId idempotency (R24) and the rev cursor (R26).
 *
 * @param db   the local database
 * @param deps transport and checkpoint persistence
 * @returns the push tally and the checkpoint reached
 */
export async function runSync(db: StockaDatabase, deps: SyncEngineDeps): Promise<SyncRunResult> {
  const push = await pushOutbox(db, deps.push);
  const checkpoint = await runPull(db, deps.pull, deps.checkpoints);
  return { push, checkpoint };
}
