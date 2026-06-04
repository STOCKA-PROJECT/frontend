import { createDesktopDatabase } from "../db/desktopDatabase";
import type { StockaDatabase } from "../db/database";

/**
 * Lazily opens (once) and returns the desktop offline database, namespaced per account. The handle
 * is cached at module scope so every composable/store on the desktop target shares one RxDB
 * instance. Call {@link resetStockaDb} on logout to close it before opening another account's db.
 *
 * The web target never calls this (it uses the API via the Nitro BFF); see the desktop bootstrap
 * plugin and DECISIONS-AND-RISKS D4/R28.
 */
let handle: { accountKey: string; db: Promise<StockaDatabase> } | null = null;

/**
 * Returns the shared desktop database for {@code accountKey}, opening it on first use.
 *
 * @param accountKey stable per-account key (user id/email); defaults to {@code "local"} for an
 *                   offline-only session before login
 * @returns the ready database
 */
export function getStockaDb(accountKey = "local"): Promise<StockaDatabase> {
  if (!handle || handle.accountKey !== accountKey) {
    handle = { accountKey, db: createDesktopDatabase(accountKey) };
  }
  return handle.db;
}

/** Closes and forgets the current database (e.g. on logout / account switch). */
export async function resetStockaDb(): Promise<void> {
  if (!handle) {
    return;
  }
  const current = handle;
  handle = null;
  try {
    (await current.db).close();
  } catch {
    // Already closed/removed — ignore.
  }
}
