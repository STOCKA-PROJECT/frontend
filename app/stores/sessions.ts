import { defineStore } from 'pinia'
import type { UserSession } from '~/types/api'

/**
 * Pinia store for the connected-devices panel (Feature 6). Talks to the
 * {@code /users/me/sessions} endpoints. Reuses the same access cookie as
 * every other authenticated call — sessions are tied to the user, not to
 * any specific cookie of their own.
 */
export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref<UserSession[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(): Promise<void> {
    const api = useApi()
    loading.value = true
    error.value = null
    try {
      sessions.value = await api<UserSession[]>('/users/me/sessions')
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function revoke(id: number): Promise<void> {
    const api = useApi()
    await api(`/users/me/sessions/${id}`, { method: 'DELETE' })
    sessions.value = sessions.value.filter(s => s.id !== id)
  }

  async function revokeAllOthers(): Promise<void> {
    const api = useApi()
    await api('/users/me/sessions', { method: 'DELETE' })
    sessions.value = sessions.value.filter(s => s.current)
  }

  async function rename(id: number, displayName: string): Promise<void> {
    const api = useApi()
    const updated = await api<UserSession>(`/users/me/sessions/${id}`, {
      method: 'PATCH',
      body: { displayName }
    })
    const idx = sessions.value.findIndex(s => s.id === id)
    if (idx !== -1) sessions.value[idx] = updated
  }

  function reset(): void {
    sessions.value = []
    loading.value = false
    error.value = null
  }

  return { sessions, loading, error, fetchAll, revoke, revokeAllOthers, rename, reset }
})
