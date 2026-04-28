import type { FetchOptions } from 'ofetch'

const PUBLIC_SEGMENTS = ['/login', '/registro', '/recuperar-password', '/restablecer-password']

function stripLocalePrefix(path: string): string {
  const m = path.match(/^\/(en|ca)(\/|$)/)
  if (!m) return path
  const stripped = path.slice(m[0]!.length - 1)
  return stripped || '/'
}

export function useApi() {
  const auth = useAuthStore()
  const localePath = useLocalePath()

  const options: FetchOptions = {
    baseURL: '/api',
    onRequest({ options }) {
      const token = auth.token
      if (token) {
        const headers = new Headers(options.headers as HeadersInit | undefined)
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`)
        }
        options.headers = headers
      }
    },
    onResponseError({ response }) {
      if (response?.status !== 401) return
      auth.clearLocalSession()

      if (import.meta.client) {
        const raw = useRoute().path
        const path = stripLocalePrefix(raw)
        const isPublic = PUBLIC_SEGMENTS.some(p => path.startsWith(p)) || path === '/'
        if (!isPublic) {
          navigateTo(localePath('/login'))
        }
      }
    }
  }

  return $fetch.create(options)
}
