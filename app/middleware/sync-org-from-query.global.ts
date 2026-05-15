/**
 * Honors a `?org={id}` query parameter on any dashboard route by switching the active
 * organization before the page setup runs its fetches. Used by lifecycle-notification
 * emails so that a deep link to an article/location/type opens the correct org even when
 * the recipient currently has a different one selected.
 *
 * - Only acts on `/dashboard/...` paths (locale-prefixed variants included).
 * - Requires the user to be a member of the target org; otherwise the param is ignored.
 * - Falls back silently when the auth session is missing or the org list cannot load.
 */
function stripLocalePrefix(path: string): string {
  const m = path.match(/^\/(en|ca)(\/|$)/)
  return m ? path.slice(m[0]!.length - 1) : path
}

export default defineNuxtRouteMiddleware(async (to) => {
  const raw = to.query.org
  if (raw == null) return
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || value.trim() === '') return

  const targetId = Number.parseInt(value, 10)
  if (!Number.isFinite(targetId) || targetId <= 0) return

  const normalized = stripLocalePrefix(to.path)
  if (!normalized.startsWith('/dashboard')) return

  const auth = useAuthStore()
  if (!auth.isAuthenticated) return

  const orgs = useOrganizationsStore()
  if (orgs.list.length === 0) {
    try {
      await orgs.fetchList()
    } catch {
      return
    }
  }
  if (!orgs.list.some(o => o.id === targetId)) return
  if (orgs.currentId !== targetId) orgs.setCurrent(targetId)
})
