import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { applyChanges } from "../sync/apply";
import type { SyncChanges } from "../sync/types";
import type { StockaDatabase } from "./database";
import { createDesktopDatabase, databaseName } from "./desktopDatabase";

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

describe("desktop database (Dexie/IndexedDB)", () => {
  let db: StockaDatabase | null = null;

  afterEach(async () => {
    if (db) {
      await db.remove();
      db = null;
    }
  });

  it("sanitizes the per-account database name", () => {
    expect(databaseName("user@stocka.es")).toBe("stocka_user_stocka_es");
    expect(databaseName("42")).toBe("stocka_42");
    expect(databaseName("")).toBe("stocka_default");
  });

  it("creates a Dexie-backed database and round-trips a document", async () => {
    db = await createDesktopDatabase("acct-1");
    await applyChanges(db, {
      ...emptyChanges(),
      locations: [
        {
          syncId: "loc-1",
          rev: 1,
          name: "Warehouse",
          description: null,
          parentSyncId: null,
          createdAt: null,
          updatedAt: null,
          deletedAt: null,
        },
      ],
    });
    const stored = await db.locations.findOne("loc-1").exec();
    expect(stored?.name).toBe("Warehouse");
  });
});
