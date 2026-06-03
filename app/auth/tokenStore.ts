/**
 * Secure storage for the desktop session tokens. The desktop app has no cookie jar, so it holds
 * the access + refresh tokens itself (DECISIONS-AND-RISKS D4). In production a Tauri keychain-backed
 * implementation is injected; tests and the web fallback use the in-memory one.
 */

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in milliseconds (the backend `expiresIn`). */
  expiresInMs: number;
  /** Epoch millis when these tokens were stored, used to detect near-expiry. */
  savedAt: number;
}

export interface TokenStore {
  load(): Promise<SessionTokens | null>;
  save(tokens: SessionTokens): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory token store. Used in tests and as a non-persistent fallback; the real desktop build
 * injects a keychain-backed store (Keychain on macOS, Credential Manager on Windows) via a Tauri
 * plugin so tokens never touch disk in clear text.
 */
export class MemoryTokenStore implements TokenStore {
  private tokens: SessionTokens | null = null;

  async load(): Promise<SessionTokens | null> {
    return this.tokens;
  }

  async save(tokens: SessionTokens): Promise<void> {
    this.tokens = tokens;
  }

  async clear(): Promise<void> {
    this.tokens = null;
  }
}
