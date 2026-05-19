/**
 * Builds locale-aware URLs under `/dashboard/{orgSlug}/...` from the active org in the
 * route. Pass {@code overrideSlug} to point at a different org (used by the org switcher).
 *
 * Falls back to `/dashboard` (the redirector page) when no slug is in the route and no
 * override is given — that page will route the user to their last-used or first org.
 */
export function useOrgPath() {
  const route = useRoute()
  const localePath = useLocalePath()

  function orgPath(subpath = '', overrideSlug?: string | null): string {
    const slug = overrideSlug ?? (typeof route.params.orgSlug === 'string' ? route.params.orgSlug : null)
    if (!slug) return localePath('/dashboard')
    const clean = subpath.startsWith('/') ? subpath : subpath ? `/${subpath}` : ''
    return localePath(`/dashboard/${slug}${clean}`)
  }

  return { orgPath }
}
