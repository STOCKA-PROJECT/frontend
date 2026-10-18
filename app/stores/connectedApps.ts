import { defineStore } from 'pinia'
import type { ConnectedApp } from '~/types/api'

/**
 * OAuth clients (MCP connectors such as Claude) the current user has authorized, and their
 * revocation. Backed by `GET/DELETE /users/me/connected-apps`.
 */
export const useConnectedAppsStore = defineStore('connectedApps', () => {
  const apps = ref<ConnectedApp[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(): Promise<void> {
    const api = useApi()
    loading.value = true
    error.value = null
    try {
      apps.value = await api<ConnectedApp[]>('/users/me/connected-apps')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'load_failed'
    } finally {
      loading.value = false
    }
  }

  async function revoke(clientId: string): Promise<void> {
    const api = useApi()
    await api('/users/me/connected-apps', { method: 'DELETE', query: { clientId } })
    apps.value = apps.value.filter(a => a.clientId !== clientId)
  }

  function reset() {
    apps.value = []
    loading.value = false
    error.value = null
  }

  return { apps, loading, error, fetchAll, revoke, reset }
})
