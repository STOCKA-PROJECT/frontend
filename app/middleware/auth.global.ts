const PROTECTED_SEGMENTS = ['/dashboard']
const GUEST_ONLY_SEGMENTS = ['/login', '/registro', '/recuperar-password']

function stripLocalePrefix(path: string): string {
  const m = path.match(/^\/(en|ca)(\/|$)/)
  return m ? path.slice(m[0]!.length === path.length ? path.length - 1 : m[0]!.length - 1) : path
}

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  const localePath = useLocalePath()
  const normalized = stripLocalePrefix(to.path) || '/'

  if (PROTECTED_SEGMENTS.some(p => normalized === p || normalized.startsWith(`${p}/`)) && !auth.isAuthenticated) {
    return navigateTo({ path: localePath('/login'), query: { redirect: to.path } })
  }

  if (GUEST_ONLY_SEGMENTS.includes(normalized) && auth.isAuthenticated) {
    return navigateTo(localePath('/dashboard'))
  }
})
