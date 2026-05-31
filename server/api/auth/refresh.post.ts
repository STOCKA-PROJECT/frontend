interface BackendRefreshResponse {
  accessToken: string
  expiresIn: number
  user: unknown
}

/**
 * BFF endpoint for the refresh-token rotation. Reads the {@code stocka_refresh}
 * cookie, forwards it to the backend's {@code /auth/refresh}, then rewrites the
 * pair of BFF cookies with the rotated values.
 *
 * Returns the same shape as {@code /api/auth/login} so the frontend store can
 * reuse {@code setSession(payload)} after a refresh.
 */
export default defineEventHandler(async (event) => {
  const base = getBackendBaseUrl()
  const refreshCookie = getRefreshCookie(event)

  if (!refreshCookie) {
    clearAuthCookies(event)
    setResponseStatus(event, 401, 'Unauthorized')
    setResponseHeader(event, 'content-type', 'application/problem+json')
    return {
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      code: 'auth.refresh_token_missing',
      detail: 'No hay sesión activa para refrescar.'
    }
  }

  let response: Awaited<ReturnType<typeof $fetch.raw<BackendRefreshResponse>>>
  try {
    response = await $fetch.raw<BackendRefreshResponse>(`${base}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Accept-Language': getHeader(event, 'accept-language') ?? 'es',
        cookie: `stocka_refresh=${refreshCookie}`
      }
    })
  } catch (err) {
    // Any backend failure (invalid / expired / reused) means the session is
    // unrecoverable from the browser's side. Clear the BFF cookies so the
    // next request goes through /login again.
    clearAuthCookies(event)
    return forwardBackendError(event, err)
  }

  const data = response._data
  if (!data) {
    clearAuthCookies(event)
    return forwardBackendError(event, new Error('empty backend response'))
  }
  const rotated = extractRefreshFromBackend(response.headers)
  if (!rotated) {
    clearAuthCookies(event)
    return forwardBackendError(event, new Error('refresh cookie missing in backend response'))
  }

  setAuthCookies(event, data.accessToken, data.expiresIn, rotated.value, rotated.maxAge)
  return { user: data.user, expiresIn: data.expiresIn }
})
