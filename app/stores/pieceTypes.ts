import { defineStore } from 'pinia'
import type {
  CreatePieceTypeActionDto,
  CreatePieceTypeAttributeDto,
  CreatePieceTypeDto,
  PieceTypeActionResponseDto,
  PieceTypeAttributeResponseDto,
  PieceTypeResponseDto,
  UpdatePieceTypeActionDto,
  UpdatePieceTypeAttributeDto,
  UpdatePieceTypeDto
} from '~/types/api'

export const usePieceTypesStore = defineStore('pieceTypes', () => {
  const byId = ref<Record<number, PieceTypeResponseDto>>({})
  const order = ref<number[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  // Actions are a separate, gated sub-resource (only available on admin-owned orgs), so they are
  // fetched on demand and kept in their own map keyed by piece-type id rather than embedded in the
  // piece type payload.
  const actionsByTypeId = ref<Record<number, PieceTypeActionResponseDto[]>>({})

  const list = computed(() =>
    order.value
      .map(id => byId.value[id])
      .filter((t): t is PieceTypeResponseDto => Boolean(t))
  )

  function upsert(type: PieceTypeResponseDto) {
    byId.value = { ...byId.value, [type.id]: type }
    if (!order.value.includes(type.id)) order.value = [...order.value, type.id]
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
      const data = await api<PieceTypeResponseDto[]>(`/organizations/${orgSlug}/piece-types`)
      const nextById: Record<number, PieceTypeResponseDto> = {}
      const nextOrder: number[] = []
      for (const t of data) {
        nextById[t.id] = t
        nextOrder.push(t.id)
      }
      byId.value = nextById
      order.value = nextOrder
      loaded.value = true
    } finally {
      loading.value = false
    }
    return list.value
  }

  async function fetchOne(orgSlug: string, id: number) {
    const api = useApi()
    const data = await api<PieceTypeResponseDto>(`/organizations/${orgSlug}/piece-types/${id}`)
    upsert(data)
    return data
  }

  async function create(orgSlug: string, payload: CreatePieceTypeDto) {
    const api = useApi()
    const created = await api<PieceTypeResponseDto>(`/organizations/${orgSlug}/piece-types`, {
      method: 'POST',
      body: payload
    })
    upsert(created)
    return created
  }

  async function update(orgSlug: string, id: number, payload: UpdatePieceTypeDto) {
    const api = useApi()
    const updated = await api<PieceTypeResponseDto>(`/organizations/${orgSlug}/piece-types/${id}`, {
      method: 'PATCH',
      body: payload
    })
    upsert(updated)
    return updated
  }

  async function softDelete(orgSlug: string, id: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/piece-types/${id}`, { method: 'DELETE' })
    removeFromState(id)
  }

  async function addAttribute(orgSlug: string, typeId: number, payload: CreatePieceTypeAttributeDto) {
    const api = useApi()
    const created = await api<PieceTypeAttributeResponseDto>(
      `/organizations/${orgSlug}/piece-types/${typeId}/attributes`,
      { method: 'POST', body: payload }
    )
    await fetchOne(orgSlug, typeId)
    return created
  }

  async function updateAttribute(
    orgSlug: string,
    typeId: number,
    attrId: number,
    payload: UpdatePieceTypeAttributeDto
  ) {
    const api = useApi()
    const updated = await api<PieceTypeAttributeResponseDto>(
      `/organizations/${orgSlug}/piece-types/${typeId}/attributes/${attrId}`,
      { method: 'PATCH', body: payload }
    )
    await fetchOne(orgSlug, typeId)
    return updated
  }

  async function removeAttribute(orgSlug: string, typeId: number, attrId: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/piece-types/${typeId}/attributes/${attrId}`, {
      method: 'DELETE'
    })
    await fetchOne(orgSlug, typeId)
  }

  async function fetchActions(orgSlug: string, typeId: number) {
    const api = useApi()
    const data = await api<PieceTypeActionResponseDto[]>(
      `/organizations/${orgSlug}/piece-types/${typeId}/actions`
    )
    actionsByTypeId.value = { ...actionsByTypeId.value, [typeId]: data }
    return data
  }

  async function addAction(orgSlug: string, typeId: number, payload: CreatePieceTypeActionDto) {
    const api = useApi()
    const created = await api<PieceTypeActionResponseDto>(
      `/organizations/${orgSlug}/piece-types/${typeId}/actions`,
      { method: 'POST', body: payload }
    )
    await fetchActions(orgSlug, typeId)
    return created
  }

  async function updateAction(
    orgSlug: string,
    typeId: number,
    actionId: number,
    payload: UpdatePieceTypeActionDto
  ) {
    const api = useApi()
    const updated = await api<PieceTypeActionResponseDto>(
      `/organizations/${orgSlug}/piece-types/${typeId}/actions/${actionId}`,
      { method: 'PATCH', body: payload }
    )
    await fetchActions(orgSlug, typeId)
    return updated
  }

  async function removeAction(orgSlug: string, typeId: number, actionId: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/piece-types/${typeId}/actions/${actionId}`, {
      method: 'DELETE'
    })
    await fetchActions(orgSlug, typeId)
  }

  function reset() {
    byId.value = {}
    order.value = []
    actionsByTypeId.value = {}
    loading.value = false
    loaded.value = false
  }

  return {
    byId,
    order,
    loading,
    loaded,
    actionsByTypeId,
    list,
    fetchAll,
    fetchOne,
    create,
    update,
    softDelete,
    addAttribute,
    updateAttribute,
    removeAttribute,
    fetchActions,
    addAction,
    updateAction,
    removeAction,
    reset
  }
})
