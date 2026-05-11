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

interface LoginSessionResponse {
  user: User
  expiresIn: number
}

export const useAuthStore = defineStore('auth', () => {
  const userCookie = useCookie<User | null>('stocka_user', {
    sameSite: 'lax',
    secure: !import.meta.dev
  })

  const isAuthenticated = computed(() => !!userCookie.value)

  function setSession(payload: LoginSessionResponse) {
    userCookie.value = payload.user
  }

  async function routeAfterAuth() {
    const orgs = useOrganizationsStore()
    const localePath = useLocalePath()
    await orgs.fetchList()
    if (orgs.list.length === 0) {
      await navigateTo(localePath('/dashboard/crear-organizacion'))
    } else {
      await navigateTo(localePath('/dashboard'))
    }
  }

  async function login(payload: LoginUserDto) {
    const api = useApi()
    const data = await api<LoginSessionResponse>('/auth/login', {
      method: 'POST',
      body: payload
    })
    setSession(data)
    await routeAfterAuth()
  }

  async function loginNoRedirect(payload: LoginUserDto) {
    const api = useApi()
    const data = await api<LoginSessionResponse>('/auth/login', {
      method: 'POST',
      body: payload
    })
    setSession(data)
    const orgs = useOrganizationsStore()
    await orgs.fetchList()
  }

  async function signup(payload: RegisterUserDto) {
    const api = useApi()
    const localePath = useLocalePath()
    await api<User>('/auth/signup', {
      method: 'POST',
      body: payload
    })
    await navigateTo({
      path: localePath('/login'),
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
    useLocationsStore().reset()
    usePiecesStore().reset()
    useTeamStore().reset()
  }

  async function logout() {
    const api = useApi()
    const localePath = useLocalePath()
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // logout is fire-and-forget; clear local session regardless
    }
    clearLocalSession()
    await navigateTo(localePath('/login'))
  }

  return {
    user: userCookie,
    isAuthenticated,
    setSession,
    login,
    loginNoRedirect,
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
    clearLocalSession
  }
})
