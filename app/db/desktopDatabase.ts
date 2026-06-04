import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedKeyEncryptionCryptoJsStorage } from "rxdb/plugins/encryption-crypto-js";

import { createStockaDatabase, type StockaDatabase } from "./database";
import { getOrCreateDbEncryptionKey } from "./encryptionKey";

/**
 * Creates the desktop offline database backed by Dexie/IndexedDB (the WebView's persistent store).
 * The database name is namespaced per signed-in account so a shared device never mixes two users'
 * organization data (DECISIONS-AND-RISKS R28).
 *
 * <p>When a keychain-backed encryption key is available, the Dexie storage is wrapped so the
 * sensitive fields are encrypted at rest (R29); otherwise (web/dev without the keychain bridge) it
 * opens an unencrypted database so the app stays usable.
 *
 * @param accountKey stable per-account key (e.g. the user id or email)
 * @returns the ready database
 */
export async function createDesktopDatabase(accountKey: string): Promise<StockaDatabase> {
  const password = await getOrCreateDbEncryptionKey();
  if (password) {
    const storage = wrappedKeyEncryptionCryptoJsStorage({ storage: getRxStorageDexie() });
    return createStockaDatabase(storage, databaseName(accountKey), password);
  }
  return createStockaDatabase(getRxStorageDexie(), databaseName(accountKey));
}

/**
 * Builds a valid RxDB database name (must match {@code ^[a-z][a-z0-9_$]*$}) from an arbitrary
 * account key.
 *
 * @param accountKey arbitrary per-account identifier
 * @return a sanitized, namespaced database name
 */
export function databaseName(accountKey: string): string {
  const sanitized = (accountKey || "default")
    .toLowerCase()
    .replace(/[^a-z0-9_$]/g, "_");
  return `stocka_${sanitized}`;
}
