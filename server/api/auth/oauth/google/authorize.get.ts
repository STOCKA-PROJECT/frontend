import { setCookie } from 'h3'

interface BackendAuthorizeResponse {
  authorizationUrl: string
}

const STATE_COOKIE = 'stocka_oauth_state'

/**
 * Starts the Google OAuth flow. Forwards the authorize call to the backend,
 * then re-issues the state cookie under the BFF's domain + path so the
 * browser sends it back on {@code /api/auth/oauth/google/callback}.
 */
export default defineEventHandler(async (event) => {
  const base = getBackendBaseUrl()

  let response: Awaited<ReturnType<typeof $fetch.raw<BackendAuthorizeResponse>>>
  try {
    response = await $fetch.raw<BackendAuthorizeResponse>(`${base}/auth/oauth/google/authorize`, {
      method: 'GET',
      headers: {
        'Accept-Language': getHeader(event, 'accept-language') ?? 'es'
      }
    })
  } catch (err) {
    return forwardBackendError(event, err)
  }

  const data = response._data
  if (!data?.authorizationUrl) {
    return forwardBackendError(event, new Error('empty backend response'))
  }
  const state = extractCookieFromBackend(response.headers, STATE_COOKIE)
  if (!state) {
    return forwardBackendError(event, new Error('state cookie missing in backend response'))
  }

  setCookie(event, STATE_COOKIE, state.value, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    maxAge: state.maxAge,
    path: '/api/auth'
  })
  return { authorizationUrl: data.authorizationUrl }
})
