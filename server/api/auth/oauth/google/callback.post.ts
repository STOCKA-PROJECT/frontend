import { deleteCookie, getCookie } from 'h3'

interface CallbackBody {
  code: string
  state: string
  rememberMe?: boolean
}

interface BackendLoginResponse {
  accessToken: string
  expiresIn: number
  user: unknown
}

const STATE_COOKIE = 'stocka_oauth_state'

/**
 * Completes the Google OAuth flow. Forwards the BFF's state cookie back to
 * the backend so its own state-matching logic can verify the CSRF defense,
 * then mirrors the {@code stocka_token} + {@code stocka_refresh} cookies the
 * regular login flow sets.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CallbackBody>(event)
  const base = getBackendBaseUrl()
  const stateCookie = getCookie(event, STATE_COOKIE)

  let response: Awaited<ReturnType<typeof $fetch.raw<BackendLoginResponse>>>
  try {
    response = await $fetch.raw<BackendLoginResponse>(`${base}/auth/oauth/google/callback`, {
      method: 'POST',
      body,
      headers: {
        'Accept-Language': getHeader(event, 'accept-language') ?? 'es',
        ...(stateCookie ? { cookie: `${STATE_COOKIE}=${stateCookie}` } : {})
      }
    })
  } catch (err) {
    deleteCookie(event, STATE_COOKIE, { path: '/api/auth' })
    return forwardBackendError(event, err)
  }

  const data = response._data
  if (!data) {
    deleteCookie(event, STATE_COOKIE, { path: '/api/auth' })
    return forwardBackendError(event, new Error('empty backend response'))
  }
  const refresh = extractRefreshFromBackend(response.headers)
  if (!refresh) {
    deleteCookie(event, STATE_COOKIE, { path: '/api/auth' })
    return forwardBackendError(event, new Error('refresh cookie missing in backend response'))
  }

  setAuthCookies(event, data.accessToken, data.expiresIn, refresh.value, refresh.maxAge)
  deleteCookie(event, STATE_COOKIE, { path: '/api/auth' })
  return { user: data.user, expiresIn: data.expiresIn }
})
