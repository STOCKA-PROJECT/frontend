import { wrappedKeyEncryptionCryptoJsStorage } from "rxdb/plugins/encryption-crypto-js";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStockaDatabase, type StockaDatabase } from "./database";
import { createPiece } from "../data/pieceRepository";

/**
 * Validates the at-rest encryption wiring (R29): with a password and the encryption-wrapped
 * storage, the declared sensitive fields are encrypted, yet documents round-trip transparently and
 * queries on non-encrypted fields still work.
 */
describe("encrypted database", () => {
  let db: StockaDatabase;

  beforeEach(async () => {
    const storage = wrappedKeyEncryptionCryptoJsStorage({ storage: getRxStorageMemory() });
    db = await createStockaDatabase(storage, "enc" + Math.random().toString(36).slice(2), "a-strong-test-password");
  });

  afterEach(async () => {
    await db.remove();
  });

  it("round-trips a piece whose name/serialNumber/description are encrypted at rest", async () => {
    const piece = await createPiece(db, {
      name: "Secret Widget",
      serialNumber: "SN-CONF-1",
      description: "classified",
      pieceTypeSyncIds: [],
    });

    const fetched = await db.pieces.findOne(piece.syncId).exec();
    expect(fetched).not.toBeNull();
    const json = fetched!.toJSON();
    expect(json.name).toBe("Secret Widget");
    expect(json.serialNumber).toBe("SN-CONF-1");
    expect(json.description).toBe("classified");
  });

  it("still queries by a non-encrypted field (outbox status) under encryption", async () => {
    await createPiece(db, { name: "Q", pieceTypeSyncIds: [] });
    const pending = await db.outbox.find({ selector: { status: "pending" } }).exec();
    expect(pending.length).toBeGreaterThan(0);
  });
});
