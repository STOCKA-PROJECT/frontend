import { defineStore } from 'pinia'
import type {
  TwoFactorRecoveryCodesResponse,
  TwoFactorSetupResponse
} from '~/types/api'

/**
 * Pinia store wrapping the {@code /auth/2fa/*} endpoints. The store only
 * keeps in-memory state needed across the setup wizard — long-lived state
 * (the enabled flag) lives on {@code auth.user}.
 */
export const useTwoFactorStore = defineStore('twoFactor', () => {
  const setup = ref<TwoFactorSetupResponse | null>(null)
  const recoveryCodes = ref<string[] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function startSetup(): Promise<TwoFactorSetupResponse> {
    const api = useApi()
    loading.value = true
    error.value = null
    try {
      const data = await api<TwoFactorSetupResponse>('/auth/2fa/setup', {
        method: 'POST'
      })
      setup.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function confirmSetup(code: string): Promise<string[]> {
    if (!setup.value) throw new Error('setup not started')
    const api = useApi()
    loading.value = true
    error.value = null
    try {
      const data = await api<TwoFactorRecoveryCodesResponse>('/auth/2fa/confirm', {
        method: 'POST',
        body: { setupToken: setup.value.setupToken, code }
      })
      recoveryCodes.value = data.recoveryCodes
      const auth = useAuthStore()
      if (auth.user) auth.user.twoFactorEnabled = true
      return data.recoveryCodes
    } finally {
      loading.value = false
    }
  }

  async function disable(currentPassword: string, code: string): Promise<void> {
    const api = useApi()
    loading.value = true
    error.value = null
    try {
      await api('/auth/2fa/disable', {
        method: 'POST',
        body: { currentPassword, code }
      })
      const auth = useAuthStore()
      if (auth.user) auth.user.twoFactorEnabled = false
      setup.value = null
      recoveryCodes.value = null
    } finally {
      loading.value = false
    }
  }

  async function regenerateCodes(): Promise<string[]> {
    const api = useApi()
    loading.value = true
    error.value = null
    try {
      const data = await api<TwoFactorRecoveryCodesResponse>(
        '/auth/2fa/recovery-codes/regenerate',
        { method: 'POST' }
      )
      recoveryCodes.value = data.recoveryCodes
      return data.recoveryCodes
    } finally {
      loading.value = false
    }
  }

  function resetWizard() {
    setup.value = null
    recoveryCodes.value = null
    error.value = null
  }

  return { setup, recoveryCodes, loading, error, startSetup, confirmSetup, disable, regenerateCodes, resetWizard }
})
