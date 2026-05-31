interface LoginTwoFactorBody {
  mfaToken: string
  code: string
  rememberMe?: boolean
}

interface BackendLoginResponse {
  accessToken: string
  expiresIn: number
  user: unknown
}

/**
 * BFF wrapper for the 2FA challenge step. Same shape as the
 * {@code /api/auth/login} success path — sets both cookies and returns
 * {@code { user, expiresIn }}.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<LoginTwoFactorBody>(event)
  const base = getBackendBaseUrl()

  let response: Awaited<ReturnType<typeof $fetch.raw<BackendLoginResponse>>>
  try {
    response = await $fetch.raw<BackendLoginResponse>(`${base}/auth/login/2fa`, {
      method: 'POST',
      body,
      headers: {
        'Accept-Language': getHeader(event, 'accept-language') ?? 'es'
      }
    })
  } catch (err) {
    return forwardBackendError(event, err)
  }

  const data = response._data
  if (!data) {
    return forwardBackendError(event, new Error('empty backend response'))
  }
  const refresh = extractRefreshFromBackend(response.headers)
  if (!refresh) {
    return forwardBackendError(event, new Error('refresh cookie missing in backend response'))
  }

  setAuthCookies(event, data.accessToken, data.expiresIn, refresh.value, refresh.maxAge)
  return { user: data.user, expiresIn: data.expiresIn }
})
