import { defineStore } from 'pinia'
import type {
  CreateLocationDto,
  LocationResponseDto,
  LocationTreeNodeDto,
  UpdateLocationDto
} from '~/types/api'

export const useLocationsStore = defineStore('locations', () => {
  const tree = ref<LocationTreeNodeDto[]>([])
  const detailById = ref<Record<number, LocationResponseDto>>({})
  const loadingTree = ref(false)

  async function fetchTree(orgSlug: string) {
    const api = useApi()
    loadingTree.value = true
    try {
      tree.value = await api<LocationTreeNodeDto[]>(`/organizations/${orgSlug}/locations/tree`)
    } finally {
      loadingTree.value = false
    }
    return tree.value
  }

  async function fetchOne(orgSlug: string, id: number) {
    const api = useApi()
    const data = await api<LocationResponseDto>(`/organizations/${orgSlug}/locations/${id}`)
    detailById.value = { ...detailById.value, [id]: data }
    return data
  }

  async function create(orgSlug: string, payload: CreateLocationDto) {
    const api = useApi()
    const created = await api<LocationResponseDto>(`/organizations/${orgSlug}/locations`, {
      method: 'POST',
      body: payload
    })
    await fetchTree(orgSlug)
    return created
  }

  async function update(orgSlug: string, id: number, payload: UpdateLocationDto) {
    const api = useApi()
    const updated = await api<LocationResponseDto>(`/organizations/${orgSlug}/locations/${id}`, {
      method: 'PATCH',
      body: payload
    })
    detailById.value = { ...detailById.value, [id]: updated }
    await fetchTree(orgSlug)
    return updated
  }

  async function softDelete(orgSlug: string, id: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/locations/${id}`, { method: 'DELETE' })
    const next = { ...detailById.value }
    delete next[id]
    detailById.value = next
    await fetchTree(orgSlug)
  }

  function reset() {
    tree.value = []
    detailById.value = {}
  }

  return {
    tree,
    detailById,
    loadingTree,
    fetchTree,
    fetchOne,
    create,
    update,
    softDelete,
    reset
  }
})
