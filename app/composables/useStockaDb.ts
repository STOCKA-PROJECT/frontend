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
 * Returns the shared desktop database for {@code accountKey}, opening it on first use. Each
 * (account, organization) gets its own database so organizations never mix locally (R28). When
 * called with no key, returns the currently-open database, or opens an offline-only {@code "local"}
 * one if none is open yet.
 *
 * @param accountKey stable per-(account,org) key; omit to reuse the currently-open database
 * @returns the ready database
 */
export function getStockaDb(accountKey?: string): Promise<StockaDatabase> {
  if (accountKey === undefined) {
    if (handle) {
      return handle.db;
    }
    accountKey = "local";
  }
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
