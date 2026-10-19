import { defineStore } from 'pinia'
import type { CreateDeviceDto, DeviceCreatedDto, DeviceResponseDto } from '~/types/api'

/**
 * Raspberry Pi players registered in an organization (`/organizations/{slug}/devices`) with the
 * last state each one reported through its heartbeat. The list is small and reloaded as a whole:
 * the devices board polls it while the tab is visible.
 */
export const useDevicesStore = defineStore('devices', () => {
  const list = ref<DeviceResponseDto[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  /** Puts `device` in the list, replacing the row with the same id or appending it. */
  function upsert(device: DeviceResponseDto) {
    const exists = list.value.some(d => d.id === device.id)
    list.value = exists
      ? list.value.map(d => (d.id === device.id ? device : d))
      : [...list.value, device]
  }

  async function load(orgSlug: string) {
    const api = useApi()
    loading.value = true
    try {
      list.value = await api<DeviceResponseDto[]>(`/organizations/${orgSlug}/devices`)
      loaded.value = true
    } finally {
      loading.value = false
    }
    return list.value
  }

  /**
   * Registers a player. The heartbeat token in the result is shown once and cannot be fetched
   * again; losing it means rotating it.
   */
  async function create(orgSlug: string, payload: CreateDeviceDto): Promise<DeviceCreatedDto> {
    const api = useApi()
    const created = await api<DeviceCreatedDto>(`/organizations/${orgSlug}/devices`, {
      method: 'POST',
      body: payload
    })
    upsert(created.device)
    return created
  }

  async function rename(orgSlug: string, id: number, name: string) {
    const api = useApi()
    const updated = await api<DeviceResponseDto>(`/organizations/${orgSlug}/devices/${id}`, {
      method: 'PATCH',
      body: { name }
    })
    upsert(updated)
    return updated
  }

  async function remove(orgSlug: string, id: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/devices/${id}`, { method: 'DELETE' })
    list.value = list.value.filter(d => d.id !== id)
  }

  /** Issues a new heartbeat token for the device; the previous one stops working at once. */
  async function rotateToken(orgSlug: string, id: number): Promise<DeviceCreatedDto> {
    const api = useApi()
    const rotated = await api<DeviceCreatedDto>(`/organizations/${orgSlug}/devices/${id}/rotate-token`, {
      method: 'POST'
    })
    upsert(rotated.device)
    return rotated
  }

  function reset() {
    list.value = []
    loading.value = false
    loaded.value = false
  }

  return { list, loading, loaded, load, create, rename, remove, rotateToken, reset }
})
