import { base64ToBlob, type AttachmentTransport } from "./attachments";
import type { PullFetch } from "./pull";
import type { PushFetch } from "./push";
import type { AttachmentSync, SyncChangesResponse, SyncMutationsResponse } from "./types";

/** Error thrown when a sync HTTP call returns a non-2xx status. */
export class SyncHttpError extends Error {
  constructor(
    readonly status: number,
    readonly phase: "pull" | "push",
  ) {
    super(`sync ${phase} failed with HTTP ${status}`);
    this.name = "SyncHttpError";
  }
}

/** Configuration for the desktop sync transport. */
export interface SyncTransportConfig {
  /** Absolute backend base URL (e.g. https://api.stocka.es); no Nitro proxy on desktop. */
  apiBaseUrl: string;
  /** Organization slug the desktop session is bound to. */
  orgSlug: string;
  /** Supplies the current access token (from the OS keychain), or null when not signed in. */
  getAccessToken?: () => string | null | Promise<string | null>;
  /** Override for the global fetch (used in tests). */
  fetchImpl?: typeof fetch;
}

/**
 * Builds the pull/push transport functions that talk directly to the backend `/sync/v1`
 * endpoints with a Bearer token. Unlike the web build there is no Nitro BFF, so the desktop app
 * calls the backend directly and attaches the token itself (DECISIONS-AND-RISKS D4).
 *
 * @param config transport configuration
 * @returns `pull` and `push` functions for the sync engine
 */
export function createSyncTransport(config: SyncTransportConfig): {
  pull: PullFetch;
  push: PushFetch;
  attachments: AttachmentTransport;
} {
  const doFetch = config.fetchImpl ?? globalThis.fetch;
  const base = `${config.apiBaseUrl.replace(/\/+$/, "")}/organizations/${encodeURIComponent(
    config.orgSlug,
  )}/sync/v1`;

  async function authHeaders(): Promise<Record<string, string>> {
    const token = config.getAccessToken ? await config.getAccessToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  const pull: PullFetch = async (since) => {
    const url = new URL(`${base}/changes`);
    if (since) {
      url.searchParams.set("since", since);
    }
    const response = await doFetch(url.toString(), { headers: await authHeaders() });
    if (!response.ok) {
      throw new SyncHttpError(response.status, "pull");
    }
    return (await response.json()) as SyncChangesResponse;
  };

  const push: PushFetch = async (request) => {
    const response = await doFetch(`${base}/mutations`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new SyncHttpError(response.status, "push");
    }
    return (await response.json()) as SyncMutationsResponse;
  };

  const attachments: AttachmentTransport = {
    async upload(input) {
      const form = new FormData();
      form.append("pieceSyncId", input.pieceSyncId);
      form.append("attachmentSyncId", input.attachmentSyncId);
      form.append("kind", input.kind);
      form.append("file", base64ToBlob(input.contentBase64, input.mimeType), input.originalFilename);
      const response = await doFetch(`${base}/attachments`, {
        method: "POST",
        headers: await authHeaders(),
        body: form,
      });
      if (!response.ok) {
        throw new SyncHttpError(response.status, "push");
      }
      return (await response.json()) as AttachmentSync;
    },
    async remove(attachmentSyncId) {
      const response = await doFetch(`${base}/attachments/${encodeURIComponent(attachmentSyncId)}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new SyncHttpError(response.status, "push");
      }
    },
  };

  return { pull, push, attachments };
}
