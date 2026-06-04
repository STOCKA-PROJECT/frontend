import type { DesktopSession } from "../auth/desktopSession";
import { createSyncRunner } from "../sync/runner";

/**
 * Desktop (Tauri) auto-sync on reconnect. Client-only and active only on the desktop target.
 *
 * The domain stores already run a best-effort sync after each fetch/mutation, so the outbox drains
 * whenever the user interacts. This plugin closes the remaining gap: if the user edits while offline
 * and then connectivity returns *without* any further interaction, the queued mutations would sit
 * until the next navigation. Listening to the browser `online` event drains the outbox (push + pull)
 * as soon as the network is back.
 *
 * The runner targets the per-(account, organization) database the stores use
 * (`u_{userId}_{orgSlug}`), resolved from the authenticated user and the last-used org slug cookie.
 * Everything is best-effort: with no session, no remembered org, or the network flapping back off,
 * the attempt is swallowed and the local cache keeps serving.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  if (!config.public.desktop || !import.meta.client) {
    return;
  }

  const apiBaseUrl = String(config.public.apiBaseUrl ?? "");
  const lastSlug = useCookie<string | null>("stocka_last_org_slug");
  let inFlight = false;

  async function drain(): Promise<void> {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const session = (nuxtApp.$stockaSync as { session?: DesktopSession } | undefined)?.session;
      const userId = useAuthStore().user?.id;
      const slug = lastSlug.value;
      if (!session || userId == null || !slug) {
        return;
      }
      const { getStockaDb } = await import("../composables/useStockaDb");
      const db = await getStockaDb(`u_${userId}_${slug}`);
      const runner = createSyncRunner({
        db,
        apiBaseUrl,
        orgSlug: slug,
        getAccessToken: () => session.getValidAccessToken(),
      });
      await runner.run();
    } catch {
      // Offline again / not logged in / no org yet: keep working from the local cache + outbox.
    } finally {
      inFlight = false;
    }
  }

  window.addEventListener("online", () => {
    void drain();
  });
});
