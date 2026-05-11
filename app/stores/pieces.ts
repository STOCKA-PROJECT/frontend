import { defineStore } from 'pinia'
import type {
  CreatePieceDto,
  Page,
  PieceAttachmentKind,
  PieceAttachmentResponseDto,
  PieceHistoryItemDto,
  PieceListFilters,
  PieceListItemDto,
  PieceResponseDto,
  UpdatePieceDto,
  UpdatePieceLocationDto
} from '~/types/api'

const UNASSIGNED_KEY = -1

const DEFAULT_FILTERS: PieceListFilters = {
  page: 0,
  size: 20,
  sort: 'updatedAt,desc'
}

export const usePiecesStore = defineStore('pieces', () => {
  // Bucket por ubicación (usado por el dashboard) — se conserva tal cual.
  const byLocation = ref<Record<number, PieceListItemDto[]>>({})
  const loadingFor = ref<number | null>(null)

  // Listado paginado con filtros
  const list = ref<PieceListItemDto[]>([])
  const pageMeta = ref<Page<PieceListItemDto> | null>(null)
  const filters = ref<PieceListFilters>({ ...DEFAULT_FILTERS })
  const loadingList = ref(false)

  // Detalle por id
  const detailById = ref<Record<number, PieceResponseDto>>({})
  const loadingDetail = ref<number | null>(null)

  // Historial paginado por pieza
  const historyByPiece = ref<Record<number, Page<PieceHistoryItemDto>>>({})
  const loadingHistory = ref<number | null>(null)

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

  function buildListParams(f: PieceListFilters): Record<string, string | number> {
    const params: Record<string, string | number> = {
      page: f.page ?? 0,
      size: f.size ?? 20,
      sort: f.sort ?? 'updatedAt,desc'
    }
    if (f.typeId != null) params.typeId = f.typeId
    if (f.locationId != null) params.locationId = f.locationId
    if (f.ownerUserId != null) params.ownerUserId = f.ownerUserId
    if (f.status) params.status = f.status
    if (f.q && f.q.trim().length > 0) params.q = f.q.trim()
    return params
  }

  async function fetchList(orgId: number, partial?: Partial<PieceListFilters>) {
    if (partial) {
      filters.value = { ...filters.value, ...partial }
    }
    const api = useApi()
    loadingList.value = true
    try {
      const page = await api<Page<PieceListItemDto>>(`/organizations/${orgId}/pieces`, {
        params: buildListParams(filters.value)
      })
      list.value = page.content
      pageMeta.value = page
      return page
    } finally {
      loadingList.value = false
    }
  }

  function setFilters(orgId: number, patch: Partial<PieceListFilters>): Promise<Page<PieceListItemDto>> {
    const next: PieceListFilters = { ...filters.value, ...patch }
    // Cualquier cambio de filtro (no de página/tamaño/orden) reinicia a la primera página.
    const filterKeys: Array<keyof PieceListFilters> = ['typeId', 'locationId', 'ownerUserId', 'status', 'q']
    const filterChanged = filterKeys.some(k => k in patch && patch[k] !== filters.value[k])
    if (filterChanged) next.page = 0
    filters.value = next
    return fetchList(orgId)
  }

  function resetFilters(orgId: number) {
    filters.value = { ...DEFAULT_FILTERS }
    return fetchList(orgId)
  }

  async function fetchDetail(orgId: number, pieceId: number) {
    const api = useApi()
    loadingDetail.value = pieceId
    try {
      const piece = await api<PieceResponseDto>(`/organizations/${orgId}/pieces/${pieceId}`)
      detailById.value = { ...detailById.value, [pieceId]: piece }
      return piece
    } finally {
      loadingDetail.value = null
    }
  }

  function applyToList(piece: PieceResponseDto) {
    const item: PieceListItemDto = {
      id: piece.id,
      name: piece.name,
      pieceTypes: piece.pieceTypes,
      ownerUserId: piece.ownerUserId,
      locationId: piece.locationId,
      status: piece.status,
      createdAt: piece.createdAt,
      updatedAt: piece.updatedAt
    }
    const idx = list.value.findIndex(p => p.id === piece.id)
    if (idx >= 0) {
      const next = [...list.value]
      next[idx] = item
      list.value = next
    }
  }

  async function create(orgId: number, payload: CreatePieceDto) {
    const api = useApi()
    const created = await api<PieceResponseDto>(`/organizations/${orgId}/pieces`, {
      method: 'POST',
      body: payload
    })
    detailById.value = { ...detailById.value, [created.id]: created }
    invalidateAll()
    return created
  }

  async function update(orgId: number, pieceId: number, patch: UpdatePieceDto) {
    const api = useApi()
    const updated = await api<PieceResponseDto>(`/organizations/${orgId}/pieces/${pieceId}`, {
      method: 'PATCH',
      body: patch
    })
    detailById.value = { ...detailById.value, [updated.id]: updated }
    applyToList(updated)
    invalidateAll()
    return updated
  }

  async function softDelete(orgId: number, pieceId: number) {
    const api = useApi()
    await api(`/organizations/${orgId}/pieces/${pieceId}`, { method: 'DELETE' })
    const nextDetail = { ...detailById.value }
    delete nextDetail[pieceId]
    detailById.value = nextDetail
    list.value = list.value.filter(p => p.id !== pieceId)
    invalidateAll()
  }

  async function uploadAttachment(
    orgId: number,
    pieceId: number,
    file: File,
    kind: PieceAttachmentKind
  ) {
    const api = useApi()
    const form = new FormData()
    form.append('file', file)
    const created = await api<PieceAttachmentResponseDto>(
      `/organizations/${orgId}/pieces/${pieceId}/attachments`,
      {
        method: 'POST',
        params: { kind },
        body: form
      }
    )
    const detail = detailById.value[pieceId]
    if (detail) {
      detailById.value = {
        ...detailById.value,
        [pieceId]: { ...detail, attachments: [...detail.attachments, created] }
      }
    }
    return created
  }

  async function deleteAttachment(orgId: number, pieceId: number, attachmentId: number) {
    const api = useApi()
    await api(`/organizations/${orgId}/pieces/${pieceId}/attachments/${attachmentId}`, {
      method: 'DELETE'
    })
    const detail = detailById.value[pieceId]
    if (detail) {
      detailById.value = {
        ...detailById.value,
        [pieceId]: {
          ...detail,
          attachments: detail.attachments.filter(a => a.id !== attachmentId)
        }
      }
    }
  }

  async function fetchAttachmentBlobUrl(orgId: number, pieceId: number, attachmentId: number): Promise<string> {
    const res = await fetch(
      `/api/organizations/${orgId}/pieces/${pieceId}/attachments/${attachmentId}/download`
    )
    if (!res.ok) {
      throw new Error(`download_failed_${res.status}`)
    }
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  }

  async function fetchHistory(
    orgId: number,
    pieceId: number,
    page = 0,
    size = 20
  ) {
    const api = useApi()
    loadingHistory.value = pieceId
    try {
      const result = await api<Page<PieceHistoryItemDto>>(
        `/organizations/${orgId}/pieces/${pieceId}/history`,
        { params: { page, size } }
      )
      historyByPiece.value = { ...historyByPiece.value, [pieceId]: result }
      return result
    } finally {
      loadingHistory.value = null
    }
  }

  function reset() {
    byLocation.value = {}
    loadingFor.value = null
    list.value = []
    pageMeta.value = null
    filters.value = { ...DEFAULT_FILTERS }
    loadingList.value = false
    detailById.value = {}
    loadingDetail.value = null
    historyByPiece.value = {}
    loadingHistory.value = null
  }

  return {
    byLocation,
    loadingFor,
    fetchByLocation,
    move,
    invalidate,
    invalidateAll,
    get,

    list,
    pageMeta,
    filters,
    loadingList,
    fetchList,
    setFilters,
    resetFilters,

    detailById,
    loadingDetail,
    fetchDetail,
    create,
    update,
    softDelete,

    uploadAttachment,
    deleteAttachment,
    fetchAttachmentBlobUrl,

    historyByPiece,
    loadingHistory,
    fetchHistory,

    reset
  }
})
