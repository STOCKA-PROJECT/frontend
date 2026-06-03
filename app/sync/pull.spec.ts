import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStockaDatabase, type StockaDatabase } from "../db/database";
import { applyChanges } from "./apply";
import { runPull, serializeCheckpoint, type CheckpointStore } from "./pull";
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

function memoryCheckpoint(): CheckpointStore {
  let cp: Record<string, number> = {};
  return {
    load: async () => cp,
    save: async (next) => {
      cp = next;
    },
  };
}

describe("offline sync pull", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    db = await createStockaDatabase(
      getRxStorageMemory(),
      "test" + Math.random().toString(36).slice(2),
    );
  });

  afterEach(async () => {
    await db.remove();
  });

  it("serializes the checkpoint like the backend's since parser", () => {
    expect(serializeCheckpoint({ locations: 5, pieces: 0 })).toBe("locations:5");
    expect(serializeCheckpoint({ locations: 3, pieces: 9 })).toContain("locations:3");
    expect(serializeCheckpoint({})).toBeNull();
  });

  it("applies pulled documents and resumes with the advanced cursor", async () => {
    const sinceCalls: Array<string | null> = [];
    let page = 0;
    const fetchChanges = async (since: string | null): Promise<SyncChangesResponse> => {
      sinceCalls.push(since);
      page += 1;
      if (page === 1) {
        return {
          changes: {
            ...emptyChanges(),
            locations: [
              {
                syncId: "loc-a",
                rev: 1,
                name: "Warehouse",
                description: null,
                parentSyncId: null,
                createdAt: null,
                updatedAt: null,
                deletedAt: null,
              },
            ],
          },
          checkpoint: { locations: 1 },
          hasMore: true,
          minClientVersion: 1,
        };
      }
      return {
        changes: emptyChanges(),
        checkpoint: { locations: 1 },
        hasMore: false,
        minClientVersion: 1,
      };
    };

    const finalCheckpoint = await runPull(db, fetchChanges, memoryCheckpoint());

    // The document landed locally.
    const stored = await db.locations.findOne("loc-a").exec();
    expect(stored?.name).toBe("Warehouse");

    // First page pulled from scratch (null), the second resumed at the advanced cursor.
    expect(sinceCalls[0]).toBeNull();
    expect(sinceCalls[1]).toBe("locations:1");
    expect(finalCheckpoint.locations).toBe(1);
  });

  it("keeps tombstones but lets queries filter them out", async () => {
    await applyChanges(db, {
      ...emptyChanges(),
      locations: [
        {
          syncId: "live",
          rev: 1,
          name: "Live",
          description: null,
          parentSyncId: null,
          createdAt: null,
          updatedAt: null,
          deletedAt: null,
        },
        {
          syncId: "gone",
          rev: 2,
          name: "Gone",
          description: null,
          parentSyncId: null,
          createdAt: null,
          updatedAt: null,
          deletedAt: "2026-06-03T10:00:00",
        },
      ],
    });

    const all = await db.locations.find().exec();
    expect(all).toHaveLength(2);

    const live = all.filter((doc) => doc.deletedAt === null);
    expect(live.map((doc) => doc.syncId)).toEqual(["live"]);
  });

  it("stores the piece aggregate with its embedded values and type refs", async () => {
    await applyChanges(db, {
      ...emptyChanges(),
      pieces: [
        {
          syncId: "piece-1",
          rev: 5,
          name: "Tornillo M3",
          serialNumber: "S-1",
          description: null,
          status: "ACTIVE",
          ownerUserId: null,
          locationSyncId: "loc-a",
          coverAttachmentSyncId: null,
          pieceTypeSyncIds: ["type-1"],
          typeAttributeValues: [{ attributeSyncId: "attr-1", value: "12" }],
          orgAttributeValues: [],
          createdAt: null,
          updatedAt: null,
          deletedAt: null,
        },
      ],
    });

    const piece = await db.pieces.findOne("piece-1").exec();
    expect(piece?.pieceTypeSyncIds).toEqual(["type-1"]);
    expect(piece?.typeAttributeValues[0]?.value).toBe("12");
    expect(piece?.locationSyncId).toBe("loc-a");
  });
});
