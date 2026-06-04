import type { FetchOptions } from 'ofetch'

import type { DesktopSession } from '~/auth/desktopSession'

const PUBLIC_SEGMENTS = ['/login', '/registro', '/recuperar-password', '/restablecer-password']
const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup', '/auth/refresh']
const REFRESHABLE_ERROR_CODES = new Set([
  'auth.token_expired',
  'auth.unauthenticated'
])

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
type ApiErrorBody = { code?: string }
type ApiFetchError = { response?: { status?: number, _data?: ApiErrorBody } }

/**
 * Module-level mutex for refresh-token rotation. Multiple concurrent requests
 * that hit a 401 only trigger a single /api/auth/refresh round-trip; everyone
 * else awaits the same in-flight promise and then retries.
 */
let refreshInFlight: Promise<boolean> | null = null

/**
 * Desktop transport: the Tauri SPA has no Nitro BFF, so it calls the backend directly with a Bearer
 * access token from the {@link DesktopSession} (no cookies). On 401 it rotates the refresh token via
 * the session and retries once. The web variant below is unchanged. See DECISIONS-AND-RISKS D4.
 */
function useDesktopApi() {
  const auth = useAuthStore()
  const nuxtApp = useNuxtApp()
  const config = useRuntimeConfig()
  const apiBaseUrl = String(config.public.apiBaseUrl ?? '')
  const session = (nuxtApp.$stockaSync as { session?: DesktopSession } | undefined)?.session

  const readLocale = (): string => {
    const i18n = nuxtApp.$i18n as I18nLike | undefined
    if (!i18n) return 'es'
    const loc = i18n.locale
    return typeof loc === 'string' ? loc : loc.value
  }

  const desktopFetch = $fetch.create({
    baseURL: apiBaseUrl,
    async onRequest({ options }) {
      const headers = new Headers(options.headers as HeadersInit | undefined)
      if (!headers.has('Accept-Language')) headers.set('Accept-Language', readLocale())
      if (!headers.has('Accept')) headers.set('Accept', 'application/problem+json, application/json')
      headers.set('X-Stocka-Client', 'desktop')
      const token = session ? await session.getValidAccessToken() : null
      if (token) headers.set('Authorization', `Bearer ${token}`)
      options.headers = headers
    }
  })

  return async <T> (
    url: Parameters<typeof desktopFetch>[0],
    opts?: Parameters<typeof desktopFetch>[1]
  ): Promise<T> => {
    try {
      return await desktopFetch<T>(url, opts)
    } catch (err) {
      const error = err as ApiFetchError
      if (error.response?.status !== 401 || isAuthEndpoint(requestUrl(url)) || !session) throw err
      try {
        await session.refresh()
      } catch {
        auth.clearLocalSession()
        if (import.meta.client) {
          const fn = nuxtApp.$localePath as LocalePathFn | undefined
          navigateTo(fn ? fn('/login') : '/login')
        }
        throw err
      }
      return await desktopFetch<T>(url, opts)
    }
  }
}

export function useApi() {
  if (useRuntimeConfig().public.desktop) {
    return useDesktopApi()
  }

  const auth = useAuthStore()
  const nuxtApp = useNuxtApp()
  const ssrCookie = import.meta.server ? useRequestHeaders(['cookie']).cookie : undefined

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

  const buildOptions = (): FetchOptions => ({
    baseURL: '/api',
    onRequest({ options, request }) {
      const headers = new Headers(options.headers as HeadersInit | undefined)

      if (!headers.has('Accept-Language')) {
        headers.set('Accept-Language', readLocale())
      }
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/problem+json, application/json')
      }
      if (ssrCookie && !headers.has('cookie')) {
        headers.set('cookie', ssrCookie)
      }

      options.headers = headers
      void request
    }
  })

  const baseFetch = $fetch.create(buildOptions())

  async function tryRefresh(): Promise<boolean> {
    // SSR can't refresh: the rotated cookies would land on the inner fetch's
    // response, not the outer document response, so the browser never sees
    // them. The error bubbles up; the next client-side interaction will
    // refresh correctly.
    if (import.meta.server) return false
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        try {
          const data = await baseFetch<{ user: unknown, expiresIn: number }>(
            '/auth/refresh',
            { method: 'POST' }
          )
          auth.setSession(data as { user: import('~/types/api').User, expiresIn: number })
          return true
        } catch {
          return false
        } finally {
          refreshInFlight = null
        }
      })()
    }
    return refreshInFlight
  }

  function handleRefreshFailure(): void {
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

  return async <T> (
    url: Parameters<typeof baseFetch>[0],
    opts?: Parameters<typeof baseFetch>[1]
  ): Promise<T> => {
    try {
      return await baseFetch<T>(url, opts)
    } catch (err) {
      const error = err as ApiFetchError
      if (error.response?.status !== 401) throw err

      const apiUrl = requestUrl(url)
      if (isAuthEndpoint(apiUrl)) throw err

      const code = error.response._data?.code
      if (code && !REFRESHABLE_ERROR_CODES.has(code)) throw err

      const refreshed = await tryRefresh()
      if (!refreshed) {
        handleRefreshFailure()
        throw err
      }
      return await baseFetch<T>(url, opts)
    }
  }
}
