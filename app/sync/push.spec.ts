import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createLocation,
  deleteLocation,
  updateLocation,
} from "../data/locationRepository";
import { createStockaDatabase, type StockaDatabase } from "../db/database";
import { pushOutbox } from "./push";
import type { SyncMutationRequest, SyncMutationsResponse } from "./types";

function locationServerDoc(syncId: string, rev: number, name: string, deleted = false) {
  return {
    syncId,
    rev,
    name,
    description: null,
    parentSyncId: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: deleted ? "2026-06-03T10:00:00" : null,
  };
}

async function pendingCount(db: StockaDatabase): Promise<number> {
  return (await db.outbox.find({ selector: { status: "pending" } }).exec()).length;
}

describe("offline sync push (outbox)", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    db = await createStockaDatabase(getRxStorageMemory(), "push" + Math.random().toString(36).slice(2));
  });

  afterEach(async () => {
    await db.remove();
  });

  it("queues a create, pushes it, and reconciles the server rev", async () => {
    const created = await createLocation(db, { name: "Warehouse" });
    expect(created.rev).toBe(0);
    expect(await pendingCount(db)).toBe(1);

    const fetch = async (req: SyncMutationRequest): Promise<SyncMutationsResponse> => ({
      minClientVersion: 1,
      results: req.mutations.map((m) => ({
        mutationId: m.mutationId,
        status: "applied",
        syncId: m.syncId,
        serverDoc: locationServerDoc(m.syncId, 1, "Warehouse"),
        errorCode: null,
      })),
    });

    const outcome = await pushOutbox(db, fetch);
    expect(outcome.applied).toBe(1);

    const doc = await db.locations.findOne(created.syncId).exec();
    expect(doc?.rev).toBe(1);
    expect(doc?._localDirty).toBe(false);
    expect(await pendingCount(db)).toBe(0);
  });

  it("reconciles a server conflict (LWW) with the canonical server doc", async () => {
    const created = await createLocation(db, { name: "Warehouse" });
    await pushOutbox(db, async (req) => ({
      minClientVersion: 1,
      results: req.mutations.map((m) => ({
        mutationId: m.mutationId,
        status: "applied",
        syncId: m.syncId,
        serverDoc: locationServerDoc(m.syncId, 1, "Warehouse"),
        errorCode: null,
      })),
    }));

    await updateLocation(db, created.syncId, { name: "Local rename" });
    const outcome = await pushOutbox(db, async (req) => ({
      minClientVersion: 1,
      results: req.mutations.map((m) => ({
        mutationId: m.mutationId,
        status: "conflict",
        syncId: m.syncId,
        serverDoc: locationServerDoc(m.syncId, 3, "Server wins"),
        errorCode: null,
      })),
    }));

    expect(outcome.conflicts).toBe(1);
    const doc = await db.locations.findOne(created.syncId).exec();
    expect(doc?.rev).toBe(3);
    expect(doc?.name).toBe("Server wins");
    expect(doc?._localDirty).toBe(false);
  });

  it("dead-letters a rejected mutation and keeps the local edit dirty", async () => {
    const created = await createLocation(db, { name: "Dup serial" });
    const outcome = await pushOutbox(db, async (req) => ({
      minClientVersion: 1,
      results: req.mutations.map((m) => ({
        mutationId: m.mutationId,
        status: "rejected",
        syncId: m.syncId,
        serverDoc: null,
        errorCode: "name_conflict",
      })),
    }));

    expect(outcome.rejected).toBe(1);
    const failed = await db.outbox.find({ selector: { status: "failed" } }).exec();
    expect(failed).toHaveLength(1);
    expect(failed[0]?.errorCode).toBe("name_conflict");

    const doc = await db.locations.findOne(created.syncId).exec();
    expect(doc?._localDirty).toBe(true);
  });

  it("queues a delete and applies the tombstone after push", async () => {
    const created = await createLocation(db, { name: "To delete" });
    await pushOutbox(db, async (req) => ({
      minClientVersion: 1,
      results: req.mutations.map((m) => ({
        mutationId: m.mutationId,
        status: "applied",
        syncId: m.syncId,
        serverDoc: locationServerDoc(m.syncId, 1, "To delete"),
        errorCode: null,
      })),
    }));

    await deleteLocation(db, created.syncId);
    await pushOutbox(db, async (req) => ({
      minClientVersion: 1,
      results: req.mutations.map((m) => ({
        mutationId: m.mutationId,
        status: "applied",
        syncId: m.syncId,
        serverDoc: locationServerDoc(m.syncId, 2, "To delete", true),
        errorCode: null,
      })),
    }));

    const doc = await db.locations.findOne(created.syncId).exec();
    expect(doc?.deletedAt).not.toBeNull();
    expect(await pendingCount(db)).toBe(0);
  });
});
