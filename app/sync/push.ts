import type { StockaDatabase } from "../db/database";
import type { SyncMutationItem, SyncMutationRequest, SyncMutationsResponse } from "./types";

/** Sends a batch of mutations to the backend and returns the per-mutation results. */
export type PushFetch = (request: SyncMutationRequest) => Promise<SyncMutationsResponse>;

/** Tally of what happened to the drained mutations. */
export interface PushOutcome {
  applied: number;
  duplicates: number;
  conflicts: number;
  rejected: number;
}

/**
 * Drains the pending outbox: sends the queued mutations (oldest first), then reconciles each
 * result against the local store.
 *
 * <ul>
 *   <li>{@code applied}/{@code duplicate}/{@code conflict}: the server's canonical {@code serverDoc}
 *       overwrites the local document (LWW already resolved by the server) and the queue entry is
 *       cleared.</li>
 *   <li>{@code rejected}: the entry is moved to a {@code failed} dead-letter the UI surfaces
 *       (e.g. serial/name conflict, permission denied) — DECISIONS-AND-RISKS R8.</li>
 * </ul>
 *
 * Network/5xx failures throw, leaving the outbox intact for a backed-off retry; mutationId
 * idempotency makes that safe (R24).
 *
 * @param db        local database
 * @param pushFetch transport that posts the batch and returns results
 * @returns a tally of outcomes
 */
export async function pushOutbox(db: StockaDatabase, pushFetch: PushFetch): Promise<PushOutcome> {
  const outcome: PushOutcome = { applied: 0, duplicates: 0, conflicts: 0, rejected: 0 };

  const pending = await db.outbox
    .find({ selector: { status: "pending" }, sort: [{ createdAt: "asc" }] })
    .exec();
  if (pending.length === 0) {
    return outcome;
  }

  const items: SyncMutationItem[] = pending.map((entry) => ({
    mutationId: entry.mutationId,
    collection: entry.targetCollection as SyncMutationItem["collection"],
    op: entry.op,
    syncId: entry.syncId,
    baseRev: entry.baseRev,
    doc: entry.doc,
  }));

  const response = await pushFetch({ mutations: items });
  const byId = new Map(pending.map((entry) => [entry.mutationId, entry]));

  for (const result of response.results) {
    const entry = byId.get(result.mutationId);
    if (!entry) {
      continue;
    }

    if (result.status === "rejected") {
      await entry.incrementalPatch({
        status: "failed",
        attempts: entry.attempts + 1,
        errorCode: result.errorCode,
      });
      outcome.rejected += 1;
      continue;
    }

    if (result.serverDoc) {
      await reconcile(db, entry.targetCollection, result.serverDoc as Record<string, unknown>);
    }
    await entry.remove();

    if (result.status === "applied") {
      outcome.applied += 1;
    } else if (result.status === "conflict") {
      outcome.conflicts += 1;
    } else {
      outcome.duplicates += 1;
    }
  }

  return outcome;
}

/** Overwrites the local document of {@code collection} with the server's canonical version. */
async function reconcile(
  db: StockaDatabase,
  collection: string,
  serverDoc: Record<string, unknown>,
): Promise<void> {
  const store = (db as unknown as Record<string, { upsert: (doc: unknown) => Promise<unknown> }>)[
    collection
  ];
  if (!store) {
    return;
  }
  await store.upsert({ ...serverDoc, _localDirty: false });
}
