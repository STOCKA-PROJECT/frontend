import { defineStore } from 'pinia'
import type { Page, PieceListItemDto, UpdatePieceLocationDto } from '~/types/api'

const UNASSIGNED_KEY = -1

export const usePiecesStore = defineStore('pieces', () => {
  const byLocation = ref<Record<number, PieceListItemDto[]>>({})
  const loadingFor = ref<number | null>(null)

  function bucketKey(locationId: number | null): number {
    return locationId == null ? UNASSIGNED_KEY : locationId
  }

  async function fetchByLocation(orgId: number, locationId: number | null) {
    const api = useApi()
    const key = bucketKey(locationId)
    loadingFor.value = key
    try {
      const params: Record<string, string | number> = {
        page: 0,
        size: 100,
        sort: 'updatedAt,desc'
      }
      if (locationId != null) params.locationId = locationId
      const page = await api<Page<PieceListItemDto>>(`/organizations/${orgId}/pieces`, { params })
      const filtered = locationId == null
        ? page.content.filter(p => p.locationId == null)
        : page.content
      byLocation.value = { ...byLocation.value, [key]: filtered }
      return filtered
    } finally {
      loadingFor.value = null
    }
  }

  async function move(orgId: number, pieceId: number, target: UpdatePieceLocationDto) {
    const api = useApi()
    await api(`/organizations/${orgId}/pieces/${pieceId}`, {
      method: 'PATCH',
      body: target
    })
  }

  function invalidate(locationId: number | null) {
    const key = bucketKey(locationId)
    const next = { ...byLocation.value }
    delete next[key]
    byLocation.value = next
  }

  function invalidateAll() {
    byLocation.value = {}
  }

  function get(locationId: number | null): PieceListItemDto[] | undefined {
    return byLocation.value[bucketKey(locationId)]
  }

  function reset() {
    byLocation.value = {}
    loadingFor.value = null
  }

  return {
    byLocation,
    loadingFor,
    fetchByLocation,
    move,
    invalidate,
    invalidateAll,
    get,
    reset
  }
})
