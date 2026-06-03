import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStockaDatabase, type StockaDatabase } from "../db/database";
import { createRxCheckpointStore } from "./checkpointStore";
import { runPull } from "./pull";
import type { SyncChanges, SyncChangesResponse } from "./types";

function emptyChanges(): SyncChanges {
  return {
    pieceTypes: [],
    pieceTypeAttributes: [],
    locations: [],
    orgAttributes: [],
    pieces: [],
    attachments: [],
  };
}

describe("RxDB checkpoint store", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    db = await createStockaDatabase(getRxStorageMemory(), "cp" + Math.random().toString(36).slice(2));
  });

  afterEach(async () => {
    await db.remove();
  });

  it("persists the pull checkpoint and resumes from it on the next run", async () => {
    const store = createRxCheckpointStore(db);
    const sinceCalls: Array<string | null> = [];

    const fetchOnce = async (since: string | null): Promise<SyncChangesResponse> => {
      sinceCalls.push(since);
      return {
        changes: {
          ...emptyChanges(),
          locations: [
            {
              syncId: "loc-a",
              rev: 3,
              name: "Warehouse",
              description: null,
              parentSyncId: null,
              createdAt: null,
              updatedAt: null,
              deletedAt: null,
            },
          ],
        },
        checkpoint: { locations: 3 },
        hasMore: false,
        minClientVersion: 1,
      };
    };

    await runPull(db, fetchOnce, store);
    expect(await store.load()).toEqual({ locations: 3 });
    // Persisted in the syncState collection.
    expect((await db.syncState.findOne("pull").exec())?.checkpoint).toEqual({ locations: 3 });

    // A fresh store reading the same DB resumes from the persisted cursor.
    const resumed = createRxCheckpointStore(db);
    await runPull(db, fetchOnce, resumed);
    expect(sinceCalls[0]).toBeNull();
    expect(sinceCalls[1]).toBe("locations:3");
  });
});
