import { defineStore } from 'pinia'
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
  // Lives as long as the longest refresh cookie (30 days with "remember me") so a closed
  // browser does not look logged out while the httpOnly session is still valid; useApi
  // clears it as soon as a refresh fails.
  const userCookie = useCookie<User | null>('stocka_user', {
    sameSite: 'lax',
    secure: !import.meta.dev,
    maxAge: 60 * 60 * 24 * 30
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

  /**
   * Navigates once a session exists: to {@code next} when the caller carries a safe
   * destination (deep link, invitation…), otherwise to the dashboard or to the
   * organization wizard when the user has none.
   *
   * @param next same-origin path requested before logging in, if any
   */
  async function routeAfterAuth(next?: string | null) {
    const orgs = useOrganizationsStore()
    await orgs.fetchList()
    const destination = safeNextPath(next)
    if (destination) {
      await navigateTo(destination)
    } else if (orgs.list.length === 0) {
      await navigateTo(resolveLocalePath('/dashboard/crear-organizacion'))
    } else {
      await navigateTo(resolveLocalePath('/dashboard'))
    }
  }

  /**
   * Authenticates with email + password. Sets the session and returns {@code null}, or
   * returns the 2FA challenge without a session. Never navigates: the caller decides
   * (see {@link routeAfterAuth}).
   */
  async function login(payload: LoginUserDto): Promise<LoginChallengeResponse | null> {
    const api = useApi()
    const data = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: payload
    })
    if (isChallengeResponse(data)) {
      return data
    }
    setSession(data)
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
    const api = useApi()
    const data = await api<LoginSessionResponse>('/auth/login/2fa', {
      method: 'POST',
      body: { mfaToken, code, rememberMe }
    })
    setSession(data)
  }

  /**
   * Registers the user and sends them to the login page. {@code next} travels to the
   * backend too, so the verification email brings the user back to it.
   */
  async function signup(payload: RegisterUserDto, next?: string | null) {
    const api = useApi()
    await api<User>('/auth/signup', {
      method: 'POST',
      body: { ...payload, ...nextQuery(next) }
    })
    await navigateTo({
      path: resolveLocalePath('/login'),
      query: { registered: 'ok', email: payload.email, ...nextQuery(next) }
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
      await login({ email, password: payload.newPassword })
    }
  }

  function clearLocalSession() {
    userCookie.value = null
    useOrganizationsStore().reset()
  }

  /**
   * Ends the session and goes to the login page.
   *
   * @param next same-origin path to reopen after signing in again (switching accounts
   *             on an invitation or on a link of another organization)
   */
  async function logout(next?: string | null) {
    await endSession()
    await navigateTo(withNext(resolveLocalePath('/login'), next))
  }

  /** Revokes the session on the server (best effort) and forgets it locally, without navigating. */
  async function endSession() {
    const api = useApi()
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // logout is fire-and-forget; clear local session regardless
    }
    clearLocalSession()
  }

  return {
    user: userCookie,
    isAuthenticated,
    setSession,
    login,
    submit2faChallenge,
    signup,
    logout,
    endSession,
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
