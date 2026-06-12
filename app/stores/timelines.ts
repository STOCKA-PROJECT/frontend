import { defineStore } from 'pinia'
import type {
  CreateTimelineDto,
  TimelineResponseDto,
  UpdateTimelineDto
} from '~/types/api'

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
    reset
  }
})
