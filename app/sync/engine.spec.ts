import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLocation } from "../data/locationRepository";
import { createStockaDatabase, type StockaDatabase } from "../db/database";
import { runSync } from "./engine";
import type { CheckpointStore } from "./pull";
import { createSyncTransport, SyncHttpError } from "./transport";
import type { SyncChanges, SyncChangesResponse, SyncMutationsResponse } from "./types";

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
  return { load: async () => cp, save: async (next) => void (cp = next) };
}

describe("sync engine", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    db = await createStockaDatabase(getRxStorageMemory(), "eng" + Math.random().toString(36).slice(2));
  });

  afterEach(async () => {
    await db.remove();
  });

  it("runSync pushes the outbox then pulls server changes", async () => {
    const created = await createLocation(db, { name: "Warehouse" });

    let pulled = 0;
    const result = await runSync(db, {
      push: async (req): Promise<SyncMutationsResponse> => ({
        minClientVersion: 1,
        results: req.mutations.map((m) => ({
          mutationId: m.mutationId,
          status: "applied",
          syncId: m.syncId,
          serverDoc: {
            syncId: m.syncId,
            rev: 1,
            name: "Warehouse",
            description: null,
            parentSyncId: null,
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
          },
          errorCode: null,
        })),
      }),
      pull: async (): Promise<SyncChangesResponse> => {
        pulled += 1;
        return {
          changes: {
            ...emptyChanges(),
            locations: [
              {
                syncId: "from-server",
                rev: 7,
                name: "Office",
                description: null,
                parentSyncId: null,
                createdAt: null,
                updatedAt: null,
                deletedAt: null,
              },
            ],
          },
          checkpoint: { locations: 7 },
          hasMore: false,
          minClientVersion: 1,
        };
      },
      checkpoints: memoryCheckpoint(),
    });

    expect(result.push.applied).toBe(1);
    expect(result.checkpoint.locations).toBe(7);
    expect(pulled).toBe(1);

    // The pushed doc was reconciled and the pulled doc applied.
    expect((await db.locations.findOne(created.syncId).exec())?.rev).toBe(1);
    expect((await db.locations.findOne("from-server").exec())?.name).toBe("Office");
  });
});

describe("sync transport", () => {
  it("calls the /sync/v1 endpoints with a bearer token and since cursor", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          changes: {},
          checkpoint: {},
          hasMore: false,
          minClientVersion: 1,
        }),
      };
    }) as unknown as typeof fetch;

    const transport = createSyncTransport({
      apiBaseUrl: "https://api.stocka.es/",
      orgSlug: "acme",
      getAccessToken: () => "tok-123",
      fetchImpl: fakeFetch,
    });

    await transport.pull(null);
    await transport.pull("locations:5");

    expect(calls[0]?.url).toBe("https://api.stocka.es/organizations/acme/sync/v1/changes");
    expect(calls[1]?.url).toContain("since=locations%3A5");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
  });

  it("throws SyncHttpError on a non-2xx response", async () => {
    const fakeFetch = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
    const transport = createSyncTransport({
      apiBaseUrl: "https://api.stocka.es",
      orgSlug: "acme",
      fetchImpl: fakeFetch,
    });

    await expect(transport.pull(null)).rejects.toBeInstanceOf(SyncHttpError);
  });
});
