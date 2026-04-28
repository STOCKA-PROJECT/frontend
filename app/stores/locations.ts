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

  async function fetchTree(orgId: number) {
    const api = useApi()
    loadingTree.value = true
    try {
      tree.value = await api<LocationTreeNodeDto[]>(`/organizations/${orgId}/locations/tree`)
    } finally {
      loadingTree.value = false
    }
    return tree.value
  }

  async function fetchOne(orgId: number, id: number) {
    const api = useApi()
    const data = await api<LocationResponseDto>(`/organizations/${orgId}/locations/${id}`)
    detailById.value = { ...detailById.value, [id]: data }
    return data
  }

  async function create(orgId: number, payload: CreateLocationDto) {
    const api = useApi()
    const created = await api<LocationResponseDto>(`/organizations/${orgId}/locations`, {
      method: 'POST',
      body: payload
    })
    await fetchTree(orgId)
    return created
  }

  async function update(orgId: number, id: number, payload: UpdateLocationDto) {
    const api = useApi()
    const updated = await api<LocationResponseDto>(`/organizations/${orgId}/locations/${id}`, {
      method: 'PATCH',
      body: payload
    })
    detailById.value = { ...detailById.value, [id]: updated }
    await fetchTree(orgId)
    return updated
  }

  async function softDelete(orgId: number, id: number) {
    const api = useApi()
    await api(`/organizations/${orgId}/locations/${id}`, { method: 'DELETE' })
    const next = { ...detailById.value }
    delete next[id]
    detailById.value = next
    await fetchTree(orgId)
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
