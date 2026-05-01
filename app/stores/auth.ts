import { defineStore } from 'pinia'
import type {
  AvailabilityResponse,
  ForgotPasswordRequestDto,
  LoginResponseDto,
  LoginUserDto,
  RegisterUserDto,
  ResetPasswordRequestDto,
  User
} from '~/types/api'

export const useAuthStore = defineStore('auth', () => {
  const tokenCookie = useCookie<string | null>('stocka_token', {
    sameSite: 'lax',
    secure: !import.meta.dev
  })
  const userCookie = useCookie<User | null>('stocka_user', {
    sameSite: 'lax',
    secure: !import.meta.dev
  })

  const isAuthenticated = computed(() => !!tokenCookie.value && !!userCookie.value)

  function setSession(payload: LoginResponseDto) {
    tokenCookie.value = payload.token
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
    const data = await api<LoginResponseDto>('/auth/login', {
      method: 'POST',
      body: payload
    })
    setSession(data)
    await routeAfterAuth()
  }

  async function loginNoRedirect(payload: LoginUserDto) {
    const api = useApi()
    const data = await api<LoginResponseDto>('/auth/login', {
      method: 'POST',
      body: payload
    })
    setSession(data)
    const orgs = useOrganizationsStore()
    await orgs.fetchList()
  }

  async function signup(payload: RegisterUserDto) {
    const api = useApi()
    await api<User>('/auth/signup', {
      method: 'POST',
      body: payload
    })
    await login({ email: payload.email, password: payload.password })
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

  function clearLocalSession() {
    tokenCookie.value = null
    userCookie.value = null
    useOrganizationsStore().reset()
    useLocationsStore().reset()
    usePiecesStore().reset()
    useTeamStore().reset()
  }

  async function logout() {
    const api = useApi()
    const localePath = useLocalePath()
    const token = tokenCookie.value
    try {
      if (token) {
        await api('/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
      }
    } catch {
      // logout is fire-and-forget; clear local session regardless
    }
    clearLocalSession()
    await navigateTo(localePath('/login'))
  }

  return {
    user: userCookie,
    token: tokenCookie,
    isAuthenticated,
    setSession,
    login,
    loginNoRedirect,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    fetchMe,
    checkUsername,
    clearLocalSession
  }
})
