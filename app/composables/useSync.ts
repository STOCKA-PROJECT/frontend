import { onScopeDispose, ref, shallowRef, type Ref } from "vue";

import type { StockaDatabase } from "../db/database";
import type { SyncRunner } from "../sync/runner";

/** Dependencies for {@link useSync}; injected so the composable is framework-light and testable. */
export interface UseSyncDeps {
  db: StockaDatabase;
  runner: SyncRunner;
}

/** Reactive sync state and a trigger, for surfacing status (badges, "pending" count) in the UI. */
export interface UseSyncState {
  /** Whether the last sync attempt reached the server. */
  online: Ref<boolean>;
  /** Whether a sync is currently running. */
  syncing: Ref<boolean>;
  /** Number of mutations still queued in the outbox (reactive). */
  pending: Ref<number>;
  /** Number of mutations that were dead-lettered (rejected) and need user attention (R8). */
  failed: Ref<number>;
  /** The last sync error, if any. */
  lastError: Ref<unknown>;
  /** Epoch millis of the last successful sync. */
  lastSyncedAt: Ref<number | null>;
  /** Runs one synchronization (push outbox, then pull); coalesces concurrent calls. */
  sync(): Promise<void>;
}

/**
 * Composable exposing offline-sync status and a {@code sync()} trigger. Tracks the outbox pending
 * and failed counts reactively (RxDB query subscriptions) and toggles {@code online}/{@code syncing}
 * around each run. Wire it to reconnect events and a periodic timer in the app layer.
 *
 * @param deps the local database and a configured sync runner
 * @returns reactive sync state and the {@code sync()} action
 */
export function useSync(deps: UseSyncDeps): UseSyncState {
  const online = ref(true);
  const syncing = ref(false);
  const pending = ref(0);
  const failed = ref(0);
  const lastError = shallowRef<unknown>(null);
  const lastSyncedAt = ref<number | null>(null);

  const pendingSub = deps.db.outbox
    .find({ selector: { status: "pending" } })
    .$.subscribe((docs) => {
      pending.value = docs.length;
    });
  const failedSub = deps.db.outbox
    .find({ selector: { status: "failed" } })
    .$.subscribe((docs) => {
      failed.value = docs.length;
    });
  onScopeDispose(() => {
    pendingSub.unsubscribe();
    failedSub.unsubscribe();
  });

  async function sync(): Promise<void> {
    if (syncing.value) {
      return;
    }
    syncing.value = true;
    lastError.value = null;
    try {
      await deps.runner.run();
      online.value = true;
      lastSyncedAt.value = Date.now();
    } catch (error) {
      online.value = false;
      lastError.value = error;
    } finally {
      syncing.value = false;
    }
  }

  return { online, syncing, pending, failed, lastError, lastSyncedAt, sync };
}
