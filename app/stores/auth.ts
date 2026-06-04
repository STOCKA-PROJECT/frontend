import { defineStore } from 'pinia'

import type { DesktopSession } from '~/auth/desktopSession'
import type {
  AvailabilityResponse,
  ChangePasswordDto,
  ForgotPasswordRequestDto,
  LoginUserDto,
  RegisterUserDto,
  ResendVerificationRequestDto,
  ResetPasswordRequestDto,
  UpdateUserProfileDto,
  User,
  VerifyEmailRequestDto
} from '~/types/api'

/**
 * Shape returned by every BFF endpoint that establishes or refreshes a
 * session ({@code /api/auth/login}, {@code /api/auth/refresh}). The access
 * token never reaches the browser — it stays in the {@code stocka_token}
 * httpOnly cookie set by the server route.
 */
interface LoginSessionResponse {
  user: User
  expiresIn: number
}

interface LoginChallengeResponse {
  requires2fa: true
  mfaToken: string
}

type LoginResponse = LoginSessionResponse | LoginChallengeResponse

function isChallengeResponse(r: LoginResponse): r is LoginChallengeResponse {
  return (r as LoginChallengeResponse).requires2fa === true
}

type LocalePathFn = (path: string) => string

export const useAuthStore = defineStore('auth', () => {
  const userCookie = useCookie<User | null>('stocka_user', {
    sameSite: 'lax',
    secure: !import.meta.dev
  })

  const isAuthenticated = computed(() => !!userCookie.value)

  /**
   * Resolves a localized path via the Nuxt i18n plugin instance instead of
   * `useLocalePath()`. Store actions run outside any component setup scope,
   * so `useI18n()` (used internally by `useLocalePath()`) would emit
   * `[intlify] Not found parent scope.` Reaching into `$localePath` keeps the
   * resolution synchronous and silent, matching `useApi.ts`.
   */
  function resolveLocalePath(path: string): string {
    const fn = useNuxtApp().$localePath as LocalePathFn | undefined
    return fn ? fn(path) : path
  }

  function setSession(payload: LoginSessionResponse) {
    userCookie.value = payload.user
  }

  /** Whether this is the desktop (Tauri) build, which authenticates via DesktopSession (D4). */
  const isDesktop = (): boolean => !!useRuntimeConfig().public.desktop

  const desktopSession = (): DesktopSession | undefined =>
    (useNuxtApp().$stockaSync as { session?: DesktopSession } | undefined)?.session

  /** Opens the per-account offline database after a desktop login (best-effort). */
  async function bootstrapDesktop(user: User): Promise<void> {
    try {
      // Dynamic import keeps RxDB out of the web bundle (desktop-only).
      const { getStockaDb } = await import('~/composables/useStockaDb')
      await getStockaDb(String(user.id))
    } catch {
      // The DB opens regardless of connectivity; ignore transient errors.
    }
  }

  async function routeAfterAuth() {
    const orgs = useOrganizationsStore()
    await orgs.fetchList()
    if (orgs.list.length === 0) {
      await navigateTo(resolveLocalePath('/dashboard/crear-organizacion'))
    } else {
      await navigateTo(resolveLocalePath('/dashboard'))
    }
  }

  async function login(payload: LoginUserDto): Promise<LoginChallengeResponse | null> {
    if (isDesktop()) {
      const challenge = await desktopLogin(payload)
      if (challenge) return challenge
      await routeAfterAuth()
      return null
    }
    const api = useApi()
    const data = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: payload
    })
    if (isChallengeResponse(data)) {
      return data
    }
    setSession(data)
    await routeAfterAuth()
    return null
  }

  async function loginNoRedirect(payload: LoginUserDto): Promise<LoginChallengeResponse | null> {
    if (isDesktop()) {
      const challenge = await desktopLogin(payload)
      if (challenge) return challenge
      await useOrganizationsStore().fetchList()
      return null
    }
    const api = useApi()
    const data = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: payload
    })
    if (isChallengeResponse(data)) {
      return data
    }
    setSession(data)
    const orgs = useOrganizationsStore()
    await orgs.fetchList()
    return null
  }

  /**
   * Desktop login via {@link DesktopSession} (Bearer + keychain, no cookies). Returns the 2FA
   * challenge when required; otherwise sets the session and opens the offline database.
   */
  async function desktopLogin(payload: LoginUserDto): Promise<LoginChallengeResponse | null> {
    const session = desktopSession()
    if (!session) throw new Error('desktop session unavailable')
    const result = await session.login(payload.email, payload.password, payload.rememberMe ?? false)
    if (result.kind === 'twoFactor') {
      return { requires2fa: true, mfaToken: result.mfaToken }
    }
    const user = result.user as User
    setSession({ user, expiresIn: 0 })
    await bootstrapDesktop(user)
    return null
  }

  /**
   * Submits the second step of the 2FA login. On success the session is set
   * and the caller drives the redirect.
   *
   * @param mfaToken the {@code mfaToken} returned by {@link login}
   * @param code TOTP code or recovery code
   * @param rememberMe whether the resulting session should be persistent
   */
  async function submit2faChallenge(mfaToken: string, code: string, rememberMe: boolean) {
    if (isDesktop()) {
      const session = desktopSession()
      if (!session) throw new Error('desktop session unavailable')
      const user = (await session.completeTwoFactor(mfaToken, code, rememberMe)) as User
      setSession({ user, expiresIn: 0 })
      await bootstrapDesktop(user)
      return
    }
    const api = useApi()
    const data = await api<LoginSessionResponse>('/auth/login/2fa', {
      method: 'POST',
      body: { mfaToken, code, rememberMe }
    })
    setSession(data)
  }

  async function signup(payload: RegisterUserDto) {
    const api = useApi()
    await api<User>('/auth/signup', {
      method: 'POST',
      body: payload
    })
    await navigateTo({
      path: resolveLocalePath('/login'),
      query: { registered: 'ok', email: payload.email }
    })
  }

  async function verifyEmail(payload: VerifyEmailRequestDto) {
    const api = useApi()
    await api('/auth/verify-email', {
      method: 'POST',
      body: payload
    })
  }

  async function resendVerification(payload: ResendVerificationRequestDto) {
    const api = useApi()
    await api('/auth/resend-verification', {
      method: 'POST',
      body: payload
    })
  }

  async function forgotPassword(payload: ForgotPasswordRequestDto) {
    const api = useApi()
    await api('/auth/forgot-password', {
      method: 'POST',
      body: payload
    })
  }

  async function resetPassword(payload: ResetPasswordRequestDto) {
    const api = useApi()
    await api('/auth/reset-password', {
      method: 'POST',
      body: payload
    })
  }

  async function checkUsername(username: string, signal?: AbortSignal): Promise<AvailabilityResponse> {
    const api = useApi()
    return await api<AvailabilityResponse>('/auth/check-username', {
      method: 'GET',
      query: { username },
      signal
    })
  }

  async function fetchMe() {
    const api = useApi()
    const me = await api<User>('/users/me')
    userCookie.value = me
    return me
  }

  async function updateProfile(payload: UpdateUserProfileDto) {
    const api = useApi()
    const updated = await api<User>('/users/me', {
      method: 'PATCH',
      body: payload
    })
    userCookie.value = updated
    return updated
  }

  /**
   * Changes the current user's password and re-authenticates with the new
   * credentials. Re-auth is necessary because `JwtAuthenticationFilter`
   * rejects tokens issued before `passwordChangedAt`, so the cookie's token
   * is invalid as soon as the PATCH succeeds.
   */
  async function changePassword(payload: ChangePasswordDto) {
    const api = useApi()
    const email = userCookie.value?.email
    await api('/users/me/password', { method: 'PATCH', body: payload })
    if (email) {
      await loginNoRedirect({ email, password: payload.newPassword })
    }
  }

  function clearLocalSession() {
    userCookie.value = null
    useOrganizationsStore().reset()
  }

  async function logout() {
    const api = useApi()
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // logout is fire-and-forget; clear local session regardless
    }
    if (isDesktop()) {
      try {
        await desktopSession()?.logout()
      } catch {
        // ignore
      }
      const { resetStockaDb } = await import('~/composables/useStockaDb')
      await resetStockaDb()
    }
    clearLocalSession()
    await navigateTo(resolveLocalePath('/login'))
  }

  return {
    user: userCookie,
    isAuthenticated,
    setSession,
    login,
    loginNoRedirect,
    submit2faChallenge,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
    fetchMe,
    updateProfile,
    changePassword,
    checkUsername,
    clearLocalSession,
    routeAfterAuth
  }
})
