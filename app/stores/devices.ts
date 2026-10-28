import { defineStore } from 'pinia'
import type { CreateDeviceDto, DeviceCreatedDto, DeviceLogFileDto, DeviceResponseDto, UpdateDeviceDto } from '~/types/api'
import { restoreJsonErrorBody, triggerDownload } from '~/utils/download'

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

  /** Changes the name, the local address or the PIN; fields left out stay as they are. */
  async function update(orgSlug: string, id: number, payload: UpdateDeviceDto) {
    const api = useApi()
    const updated = await api<DeviceResponseDto>(`/organizations/${orgSlug}/devices/${id}`, {
      method: 'PATCH',
      body: payload
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

  /** The log files of a device kept in Stocka, newest day first. */
  async function logFiles(orgSlug: string, id: number): Promise<DeviceLogFileDto[]> {
    const api = useApi()
    return await api<DeviceLogFileDto[]>(`/organizations/${orgSlug}/devices/${id}/logs`)
  }

  /** The text of a log file, or only its last `tail` lines. */
  async function logText(orgSlug: string, id: number, file: string, tail?: number): Promise<string> {
    const api = useApi()
    return await api<string>(`/organizations/${orgSlug}/devices/${id}/logs/${encodeURIComponent(file)}`, {
      responseType: 'text',
      headers: { Accept: 'text/plain' },
      query: tail ? { tail } : undefined
    })
  }

  /**
   * Saves a log file, or a zip of the files of a period, in the browser. It goes through `useApi()`
   * because the session lives in an httpOnly cookie that only the BFF proxy turns into a header.
   */
  async function downloadLogs(orgSlug: string, id: number, what: { file: string } | { from: string, to: string }, fallbackName: string) {
    const api = useApi()
    const base = `/organizations/${orgSlug}/devices/${id}/logs`
    const path = 'file' in what ? `${base}/${encodeURIComponent(what.file)}` : `${base}/archive`
    const query = 'file' in what ? { download: true } : { from: what.from, to: what.to }
    try {
      const blob = await api<Blob>(path, { responseType: 'blob', query })
      triggerDownload(blob, fallbackName)
    } catch (err) {
      await restoreJsonErrorBody(err)
      throw err
    }
  }

  function reset() {
    list.value = []
    loading.value = false
    loaded.value = false
  }

  return { list, loading, loaded, load, create, update, remove, rotateToken, logFiles, logText, downloadLogs, reset }
})
