import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStockaDatabase, type StockaDatabase } from "../db/database";
import { pushOutbox } from "../sync/push";
import type { SyncMutationRequest, SyncMutationsResponse } from "../sync/types";
import { createPiece, deletePiece, updatePiece } from "./pieceRepository";

function pieceServerDoc(
  syncId: string,
  rev: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    syncId,
    rev,
    name: "R1",
    serialNumber: "S1",
    description: null,
    status: "ACTIVE",
    ownerUserId: null,
    locationSyncId: null,
    coverAttachmentSyncId: null,
    pieceTypeSyncIds: ["t1"],
    typeAttributeValues: [{ attributeSyncId: "a1", value: "100" }],
    orgAttributeValues: [],
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function appliedResponse(rev: number, overrides: Record<string, unknown> = {}) {
  return async (req: SyncMutationRequest): Promise<SyncMutationsResponse> => ({
    minClientVersion: 1,
    results: req.mutations.map((m) => ({
      mutationId: m.mutationId,
      status: "applied",
      syncId: m.syncId,
      serverDoc: pieceServerDoc(m.syncId, rev, overrides),
      errorCode: null,
    })),
  });
}

describe("offline piece repository", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    db = await createStockaDatabase(getRxStorageMemory(), "pc" + Math.random().toString(36).slice(2));
  });

  afterEach(async () => {
    await db.remove();
  });

  it("queues the aggregate (type refs + attribute values) and reconciles the server doc", async () => {
    const piece = await createPiece(db, {
      name: "R1",
      serialNumber: "S1",
      pieceTypeSyncIds: ["t1"],
      typeAttributeValues: [{ attributeSyncId: "a1", value: "100" }],
    });

    // Local doc is instantly available with optimistic status.
    const local = await db.pieces.findOne(piece.syncId).exec();
    expect(local?.status).toBe("PENDING");
    expect(local?.pieceTypeSyncIds).toEqual(["t1"]);

    // The queued mutation carries the editable aggregate fields.
    const queued = await db.outbox.find({ selector: { status: "pending" } }).exec();
    expect(queued).toHaveLength(1);
    const payload = queued[0]?.doc as Record<string, unknown>;
    expect(payload.pieceTypeSyncIds).toEqual(["t1"]);
    expect(payload.typeAttributeValues).toEqual([{ attributeSyncId: "a1", value: "100" }]);

    // Push: the server's canonical aggregate is reconciled back (status + rev + values).
    const outcome = await pushOutbox(db, appliedResponse(5));
    expect(outcome.applied).toBe(1);
    const reconciled = await db.pieces.findOne(piece.syncId).exec();
    expect(reconciled?.rev).toBe(5);
    expect(reconciled?.status).toBe("ACTIVE");
    expect(reconciled?._localDirty).toBe(false);
    expect(reconciled?.typeAttributeValues?.[0]?.value).toBe("100");
  });

  it("updates fields locally and queues an upsert based on the current rev", async () => {
    const piece = await createPiece(db, { name: "R1", pieceTypeSyncIds: ["t1"] });
    await pushOutbox(db, appliedResponse(1));

    await updatePiece(db, piece.syncId, { name: "R1 renamed" });
    const queued = await db.outbox.find({ selector: { status: "pending" } }).exec();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.baseRev).toBe(1);
    expect((queued[0]?.doc as Record<string, unknown>).name).toBe("R1 renamed");
  });

  it("queues a delete and applies the tombstone after push", async () => {
    const piece = await createPiece(db, { name: "R1", pieceTypeSyncIds: ["t1"] });
    await pushOutbox(db, appliedResponse(1));

    await deletePiece(db, piece.syncId);
    await pushOutbox(db, appliedResponse(2, { deletedAt: "2026-06-03T10:00:00" }));

    const tombstone = await db.pieces.findOne(piece.syncId).exec();
    expect(tombstone?.deletedAt).not.toBeNull();
    expect((await db.outbox.find({ selector: { status: "pending" } }).exec())).toHaveLength(0);
  });
});
