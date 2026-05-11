interface LoginBody {
  email: string
  password: string
}

interface BackendLoginResponse {
  token: string
  expiresIn: number
  user: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event)
  const base = getBackendBaseUrl()

  const data = await $fetch<BackendLoginResponse>(`${base}/auth/login`, {
    method: 'POST',
    body,
    headers: {
      'Accept-Language': getHeader(event, 'accept-language') ?? 'es'
    }
  })

  setCookie(event, 'stocka_token', data.token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'strict',
    maxAge: data.expiresIn,
    path: '/'
  })

  return { user: data.user, expiresIn: data.expiresIn }
})
