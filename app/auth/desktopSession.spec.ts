import { beforeEach, describe, expect, it } from "vitest";

import { AuthError, DesktopSession } from "./desktopSession";
import { MemoryTokenStore } from "./tokenStore";

interface Call {
  url: string;
  init?: RequestInit;
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("DesktopSession", () => {
  let store: MemoryTokenStore;
  let calls: Call[];

  beforeEach(() => {
    store = new MemoryTokenStore();
    calls = [];
  });

  function session(handler: (url: string, init?: RequestInit) => unknown, skewMs = 30_000) {
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return handler(String(url), init);
    }) as unknown as typeof fetch;
    return new DesktopSession({
      apiBaseUrl: "https://api.stocka.es",
      tokenStore: store,
      fetchImpl,
      refreshSkewMs: skewMs,
    });
  }

  it("logs in, stores tokens, and returns a valid access token", async () => {
    const s = session((url) => {
      if (url.endsWith("/auth/login")) {
        return jsonResponse(200, {
          accessToken: "acc-1",
          refreshToken: "ref-1",
          expiresIn: 900_000,
          user: { id: 1, email: "a@b.c", name: "A" },
        });
      }
      throw new Error("unexpected " + url);
    });

    const result = await s.login("a@b.c", "pw");
    expect(result.kind).toBe("session");
    const stored = await store.load();
    expect(stored?.accessToken).toBe("acc-1");
    expect(stored?.refreshToken).toBe("ref-1");

    expect(await s.getValidAccessToken()).toBe("acc-1");
    // login sent the desktop opt-in header.
    expect((calls[0].init?.headers as Record<string, string>)["X-Stocka-Client"]).toBe("desktop");
  });

  it("returns a 2FA challenge without storing tokens", async () => {
    const s = session(() => jsonResponse(200, { requires2fa: true, mfaToken: "mfa-1" }));
    const result = await s.login("a@b.c", "pw");
    expect(result).toEqual({ kind: "twoFactor", mfaToken: "mfa-1" });
    expect(await store.load()).toBeNull();
  });

  it("refreshes via the X-Refresh-Token header when the access token is near expiry", async () => {
    const s = session((url, init) => {
      if (url.endsWith("/auth/login")) {
        return jsonResponse(200, { accessToken: "acc-1", refreshToken: "ref-1", expiresIn: 900_000, user: {} });
      }
      if (url.endsWith("/auth/refresh")) {
        expect((init?.headers as Record<string, string>)["X-Refresh-Token"]).toBe("ref-1");
        return jsonResponse(200, { accessToken: "acc-2", refreshToken: "ref-2", expiresIn: 900_000 });
      }
      throw new Error("unexpected " + url);
    }, 1_000_000_000); // huge skew -> always "near expiry" -> forces refresh

    await s.login("a@b.c", "pw");
    const token = await s.getValidAccessToken();
    expect(token).toBe("acc-2");
    expect((await store.load())?.refreshToken).toBe("ref-2");
  });

  it("clears the session and throws when refresh is rejected", async () => {
    const s = session((url) => {
      if (url.endsWith("/auth/login")) {
        return jsonResponse(200, { accessToken: "acc-1", refreshToken: "ref-1", expiresIn: 900_000, user: {} });
      }
      return jsonResponse(401, {});
    }, 1_000_000_000);

    await s.login("a@b.c", "pw");
    await expect(s.getValidAccessToken()).rejects.toBeInstanceOf(AuthError);
    expect(await store.load()).toBeNull();
  });
});
