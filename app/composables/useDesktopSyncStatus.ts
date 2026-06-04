import type { Subscription } from "rxjs";
import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from "vue";

import type { DesktopSession } from "~/auth/desktopSession";
import type { StockaDatabase } from "~/db/database";
import { createSyncRunner } from "~/sync/runner";

/** Reactive offline-sync status for the desktop shell (badges + a manual trigger). */
export interface DesktopSyncStatus {
  /** Whether this is the desktop build (the badge renders only then). */
  isDesktop: boolean;
  /** Mutations + binaries still queued for push. */
  pending: ComputedRef<number>;
  /** Dead-lettered (rejected) items needing user attention (R8). */
  failed: ComputedRef<number>;
  /** Whether a sync is currently running. */
  syncing: Ref<boolean>;
  /** Whether the last attempt reached the server (best-effort connectivity signal). */
  online: Ref<boolean>;
  /** Epoch millis of the last successful sync. */
  lastSyncedAt: Ref<number | null>;
  /** Runs one synchronization now (push + pull); coalesces concurrent calls. */
  syncNow: () => Promise<void>;
}

/**
 * Tracks the open organization's outbox and attachment queue (pending/failed counts) and exposes a
 * manual {@code syncNow}. Desktop-only: on the web build it returns inert state so the badge can be
 * mounted unconditionally. Rebinds its RxDB subscriptions when the active organization changes and
 * tears them down on scope dispose.
 *
 * @returns reactive sync status and a trigger
 */
export function useDesktopSyncStatus(): DesktopSyncStatus {
  const config = useRuntimeConfig();
  const isDesktop = !!config.public.desktop;

  const pendingOutbox = ref(0);
  const pendingBinaries = ref(0);
  const failedOutbox = ref(0);
  const failedBinaries = ref(0);
  const syncing = ref(false);
  const online = ref(true);
  const lastSyncedAt = ref<number | null>(null);

  const pending = computed(() => pendingOutbox.value + pendingBinaries.value);
  const failed = computed(() => failedOutbox.value + failedBinaries.value);

  if (!isDesktop || !import.meta.client) {
    return { isDesktop, pending, failed, syncing, online, lastSyncedAt, syncNow: async () => {} };
  }

  const auth = useAuthStore();
  const { org } = useCurrentOrg();
  const apiBaseUrl = String(config.public.apiBaseUrl ?? "");

  let subs: Subscription[] = [];
  let boundDb: StockaDatabase | null = null;
  let boundSlug: string | undefined;

  function clearSubs() {
    subs.forEach((s) => s.unsubscribe());
    subs = [];
  }

  async function bind(slug: string | undefined) {
    if (slug === boundSlug) return;
    boundSlug = slug;
    clearSubs();
    pendingOutbox.value = 0;
    pendingBinaries.value = 0;
    failedOutbox.value = 0;
    failedBinaries.value = 0;
    boundDb = null;
    if (!slug) return;

    const userId = auth.user?.id ?? "anon";
    const { getStockaDb } = await import("~/composables/useStockaDb");
    const db = await getStockaDb(`u_${userId}_${slug}`);
    // A newer bind may have superseded this one while the DB was opening.
    if (boundSlug !== slug) return;
    boundDb = db;

    subs.push(db.outbox.find({ selector: { status: "pending" } }).$.subscribe((d) => (pendingOutbox.value = d.length)));
    subs.push(db.outbox.find({ selector: { status: "failed" } }).$.subscribe((d) => (failedOutbox.value = d.length)));
    subs.push(db.attachmentQueue.find({ selector: { status: "pending" } }).$.subscribe((d) => (pendingBinaries.value = d.length)));
    subs.push(db.attachmentQueue.find({ selector: { status: "failed" } }).$.subscribe((d) => (failedBinaries.value = d.length)));
  }

  async function syncNow(): Promise<void> {
    if (syncing.value || !boundDb || !boundSlug) return;
    syncing.value = true;
    try {
      const session = (useNuxtApp().$stockaSync as { session?: DesktopSession } | undefined)?.session;
      const runner = createSyncRunner({
        db: boundDb,
        apiBaseUrl,
        orgSlug: boundSlug,
        getAccessToken: () => session?.getValidAccessToken() ?? null,
      });
      await runner.run();
      online.value = true;
      lastSyncedAt.value = Date.now();
    } catch {
      online.value = false;
    } finally {
      syncing.value = false;
    }
  }

  const onOnline = () => {
    online.value = true;
    void syncNow();
  };
  const onOffline = () => {
    online.value = false;
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  online.value = navigator.onLine;

  watch(() => org.value?.slug, (slug) => void bind(slug), { immediate: true });

  onScopeDispose(() => {
    clearSubs();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  });

  return { isDesktop, pending, failed, syncing, online, lastSyncedAt, syncNow };
}
