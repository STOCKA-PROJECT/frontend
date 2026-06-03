import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

import { createStockaDatabase, type StockaDatabase } from "./database";

/**
 * Creates the desktop offline database backed by Dexie/IndexedDB (the WebView's persistent store).
 * The database name is namespaced per signed-in account so a shared device never mixes two users'
 * organization data (DECISIONS-AND-RISKS R28).
 *
 * @param accountKey stable per-account key (e.g. the user id or email)
 * @returns the ready database
 */
export function createDesktopDatabase(accountKey: string): Promise<StockaDatabase> {
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
