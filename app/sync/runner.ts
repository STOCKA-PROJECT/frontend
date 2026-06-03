import type { StockaDatabase } from "../db/database";
import { createRxCheckpointStore } from "./checkpointStore";
import { runSync, type SyncRunResult } from "./engine";
import { createSyncTransport } from "./transport";

/** Everything needed to run synchronization against the backend for one organization. */
export interface SyncRunnerConfig {
  db: StockaDatabase;
  apiBaseUrl: string;
  orgSlug: string;
  /** Supplies a valid access token (e.g. {@code DesktopSession.getValidAccessToken}). */
  getAccessToken: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
}

/** A ready-to-use sync runner bound to one organization. */
export interface SyncRunner {
  run(): Promise<SyncRunResult>;
}

/**
 * Wires the transport (backed by the session's access token), the persistent checkpoint store and
 * the engine into a single {@link SyncRunner#run} call: push the outbox, then pull deltas. This is
 * the single entry point the UI/composable triggers (on reconnect, after writes, or periodically).
 *
 * @param config db, backend coordinates and access-token supplier
 * @returns a sync runner
 */
export function createSyncRunner(config: SyncRunnerConfig): SyncRunner {
  const transport = createSyncTransport({
    apiBaseUrl: config.apiBaseUrl,
    orgSlug: config.orgSlug,
    getAccessToken: config.getAccessToken,
    fetchImpl: config.fetchImpl,
  });
  const checkpoints = createRxCheckpointStore(config.db);

  return {
    run() {
      return runSync(config.db, {
        pull: transport.pull,
        push: transport.push,
        checkpoints,
      });
    },
  };
}
