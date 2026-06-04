import { tauriInvoke } from "../auth/tokenStore";

/** Keychain account under which the local database encryption key is stored. */
const DB_KEY_ACCOUNT = "db_key";

/** Generates a random base64 key (32 bytes) suitable as an RxDB encryption password. */
function generateKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Returns the local database encryption key, creating and persisting one in the OS keychain on
 * first run (R29). Returns {@code null} when no Tauri keychain bridge is available (web/dev), so the
 * caller opens an unencrypted database rather than blocking — Dexie has no strong at-rest
 * encryption otherwise, and losing the key only means a re-sync from the server.
 *
 * @returns the encryption key, or {@code null} when the keychain is unavailable
 */
export async function getOrCreateDbEncryptionKey(): Promise<string | null> {
  const invoke = tauriInvoke();
  if (!invoke) {
    return null;
  }
  try {
    const existing = await invoke<string | null>("keychain_load", { account: DB_KEY_ACCOUNT });
    if (existing) {
      return existing;
    }
    const key = generateKey();
    await invoke<void>("keychain_save", { value: key, account: DB_KEY_ACCOUNT });
    return key;
  } catch {
    // Keychain failure: degrade to an unencrypted database rather than blocking the app.
    return null;
  }
}
