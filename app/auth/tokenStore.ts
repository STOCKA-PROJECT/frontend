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

/** Minimal shape of the Tauri global bridge we rely on (exposed via `withGlobalTauri`). */
type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

function tauriInvoke(): TauriInvoke | null {
  const g = globalThis as unknown as {
    __TAURI__?: { core?: { invoke?: TauriInvoke } };
    __TAURI_INTERNALS__?: { invoke?: TauriInvoke };
  };
  return g.__TAURI__?.core?.invoke ?? g.__TAURI_INTERNALS__?.invoke ?? null;
}

/** Whether the app is running inside the Tauri WebView (the keychain bridge is available). */
export function isTauri(): boolean {
  return tauriInvoke() !== null;
}

/**
 * Token store backed by the OS keychain through Tauri commands (`keychain_save/load/clear`,
 * implemented with the `keyring` crate: macOS Keychain, Windows Credential Manager, Linux Secret
 * Service). Tokens never touch disk in clear text. The whole {@link SessionTokens} object is
 * serialized into a single secure entry.
 */
export class TauriKeychainTokenStore implements TokenStore {
  private readonly invoke: TauriInvoke;

  constructor(invoke?: TauriInvoke) {
    const resolved = invoke ?? tauriInvoke();
    if (!resolved) {
      throw new Error("Tauri keychain bridge unavailable");
    }
    this.invoke = resolved;
  }

  async load(): Promise<SessionTokens | null> {
    const raw = await this.invoke<string | null>("keychain_load");
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as SessionTokens;
    } catch {
      return null;
    }
  }

  async save(tokens: SessionTokens): Promise<void> {
    await this.invoke<void>("keychain_save", { value: JSON.stringify(tokens) });
  }

  async clear(): Promise<void> {
    await this.invoke<void>("keychain_clear");
  }
}

/**
 * Returns the best available token store: the OS keychain inside Tauri, an in-memory fallback
 * otherwise (web/dev/tests). Falls back to memory if constructing the keychain store fails so the
 * app stays usable even when the secure bridge is missing.
 *
 * @returns a token store
 */
export function createTokenStore(): TokenStore {
  if (isTauri()) {
    try {
      return new TauriKeychainTokenStore();
    } catch {
      // Bridge present but unusable — degrade to memory rather than blocking login.
    }
  }
  return new MemoryTokenStore();
}
