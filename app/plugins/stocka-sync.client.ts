import { DesktopSession } from "../auth/desktopSession";
import { MemoryTokenStore, type TokenStore } from "../auth/tokenStore";
import { createDesktopDatabase } from "../db/desktopDatabase";
import type { StockaDatabase } from "../db/database";
import { createSyncRunner, type SyncRunner } from "../sync/runner";

/**
 * Desktop (Tauri) bootstrap for offline sync. Client-only and active only on the desktop target
 * ({@code runtimeConfig.public.desktop}); the web build is untouched and keeps using the Nitro BFF.
 *
 * Provides {@code $stockaSync}: the {@link DesktopSession} (Bearer + keychain auth, D4) plus
 * factories the app calls after login to open the per-account database and a per-organization
 * {@link SyncRunner}. The session, database and runner are created lazily because the account
 * (database namespace, R28) and organization are only known post-login.
 *
 * <p><strong>Token storage:</strong> defaults to a non-persistent in-memory store. Production
 * must inject a keychain-backed {@link TokenStore} (macOS Keychain / Windows Credential Manager via
 * a Tauri plugin) by replacing {@code tokenStore} below, so the session survives app restarts and
 * tokens never touch disk in clear text.
 */
export interface StockaSyncApi {
  session: DesktopSession;
  createDatabase(accountKey: string): Promise<StockaDatabase>;
  createRunner(db: StockaDatabase, orgSlug: string): SyncRunner;
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  if (!config.public.desktop) {
    return;
  }

  const apiBaseUrl = String(config.public.apiBaseUrl ?? "");

  // TODO(M-Dist): swap for a keychain-backed TokenStore (Tauri plugin) so the session persists
  // securely across restarts.
  const tokenStore: TokenStore = new MemoryTokenStore();
  const session = new DesktopSession({ apiBaseUrl, tokenStore });

  const api: StockaSyncApi = {
    session,
    createDatabase: (accountKey) => createDesktopDatabase(accountKey),
    createRunner: (db, orgSlug) =>
      createSyncRunner({
        db,
        apiBaseUrl,
        orgSlug,
        getAccessToken: () => session.getValidAccessToken(),
      }),
  };

  nuxtApp.provide("stockaSync", api);
});
