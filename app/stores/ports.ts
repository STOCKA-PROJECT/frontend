import { defineStore } from 'pinia'
import type { CreatePortDto, PortResponseDto, UpdatePortDto } from '~/types/api'

/**
 * Client-side state for the private "ports" feature. Ports are a flat, organization-scoped list;
 * each port carries its typed parameters inline, so there are no separate sub-resources to fetch.
 */
export const usePortsStore = defineStore('ports', () => {
  const byId = ref<Record<number, PortResponseDto>>({})
  const order = ref<number[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const list = computed(() =>
    order.value
      .map(id => byId.value[id])
      .filter((p): p is PortResponseDto => Boolean(p))
  )

  function upsert(port: PortResponseDto) {
    byId.value = { ...byId.value, [port.id]: port }
    if (!order.value.includes(port.id)) order.value = [...order.value, port.id]
  }

  function removeFromState(id: number) {
    const next = { ...byId.value }
    delete next[id]
    byId.value = next
    order.value = order.value.filter(x => x !== id)
  }

  async function fetchAll(orgSlug: string) {
    const api = useApi()
    loading.value = true
    try {
      const data = await api<PortResponseDto[]>(`/organizations/${orgSlug}/ports`)
      const nextById: Record<number, PortResponseDto> = {}
      const nextOrder: number[] = []
      for (const p of data) {
        nextById[p.id] = p
        nextOrder.push(p.id)
      }
      byId.value = nextById
      order.value = nextOrder
      loaded.value = true
    } finally {
      loading.value = false
    }
    return list.value
  }

  async function create(orgSlug: string, payload: CreatePortDto) {
    const api = useApi()
    const created = await api<PortResponseDto>(`/organizations/${orgSlug}/ports`, {
      method: 'POST',
      body: payload
    })
    upsert(created)
    return created
  }

  async function update(orgSlug: string, id: number, payload: UpdatePortDto) {
    const api = useApi()
    const updated = await api<PortResponseDto>(`/organizations/${orgSlug}/ports/${id}`, {
      method: 'PATCH',
      body: payload
    })
    upsert(updated)
    return updated
  }

  async function softDelete(orgSlug: string, id: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/ports/${id}`, { method: 'DELETE' })
    removeFromState(id)
  }

  function reset() {
    byId.value = {}
    order.value = []
    loading.value = false
    loaded.value = false
  }

  return { byId, order, loading, loaded, list, fetchAll, create, update, softDelete, reset }
})
