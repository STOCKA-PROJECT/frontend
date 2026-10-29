/**
 * Post-login destination ("next").
 *
 * Every entry point that may land on the login page without a session (deep links from
 * emails and QR codes, invitations, expired sessions) carries where the user was going in
 * the `next` query parameter, and every page that establishes a session hands it back to
 * `auth.routeAfterAuth(next)`. Only same-origin paths are accepted, so a crafted link can
 * never bounce the user to another host after signing in.
 */

const OAUTH_NEXT_STORAGE_KEY = 'stocka_oauth_next'

/** Returns `raw` when it is a same-origin path (`/…`, never `//host`), `null` otherwise. */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null
  return raw
}

/** Query fragment `{ next }` for a safe destination, `{}` otherwise. Spread it into a route query. */
export function nextQuery(next: unknown): Record<string, string> {
  const safe = safeNextPath(next)
  return safe ? { next: safe } : {}
}

/** Route location `path?next=…` for a safe destination, bare `path` otherwise. */
export function withNext(path: string, next: unknown): { path: string, query: Record<string, string> } {
  return { path, query: nextQuery(next) }
}

/**
 * The Google flow leaves the site and comes back on `/auth/oauth/callback`, so the
 * destination survives in `sessionStorage` (same tab) instead of the URL.
 */
export function rememberOAuthNext(next: unknown): void {
  const safe = safeNextPath(next)
  try {
    if (safe) sessionStorage.setItem(OAUTH_NEXT_STORAGE_KEY, safe)
    else sessionStorage.removeItem(OAUTH_NEXT_STORAGE_KEY)
  } catch {
    // storage blocked: the user simply lands on the dashboard
  }
}

/** Reads and clears the destination stored by {@link rememberOAuthNext}. */
export function takeOAuthNext(): string | null {
  try {
    const value = sessionStorage.getItem(OAUTH_NEXT_STORAGE_KEY)
    sessionStorage.removeItem(OAUTH_NEXT_STORAGE_KEY)
    return safeNextPath(value)
  } catch {
    return null
  }
}
