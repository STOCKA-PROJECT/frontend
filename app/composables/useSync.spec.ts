import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { effectScope } from "vue";

import { createStockaDatabase, type StockaDatabase } from "../db/database";
import { enqueueUpsert } from "../sync/outbox";
import type { SyncRunner } from "../sync/runner";
import { useSync, type UseSyncState } from "./useSync";

const tick = () => new Promise((resolve) => setTimeout(resolve, 60));

describe("useSync", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    db = await createStockaDatabase(getRxStorageMemory(), "us" + Math.random().toString(36).slice(2));
  });

  afterEach(async () => {
    await db.remove();
  });

  it("tracks the pending count and runs a successful sync", async () => {
    // A runner that 'succeeds' by draining the pending outbox.
    const runner: SyncRunner = {
      run: async () => {
        await db.outbox.find({ selector: { status: "pending" } }).remove();
        return { push: { applied: 1, duplicates: 0, conflicts: 0, rejected: 0 }, checkpoint: {} };
      },
    };

    const scope = effectScope();
    let state!: UseSyncState;
    scope.run(() => {
      state = useSync({ db, runner });
    });

    await enqueueUpsert(db, "locations", "loc-1", null, { name: "x" });
    await tick();
    expect(state.pending.value).toBe(1);

    await state.sync();
    expect(state.syncing.value).toBe(false);
    expect(state.online.value).toBe(true);
    expect(state.lastSyncedAt.value).not.toBeNull();
    await tick();
    expect(state.pending.value).toBe(0);

    scope.stop();
  });

  it("marks offline and records the error when a sync fails", async () => {
    const runner: SyncRunner = {
      run: async () => {
        throw new Error("network down");
      },
    };

    const scope = effectScope();
    let state!: UseSyncState;
    scope.run(() => {
      state = useSync({ db, runner });
    });

    await state.sync();
    expect(state.online.value).toBe(false);
    expect(state.lastError.value).toBeInstanceOf(Error);
    expect(state.syncing.value).toBe(false);

    scope.stop();
  });
});
