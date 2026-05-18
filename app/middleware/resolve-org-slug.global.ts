/**
 * Resolves the `:orgSlug` segment of dashboard routes against the organizations list.
 *
 * - Only runs for routes that captured an `orgSlug` param (the `[orgSlug]` folder under
 *   `/dashboard`). User-scoped pages (`mi-cuenta`, `invitaciones`, `crear-organizacion`)
 *   are siblings to `[orgSlug]` and never trigger this.
 * - Loads the org list once if it is empty (deep link, fresh tab).
 * - When the slug is unknown to the loaded list it asks the backend: if it is a
 *   historical slug, redirects 301 to the current one preserving the rest of the path
 *   and the locale prefix. If the backend rejects the slug, surfaces a 404.
 * - Remembers the slug in a cookie so the `/dashboard` redirector lands the user back
 *   on this org next time.
 */
function stripLocalePrefix(path: string): { locale: string | null; rest: string } {
  const m = path.match(/^\/(en|ca)(\/|$)/)
  if (!m) return { locale: null, rest: path }
  return { locale: m[1]!, rest: path.slice(m[0]!.length - 1) || '/' }
}

export default defineNuxtRouteMiddleware(async (to) => {
  const slugParam = to.params.orgSlug
  if (typeof slugParam !== 'string' || !slugParam) return

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

  if (orgs.findBySlug(slugParam)) {
    orgs.rememberSlug(slugParam)
    return
  }

  try {
    const lookup = await orgs.lookupBySlug(slugParam)
    if (lookup.historical) {
      const { locale, rest } = stripLocalePrefix(to.path)
      const afterSlug = rest.replace(/^\/dashboard\/[^/]+/, '')
      const localePrefix = locale ? `/${locale}` : ''
      const target = `${localePrefix}/dashboard/${lookup.currentSlug}${afterSlug}`
      orgs.rememberSlug(lookup.currentSlug)
      return navigateTo(target, { redirectCode: 301, replace: true })
    }
    orgs.rememberSlug(lookup.currentSlug)
  } catch {
    return showError({ statusCode: 404, statusMessage: 'Organización no encontrada' })
  }
})
