import { defineStore } from 'pinia'
import type {
  CreateTimelineDto,
  TimelineResponseDto,
  UpdateTimelineDto
} from '~/types/api'
import { slugifyOrgName } from '~/composables/useSlugify'
import { filenameFromContentDisposition, restoreJsonErrorBody } from '~/utils/download'

/** Bytes of a file served by the backend plus the name it should be saved under. */
export interface DownloadedFile {
  blob: Blob
  filename: string
}

const BUNDLE_ACCEPT = 'application/zip, application/problem+json, application/json'
const SHOW_ACCEPT = 'application/json, application/problem+json'

function fileBaseName(timeline: TimelineResponseDto): string {
  return slugifyOrgName(timeline.name, 48) || `timeline-${timeline.id}`
}

export const useTimelinesStore = defineStore('timelines', () => {
  const list = ref<TimelineResponseDto[]>([])
  const loading = ref(false)

  async function fetchList(orgSlug: string) {
    const api = useApi()
    loading.value = true
    try {
      list.value = await api<TimelineResponseDto[]>(`/organizations/${orgSlug}/timelines`)
    } finally {
      loading.value = false
    }
    return list.value
  }

  async function create(orgSlug: string, payload: CreateTimelineDto) {
    const api = useApi()
    const created = await api<TimelineResponseDto>(`/organizations/${orgSlug}/timelines`, {
      method: 'POST',
      body: payload
    })
    await fetchList(orgSlug)
    return created
  }

  async function update(orgSlug: string, id: number, payload: UpdateTimelineDto) {
    const api = useApi()
    const updated = await api<TimelineResponseDto>(`/organizations/${orgSlug}/timelines/${id}`, {
      method: 'PATCH',
      body: payload
    })
    await fetchList(orgSlug)
    return updated
  }

  async function softDelete(orgSlug: string, id: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/timelines/${id}`, { method: 'DELETE' })
    await fetchList(orgSlug)
  }

  /**
   * Fetches a file through the BFF (`/api/...`), so the httpOnly session cookie is
   * exchanged for the backend `Authorization` header by the proxy and the usual
   * 401 → refresh → retry flow of `useApi()` applies. The name comes from the
   * `Content-Disposition` header when the backend sends one.
   */
  async function fetchFile(path: string, accept: string, fallbackName: string): Promise<DownloadedFile> {
    if (import.meta.server) throw new Error('download_unavailable_on_server')
    const api = useApi()
    let filename = fallbackName
    try {
      const blob = await api<Blob>(path, {
        responseType: 'blob',
        headers: { Accept: accept },
        onResponse({ response }) {
          if (!response.ok) return
          filename = filenameFromContentDisposition(response.headers.get('content-disposition')) ?? fallbackName
        }
      })
      return { blob, filename }
    } catch (err) {
      await restoreJsonErrorBody(err)
      throw err
    }
  }

  /**
   * Downloads the self-contained `.belen.zip` bundle of a timeline (show + assets).
   * Rejects with a `FetchError` carrying the ProblemDetail body: 404 when the timeline
   * has no scene, 422 (with `issues`) when the scene has blocking errors.
   */
  function downloadBundle(orgSlug: string, timeline: TimelineResponseDto): Promise<DownloadedFile> {
    return fetchFile(
      `/organizations/${orgSlug}/timelines/${timeline.id}/bundle`,
      BUNDLE_ACCEPT,
      `${fileBaseName(timeline)}.belen.zip`
    )
  }

  /** Downloads the generated `show.json` of a timeline, byte-for-byte as the backend serves it. */
  function downloadShow(orgSlug: string, timeline: TimelineResponseDto): Promise<DownloadedFile> {
    return fetchFile(
      `/organizations/${orgSlug}/timelines/${timeline.id}/show`,
      SHOW_ACCEPT,
      `${fileBaseName(timeline)}.show.json`
    )
  }

  function reset() {
    list.value = []
  }

  return {
    list,
    loading,
    fetchList,
    create,
    update,
    softDelete,
    downloadBundle,
    downloadShow,
    reset
  }
})
