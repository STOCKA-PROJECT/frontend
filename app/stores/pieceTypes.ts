import { defineStore } from 'pinia'
import type {
  CreatePieceTypeAttributeDto,
  CreatePieceTypeDto,
  PieceTypeAttributeResponseDto,
  PieceTypeResponseDto,
  UpdatePieceTypeAttributeDto,
  UpdatePieceTypeDto
} from '~/types/api'

export const usePieceTypesStore = defineStore('pieceTypes', () => {
  const byId = ref<Record<number, PieceTypeResponseDto>>({})
  const order = ref<number[]>([])
  const loading = ref(false)
  const loaded = ref(false)

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

  async function fetchAll(orgId: number) {
    const api = useApi()
    loading.value = true
    try {
      const data = await api<PieceTypeResponseDto[]>(`/organizations/${orgId}/piece-types`)
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

  async function fetchOne(orgId: number, id: number) {
    const api = useApi()
    const data = await api<PieceTypeResponseDto>(`/organizations/${orgId}/piece-types/${id}`)
    upsert(data)
    return data
  }

  async function create(orgId: number, payload: CreatePieceTypeDto) {
    const api = useApi()
    const created = await api<PieceTypeResponseDto>(`/organizations/${orgId}/piece-types`, {
      method: 'POST',
      body: payload
    })
    upsert(created)
    return created
  }

  async function update(orgId: number, id: number, payload: UpdatePieceTypeDto) {
    const api = useApi()
    const updated = await api<PieceTypeResponseDto>(`/organizations/${orgId}/piece-types/${id}`, {
      method: 'PATCH',
      body: payload
    })
    upsert(updated)
    return updated
  }

  async function softDelete(orgId: number, id: number) {
    const api = useApi()
    await api(`/organizations/${orgId}/piece-types/${id}`, { method: 'DELETE' })
    removeFromState(id)
  }

  async function addAttribute(orgId: number, typeId: number, payload: CreatePieceTypeAttributeDto) {
    const api = useApi()
    const created = await api<PieceTypeAttributeResponseDto>(
      `/organizations/${orgId}/piece-types/${typeId}/attributes`,
      { method: 'POST', body: payload }
    )
    await fetchOne(orgId, typeId)
    return created
  }

  async function updateAttribute(
    orgId: number,
    typeId: number,
    attrId: number,
    payload: UpdatePieceTypeAttributeDto
  ) {
    const api = useApi()
    const updated = await api<PieceTypeAttributeResponseDto>(
      `/organizations/${orgId}/piece-types/${typeId}/attributes/${attrId}`,
      { method: 'PATCH', body: payload }
    )
    await fetchOne(orgId, typeId)
    return updated
  }

  async function removeAttribute(orgId: number, typeId: number, attrId: number) {
    const api = useApi()
    await api(`/organizations/${orgId}/piece-types/${typeId}/attributes/${attrId}`, {
      method: 'DELETE'
    })
    await fetchOne(orgId, typeId)
  }

  function reset() {
    byId.value = {}
    order.value = []
    loading.value = false
    loaded.value = false
  }

  return {
    byId,
    order,
    loading,
    loaded,
    list,
    fetchAll,
    fetchOne,
    create,
    update,
    softDelete,
    addAttribute,
    updateAttribute,
    removeAttribute,
    reset
  }
})
