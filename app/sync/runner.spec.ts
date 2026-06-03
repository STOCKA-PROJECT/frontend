import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPiece } from "../data/pieceRepository";
import { createStockaDatabase, type StockaDatabase } from "../db/database";
import { createSyncRunner } from "./runner";

describe("sync runner", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    db = await createStockaDatabase(getRxStorageMemory(), "rn" + Math.random().toString(36).slice(2));
  });

  afterEach(async () => {
    await db.remove();
  });

  it("pushes the outbox then pulls, attaching the bearer token and persisting the checkpoint", async () => {
    const piece = await createPiece(db, { name: "R1", pieceTypeSyncIds: ["t1"] });
    const authHeaders: Array<string | undefined> = [];

    const fakeFetch = (async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      authHeaders.push(headers.Authorization);
      if (String(url).includes("/sync/v1/mutations")) {
        const body = JSON.parse(String(init?.body)) as { mutations: Array<{ mutationId: string; syncId: string }> };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            minClientVersion: 1,
            results: body.mutations.map((m) => ({
              mutationId: m.mutationId,
              status: "applied",
              syncId: m.syncId,
              serverDoc: {
                syncId: m.syncId,
                rev: 9,
                name: "R1",
                serialNumber: null,
                description: null,
                status: "ACTIVE",
                ownerUserId: null,
                locationSyncId: null,
                coverAttachmentSyncId: null,
                pieceTypeSyncIds: ["t1"],
                typeAttributeValues: [],
                orgAttributeValues: [],
                createdAt: null,
                updatedAt: null,
                deletedAt: null,
              },
              errorCode: null,
            })),
          }),
        };
      }
      // pull
      return {
        ok: true,
        status: 200,
        json: async () => ({
          changes: {
            pieceTypes: [],
            pieceTypeAttributes: [],
            locations: [],
            orgAttributes: [],
            pieces: [],
            attachments: [],
          },
          checkpoint: { pieces: 9 },
          hasMore: false,
          minClientVersion: 1,
        }),
      };
    }) as unknown as typeof fetch;

    const runner = createSyncRunner({
      db,
      apiBaseUrl: "https://api.stocka.es",
      orgSlug: "acme",
      getAccessToken: () => "tok",
      fetchImpl: fakeFetch,
    });

    const result = await runner.run();

    expect(result.push.applied).toBe(1);
    // The created piece was reconciled to the server rev and is no longer dirty.
    const reconciled = await db.pieces.findOne(piece.syncId).exec();
    expect(reconciled?.rev).toBe(9);
    expect(reconciled?._localDirty).toBe(false);
    // The checkpoint was persisted.
    expect((await db.syncState.findOne("pull").exec())?.checkpoint).toMatchObject({ pieces: 9 });
    // Every call carried the bearer token.
    expect(authHeaders.every((h) => h === "Bearer tok")).toBe(true);
  });
});
