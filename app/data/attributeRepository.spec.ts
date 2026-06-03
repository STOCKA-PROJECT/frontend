import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStockaDatabase, type StockaDatabase } from "../db/database";
import { pushOutbox } from "../sync/push";
import type { SyncMutationRequest, SyncMutationsResponse } from "../sync/types";
import { createOrgAttribute } from "./orgAttributeRepository";
import { createPieceTypeAttribute } from "./pieceTypeAttributeRepository";

function appliedWith(serverDoc: (syncId: string) => Record<string, unknown>) {
  return async (req: SyncMutationRequest): Promise<SyncMutationsResponse> => ({
    minClientVersion: 1,
    results: req.mutations.map((m) => ({
      mutationId: m.mutationId,
      status: "applied",
      syncId: m.syncId,
      serverDoc: serverDoc(m.syncId),
      errorCode: null,
    })),
  });
}

describe("offline attribute repositories", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    db = await createStockaDatabase(getRxStorageMemory(), "at" + Math.random().toString(36).slice(2));
  });

  afterEach(async () => {
    await db.remove();
  });

  it("queues an org attribute with its full field set and reconciles", async () => {
    const attr = await createOrgAttribute(db, {
      name: "warranty",
      displayName: "Warranty",
      type: "DATE",
      required: false,
      position: 2,
    });

    const queued = await db.outbox.find({ selector: { status: "pending" } }).exec();
    const payload = queued[0]?.doc as Record<string, unknown>;
    expect(payload.name).toBe("warranty");
    expect(payload.type).toBe("DATE");
    expect(payload.required).toBe(false);
    expect(payload.position).toBe(2);

    await pushOutbox(
      db,
      appliedWith((syncId) => ({
        syncId,
        rev: 4,
        name: "warranty",
        displayName: "Warranty",
        type: "DATE",
        required: false,
        position: 2,
        validatorsJson: null,
        createdAt: null,
        updatedAt: null,
        deletedAt: null,
      })),
    );
    const reconciled = await db.orgAttributes.findOne(attr.syncId).exec();
    expect(reconciled?.rev).toBe(4);
    expect(reconciled?._localDirty).toBe(false);
  });

  it("queues a type attribute carrying its parent pieceTypeSyncId", async () => {
    await createPieceTypeAttribute(db, {
      pieceTypeSyncId: "type-1",
      name: "ohms",
      type: "INTEGER",
    });
    const queued = await db.outbox.find({ selector: { status: "pending" } }).exec();
    const payload = queued[0]?.doc as Record<string, unknown>;
    expect(payload.pieceTypeSyncId).toBe("type-1");
    expect(payload.name).toBe("ohms");
    expect(payload.type).toBe("INTEGER");
    expect(payload.required).toBe(true);
  });
});
