import type { SessionTokens, TokenStore } from "./tokenStore";

/**
 * Desktop authentication session: logs in against the backend with the {@code X-Stocka-Client:
 * desktop} opt-in, stores the access + refresh tokens, refreshes via the {@code X-Refresh-Token}
 * header, and hands a valid access token to the sync transport (DECISIONS-AND-RISKS D4).
 *
 * Unlike the web (which relies on the Nitro BFF + httpOnly cookies), the desktop app talks to the
 * backend directly and manages tokens itself through the injected {@link TokenStore} (keychain in
 * production, in-memory in tests).
 */

/** Minimal user shape returned by the backend on login. */
export interface SessionUser {
  id: number;
  email: string;
  name: string;
  [key: string]: unknown;
}

/** Login result: either an authenticated session or a 2FA challenge. */
export type LoginResult =
  | { kind: "session"; user: SessionUser }
  | { kind: "twoFactor"; mfaToken: string };

/** Thrown when an auth call fails (non-2xx). */
export class AuthError extends Error {
  constructor(readonly status: number) {
    super(`auth request failed with HTTP ${status}`);
    this.name = "AuthError";
  }
}

export interface DesktopSessionConfig {
  apiBaseUrl: string;
  tokenStore: TokenStore;
  fetchImpl?: typeof fetch;
  /** Refresh this many ms before the access token actually expires. */
  refreshSkewMs?: number;
}

const DESKTOP_HEADERS = { "X-Stocka-Client": "desktop" } as const;
const DEFAULT_SKEW_MS = 30_000;

export class DesktopSession {
  private readonly base: string;
  private readonly doFetch: typeof fetch;
  private readonly tokenStore: TokenStore;
  private readonly skewMs: number;

  constructor(config: DesktopSessionConfig) {
    this.base = config.apiBaseUrl.replace(/\/+$/, "");
    this.doFetch = config.fetchImpl ?? globalThis.fetch;
    this.tokenStore = config.tokenStore;
    this.skewMs = config.refreshSkewMs ?? DEFAULT_SKEW_MS;
  }

  /**
   * Logs in. On success the tokens are stored and an authenticated result is returned; when the
   * account has 2FA the {@code twoFactor} challenge is returned instead (no tokens stored yet).
   */
  async login(email: string, password: string, rememberMe = false): Promise<LoginResult> {
    const body = await this.postJson("/auth/login", { email, password, rememberMe });
    if (body.requires2fa) {
      return { kind: "twoFactor", mfaToken: body.mfaToken as string };
    }
    await this.store(body);
    return { kind: "session", user: body.user as SessionUser };
  }

  /** Completes a 2FA challenge and stores the resulting session. */
  async completeTwoFactor(mfaToken: string, code: string, rememberMe = false): Promise<SessionUser> {
    const body = await this.postJson("/auth/login/2fa", { mfaToken, code, rememberMe });
    await this.store(body);
    return body.user as SessionUser;
  }

  /**
   * Returns a currently-valid access token, transparently refreshing when it is missing or within
   * the skew window of expiry. Returns {@code null} when there is no session.
   */
  async getValidAccessToken(): Promise<string | null> {
    const tokens = await this.tokenStore.load();
    if (!tokens) {
      return null;
    }
    if (Date.now() >= tokens.savedAt + tokens.expiresInMs - this.skewMs) {
      await this.refresh();
      return (await this.tokenStore.load())?.accessToken ?? null;
    }
    return tokens.accessToken;
  }

  /** Rotates the refresh token and updates the stored session. */
  async refresh(): Promise<void> {
    const tokens = await this.tokenStore.load();
    if (!tokens?.refreshToken) {
      throw new AuthError(401);
    }
    const response = await this.doFetch(`${this.base}/auth/refresh`, {
      method: "POST",
      headers: { ...DESKTOP_HEADERS, "X-Refresh-Token": tokens.refreshToken },
    });
    if (!response.ok) {
      // Refresh expired/revoked: drop the session but keep any pending outbox for re-login.
      await this.tokenStore.clear();
      throw new AuthError(response.status);
    }
    const body = (await response.json()) as Record<string, unknown>;
    await this.store(body, tokens.refreshToken);
  }

  /** Clears the local session (best-effort server logout is the caller's concern). */
  async logout(): Promise<void> {
    await this.tokenStore.clear();
  }

  private async postJson(path: string, payload: unknown): Promise<Record<string, unknown>> {
    const response = await this.doFetch(`${this.base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...DESKTOP_HEADERS },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new AuthError(response.status);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  private async store(body: Record<string, unknown>, fallbackRefresh?: string): Promise<void> {
    const tokens: SessionTokens = {
      accessToken: body.accessToken as string,
      refreshToken: (body.refreshToken as string) ?? fallbackRefresh ?? "",
      expiresInMs: (body.expiresIn as number) ?? 0,
      savedAt: Date.now(),
    };
    await this.tokenStore.save(tokens);
  }
}
