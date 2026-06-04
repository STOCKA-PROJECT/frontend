import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { effectScope } from "vue";

import { buildLocationTree } from "../data/locationsTree";
import type { LocationDoc } from "../db/schemas";
import { createStockaDatabase, type StockaDatabase } from "../db/database";
import { useOfflineLocations, type OfflineLocations } from "./useOfflineLocations";

const tick = () => new Promise((resolve) => setTimeout(resolve, 60));

function doc(partial: Partial<LocationDoc> & Pick<LocationDoc, "syncId" | "name">): LocationDoc {
  return {
    rev: 1,
    description: null,
    parentSyncId: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    ...partial,
  } as LocationDoc;
}

describe("buildLocationTree", () => {
  it("nests children, sorts siblings by name, and drops tombstones", () => {
    const tree = buildLocationTree([
      doc({ syncId: "a", name: "Warehouse" }),
      doc({ syncId: "b", name: "Shelf B", parentSyncId: "a" }),
      doc({ syncId: "c", name: "Shelf A", parentSyncId: "a" }),
      doc({ syncId: "d", name: "Deleted", deletedAt: "2026-06-03T10:00:00" }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].syncId).toBe("a");
    expect(tree[0].children.map((c) => c.name)).toEqual(["Shelf A", "Shelf B"]);
  });
});

describe("useOfflineLocations", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    db = await createStockaDatabase(getRxStorageMemory(), "ol" + Math.random().toString(36).slice(2));
  });

  afterEach(async () => {
    await db.remove();
  });

  it("exposes a reactive tree and writes offline (create, child, delete)", async () => {
    const scope = effectScope();
    let loc!: OfflineLocations;
    scope.run(() => {
      loc = useOfflineLocations(db);
    });

    await loc.create({ name: "Warehouse" });
    await tick();
    expect(loc.tree.value).toHaveLength(1);
    const warehouse = loc.tree.value[0]!;
    expect(warehouse.name).toBe("Warehouse");

    await loc.create({ name: "Shelf 1", parentSyncId: warehouse.syncId });
    await tick();
    expect(loc.tree.value[0]!.children).toHaveLength(1);

    // The local write also enqueued mutations in the outbox.
    const pending = await db.outbox.find({ selector: { status: "pending" } }).exec();
    expect(pending).toHaveLength(2);

    await loc.remove(warehouse.syncId);
    await tick();
    // The tombstoned root is dropped from the tree.
    expect(loc.tree.value.find((n) => n.syncId === warehouse.syncId)).toBeUndefined();

    scope.stop();
  });
});
