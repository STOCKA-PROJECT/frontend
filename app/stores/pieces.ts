import { defineStore } from 'pinia'
import type {
  AttributeScope,
  CreatePieceDto,
  ImportMode,
  Page,
  PieceAttachmentKind,
  PieceAttachmentResponseDto,
  PieceAttributeFilter,
  PieceHistoryItemDto,
  PieceImportReportDto,
  PieceListFilters,
  PieceListItemDto,
  PieceResponseDto,
  SpreadsheetFormat,
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

  // Caché global de blob URLs de adjuntos. Compartido entre el listado, el
  // detalle y la pestaña de adjuntos, para evitar re-descargar la misma
  // imagen al navegar. La clave es `${orgSlug}:${pieceId}:${attachmentId}`.
  const attachmentBlobUrls = ref<Record<string, string>>({})
  // Promesas en vuelo coalescidas por clave, para no lanzar la misma
  // descarga dos veces simultáneamente.
  const attachmentBlobInFlight = ref<Record<string, Promise<string>>>({})

  function attachmentKey(orgSlug: string, pieceId: number, attachmentId: number): string {
    return `${orgSlug}:${pieceId}:${attachmentId}`
  }

  function bucketKey(locationId: number | null): number {
    return locationId == null ? UNASSIGNED_KEY : locationId
  }

  async function fetchByLocation(orgSlug: string, locationId: number | null) {
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
      const page = await api<Page<PieceListItemDto>>(`/organizations/${orgSlug}/pieces`, { params })
      const filtered = locationId == null
        ? page.content.filter(p => p.locationId == null)
        : page.content
      byLocation.value = { ...byLocation.value, [key]: filtered }
      return filtered
    } finally {
      loadingFor.value = null
    }
  }

  async function move(orgSlug: string, pieceId: number, target: UpdatePieceLocationDto) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/pieces/${pieceId}`, {
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

  /**
   * Codifica un filtro de atributo como `<scope>:<attributeId>:<v1>|<v2>|...`.
   * Cada valor se pasa por `encodeURIComponent` ANTES de unir con `|`, de modo que
   * valores con `:`, `|` o `%` nunca colisionan con los separadores (el backend
   * decodifica cada token individualmente).
   */
  function encodeAttrParam(f: PieceAttributeFilter): string {
    return `${f.scope}:${f.attributeId}:${f.values.map(v => encodeURIComponent(v)).join('|')}`
  }

  type FilterParams = Record<string, string | number | string[] | number[]>

  /**
   * Serialización única de los filtros a query params, compartida por el listado
   * y por el export para que ambos acepten exactamente el mismo contrato.
   */
  function buildFilterParams(f: PieceListFilters): FilterParams {
    const params: FilterParams = {}
    if (f.typeIds && f.typeIds.length > 0) params.typeIds = f.typeIds
    if (f.locationId != null) params.locationId = f.locationId
    if (f.ownerUserId != null) params.ownerUserId = f.ownerUserId
    if (f.status) params.status = f.status
    if (f.q && f.q.trim().length > 0) params.q = f.q.trim()
    const attrs = (f.attrs ?? []).filter(a => a.values.some(v => v !== ''))
    if (attrs.length > 0) params.attr = attrs.map(encodeAttrParam)
    return params
  }

  function buildListParams(f: PieceListFilters): FilterParams {
    return {
      page: f.page ?? 0,
      size: f.size ?? 20,
      sort: f.sort ?? 'updatedAt,desc',
      ...buildFilterParams(f)
    }
  }

  async function fetchList(orgSlug: string, partial?: Partial<PieceListFilters>) {
    if (partial) {
      filters.value = { ...filters.value, ...partial }
    }
    const api = useApi()
    loadingList.value = true
    try {
      const page = await api<Page<PieceListItemDto>>(`/organizations/${orgSlug}/pieces`, {
        params: buildListParams(filters.value)
      })
      list.value = page.content
      pageMeta.value = page
      return page
    } finally {
      loadingList.value = false
    }
  }

  function setFilters(orgSlug: string, patch: Partial<PieceListFilters>): Promise<Page<PieceListItemDto>> {
    const next: PieceListFilters = { ...filters.value, ...patch }
    // Cualquier cambio de filtro (no de página/tamaño/orden) reinicia a la primera página.
    // Comparación estructural porque typeIds/attrs son arrays.
    const filterKeys: Array<keyof PieceListFilters> = ['typeIds', 'locationId', 'ownerUserId', 'status', 'q', 'attrs']
    const filterChanged = filterKeys.some(k =>
      k in patch && JSON.stringify(patch[k] ?? null) !== JSON.stringify(filters.value[k] ?? null)
    )
    if (filterChanged) next.page = 0
    filters.value = next
    return fetchList(orgSlug)
  }

  /**
   * Upsert de un filtro de atributo dentro de `filters.attrs`. Un `values` vacío
   * (o todo en blanco) elimina el filtro de ese atributo.
   */
  function setAttributeFilter(
    orgSlug: string,
    scope: AttributeScope,
    attributeId: number,
    values: string[]
  ): Promise<Page<PieceListItemDto>> {
    const rest = (filters.value.attrs ?? [])
      .filter(a => !(a.scope === scope && a.attributeId === attributeId))
    const isEmpty = values.length === 0 || values.every(v => v === '')
    const attrs = isEmpty ? rest : [...rest, { scope, attributeId, values }]
    return setFilters(orgSlug, { attrs })
  }

  function resetFilters(orgSlug: string) {
    filters.value = { ...DEFAULT_FILTERS }
    return fetchList(orgSlug)
  }

  async function fetchDetail(orgSlug: string, pieceId: number) {
    const api = useApi()
    loadingDetail.value = pieceId
    try {
      const piece = await api<PieceResponseDto>(`/organizations/${orgSlug}/pieces/${pieceId}`)
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

  async function create(orgSlug: string, payload: CreatePieceDto) {
    const api = useApi()
    const created = await api<PieceResponseDto>(`/organizations/${orgSlug}/pieces`, {
      method: 'POST',
      body: payload
    })
    detailById.value = { ...detailById.value, [created.id]: created }
    invalidateAll()
    return created
  }

  async function update(orgSlug: string, pieceId: number, patch: UpdatePieceDto) {
    const api = useApi()
    const previousCoverId = detailById.value[pieceId]?.coverAttachmentId ?? null
    const updated = await api<PieceResponseDto>(`/organizations/${orgSlug}/pieces/${pieceId}`, {
      method: 'PATCH',
      body: patch
    })
    detailById.value = { ...detailById.value, [updated.id]: updated }
    applyToList(updated)
    invalidateAll()
    // Si la portada ha cambiado liberamos la blob URL cacheada de la anterior
    // para evitar que se acumulen mientras el usuario edita la pieza.
    const newCoverId = updated.coverAttachmentId ?? null
    if (previousCoverId != null && previousCoverId !== newCoverId) {
      revokeAttachmentBlobUrl(orgSlug, pieceId, previousCoverId)
    }
    return updated
  }

  async function softDelete(orgSlug: string, pieceId: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/pieces/${pieceId}`, { method: 'DELETE' })
    const nextDetail = { ...detailById.value }
    delete nextDetail[pieceId]
    detailById.value = nextDetail
    list.value = list.value.filter(p => p.id !== pieceId)
    invalidateAll()
  }

  // ---- Bulk import / export -------------------------------------------

  function buildExportParams(format: SpreadsheetFormat, f?: PieceListFilters): URLSearchParams {
    const params = new URLSearchParams({ format })
    if (!f) return params
    for (const [key, value] of Object.entries(buildFilterParams(f))) {
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, String(v))
      } else {
        params.set(key, String(value))
      }
    }
    return params
  }

  /**
   * Downloads the filtered piece list as a CSV/XLSX blob. Uses a raw `fetch`
   * (cookie auth, same-origin `/api` proxy) like the attachment download, since
   * the response is a binary file rather than JSON.
   */
  async function exportPieces(orgSlug: string, format: SpreadsheetFormat, f?: PieceListFilters): Promise<Blob> {
    if (import.meta.server) return Promise.reject(new Error('export_unavailable_on_server'))
    const params = buildExportParams(format, f)
    const res = await fetch(`/api/organizations/${orgSlug}/pieces/export?${params.toString()}`)
    if (!res.ok) throw new Error(`export_failed_${res.status}`)
    return res.blob()
  }

  /** Downloads an empty import template (just the column headers) as a blob. */
  async function downloadImportTemplate(orgSlug: string, format: SpreadsheetFormat): Promise<Blob> {
    if (import.meta.server) return Promise.reject(new Error('template_unavailable_on_server'))
    const res = await fetch(`/api/organizations/${orgSlug}/pieces/import/template?format=${format}`)
    if (!res.ok) throw new Error(`template_failed_${res.status}`)
    return res.blob()
  }

  /**
   * Imports pieces from a CSV/XLSX file. With `dryRun=true` the backend always
   * answers 200 with a validation report and writes nothing. With `dryRun=false`
   * it applies the import atomically (200) or rejects it (422) — in the rejected
   * case `useApi` throws a FetchError whose `response._data` is the report, which
   * the caller can surface to the user.
   */
  async function importPieces(
    orgSlug: string,
    file: File,
    format: SpreadsheetFormat,
    mode: ImportMode,
    dryRun: boolean
  ): Promise<PieceImportReportDto> {
    const api = useApi()
    const form = new FormData()
    form.append('file', file)
    const report = await api<PieceImportReportDto>(`/organizations/${orgSlug}/pieces/import`, {
      method: 'POST',
      params: { format, mode, dryRun },
      body: form
    })
    if (!dryRun && report.applied) {
      invalidateAll()
    }
    return report
  }

  async function uploadAttachment(
    orgSlug: string,
    pieceId: number,
    file: File,
    kind: PieceAttachmentKind
  ) {
    const api = useApi()
    const form = new FormData()
    form.append('file', file)
    const created = await api<PieceAttachmentResponseDto>(
      `/organizations/${orgSlug}/pieces/${pieceId}/attachments`,
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

  async function deleteAttachment(orgSlug: string, pieceId: number, attachmentId: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/pieces/${pieceId}/attachments/${attachmentId}`, {
      method: 'DELETE'
    })
    revokeAttachmentBlobUrl(orgSlug, pieceId, attachmentId)
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

  function fetchAttachmentBlobUrl(orgSlug: string, pieceId: number, attachmentId: number): Promise<string> {
    // Blob URLs son una API de navegador. En SSR no tenemos `URL.createObjectURL`
    // ni cookies de sesión, así que cortamos antes de hacer nada.
    if (import.meta.server) {
      return Promise.reject(new Error('blob_unavailable_on_server'))
    }
    const key = attachmentKey(orgSlug, pieceId, attachmentId)
    const cached = attachmentBlobUrls.value[key]
    if (cached) return Promise.resolve(cached)
    const inflight = attachmentBlobInFlight.value[key]
    if (inflight) return inflight
    const promise = (async () => {
      const res = await fetch(
        `/api/organizations/${orgSlug}/pieces/${pieceId}/attachments/${attachmentId}/download`
      )
      if (!res.ok) {
        throw new Error(`download_failed_${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      attachmentBlobUrls.value = { ...attachmentBlobUrls.value, [key]: url }
      return url
    })().finally(() => {
      const next = { ...attachmentBlobInFlight.value }
      delete next[key]
      attachmentBlobInFlight.value = next
    })
    attachmentBlobInFlight.value = { ...attachmentBlobInFlight.value, [key]: promise }
    return promise
  }

  function revokeAttachmentBlobUrl(orgSlug: string, pieceId: number, attachmentId: number) {
    const key = attachmentKey(orgSlug, pieceId, attachmentId)
    const url = attachmentBlobUrls.value[key]
    if (!url) return
    if (import.meta.client) URL.revokeObjectURL(url)
    const next = { ...attachmentBlobUrls.value }
    delete next[key]
    attachmentBlobUrls.value = next
  }

  async function fetchHistory(
    orgSlug: string,
    pieceId: number,
    page = 0,
    size = 20
  ) {
    const api = useApi()
    loadingHistory.value = pieceId
    try {
      const result = await api<Page<PieceHistoryItemDto>>(
        `/organizations/${orgSlug}/pieces/${pieceId}/history`,
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
    if (import.meta.client) {
      for (const url of Object.values(attachmentBlobUrls.value)) {
        URL.revokeObjectURL(url)
      }
    }
    attachmentBlobUrls.value = {}
    attachmentBlobInFlight.value = {}
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
    setAttributeFilter,
    resetFilters,

    detailById,
    loadingDetail,
    fetchDetail,
    create,
    update,
    softDelete,

    exportPieces,
    downloadImportTemplate,
    importPieces,

    uploadAttachment,
    deleteAttachment,
    fetchAttachmentBlobUrl,
    revokeAttachmentBlobUrl,
    attachmentBlobUrls,
    attachmentBlobInFlight,

    historyByPiece,
    loadingHistory,
    fetchHistory,

    reset
  }
})
