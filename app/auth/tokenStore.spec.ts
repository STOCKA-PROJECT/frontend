import { describe, expect, it } from "vitest";

import { MemoryTokenStore, TauriKeychainTokenStore, type SessionTokens } from "./tokenStore";

const sample: SessionTokens = {
  accessToken: "a",
  refreshToken: "r",
  expiresInMs: 1000,
  savedAt: 123,
};

describe("MemoryTokenStore", () => {
  it("round-trips and clears", async () => {
    const store = new MemoryTokenStore();
    expect(await store.load()).toBeNull();
    await store.save(sample);
    expect(await store.load()).toEqual(sample);
    await store.clear();
    expect(await store.load()).toBeNull();
  });
});

describe("TauriKeychainTokenStore", () => {
  it("serializes through the injected invoke bridge", async () => {
    const calls: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
    let stored: string | null = null;
    const invoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
      calls.push({ cmd, args });
      if (cmd === "keychain_save") {
        stored = String(args?.value);
        return undefined as T;
      }
      if (cmd === "keychain_load") {
        return stored as T;
      }
      if (cmd === "keychain_clear") {
        stored = null;
        return undefined as T;
      }
      throw new Error(`unexpected ${cmd}`);
    };

    const store = new TauriKeychainTokenStore(invoke);
    expect(await store.load()).toBeNull();
    await store.save(sample);
    expect(stored).toBe(JSON.stringify(sample));
    expect(await store.load()).toEqual(sample);
    await store.clear();
    expect(await store.load()).toBeNull();
    expect(calls.map((c) => c.cmd)).toContain("keychain_save");
  });

  it("returns null on corrupt stored JSON instead of throwing", async () => {
    const invoke = async <T>(cmd: string): Promise<T> =>
      (cmd === "keychain_load" ? ("{not json" as unknown as T) : (undefined as T));
    const store = new TauriKeychainTokenStore(invoke);
    expect(await store.load()).toBeNull();
  });

  it("throws when no bridge is available", () => {
    expect(() => new TauriKeychainTokenStore()).toThrow();
  });
});
