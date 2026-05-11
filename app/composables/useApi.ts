import type { FetchOptions } from 'ofetch'

const PUBLIC_SEGMENTS = ['/login', '/registro', '/recuperar-password', '/restablecer-password']
const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup']

function stripLocalePrefix(path: string): string {
  const m = path.match(/^\/(en|ca)(\/|$)/)
  if (!m) return path
  const stripped = path.slice(m[0]!.length - 1)
  return stripped || '/'
}

function requestUrl(req: unknown): string {
  if (typeof req === 'string') return req
  if (req instanceof URL) return req.toString()
  if (req instanceof Request) return req.url
  return ''
}

function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINTS.some(seg => url.includes(seg))
}

type I18nLike = { locale: { value: string } | string }
type LocalePathFn = (path: string) => string

export function useApi() {
  const auth = useAuthStore()
  const nuxtApp = useNuxtApp()

  const readLocale = (): string => {
    const i18n = nuxtApp.$i18n as I18nLike | undefined
    if (!i18n) return 'es'
    const loc = i18n.locale
    return typeof loc === 'string' ? loc : loc.value
  }

  const resolveLocalePath = (path: string): string => {
    const fn = nuxtApp.$localePath as LocalePathFn | undefined
    return fn ? fn(path) : path
  }

  const options: FetchOptions = {
    baseURL: '/api',
    onRequest({ options, request }) {
      const headers = new Headers(options.headers as HeadersInit | undefined)

      if (!headers.has('Accept-Language')) {
        headers.set('Accept-Language', readLocale())
      }
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/problem+json, application/json')
      }

      options.headers = headers
      void request
    },
    onResponseError({ response, request }) {
      if (response?.status !== 401) return

      const url = requestUrl(request)
      if (isAuthEndpoint(url)) return

      const code = (response._data as { code?: string } | undefined)?.code
      const isTokenInvalid = !code || code === 'auth.unauthenticated' || code.startsWith('auth.token_')
      if (!isTokenInvalid) return

      auth.clearLocalSession()

      if (import.meta.client) {
        const raw = useRoute().path
        const path = stripLocalePrefix(raw)
        const isPublic = PUBLIC_SEGMENTS.some(p => path.startsWith(p)) || path === '/'
        if (!isPublic) {
          navigateTo(resolveLocalePath('/login'))
        }
      }
    }
  }

  return $fetch.create(options)
}
