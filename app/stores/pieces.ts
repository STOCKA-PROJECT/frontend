import { defineStore } from 'pinia'

import type { DesktopSession } from '~/auth/desktopSession'
import {
  createPiece,
  deletePiece,
  updatePiece,
  type UpdatePiecePatch
} from '~/data/pieceRepository'
import type { AttachmentDoc, OrgAttributeDoc, PieceDoc, PieceTypeAttributeDoc, PieceTypeDoc } from '~/db/schemas'
import { createSyncRunner } from '~/sync/runner'
import type { AttributeValueSync } from '~/sync/types'
import type {
  AttributeScope,
  AttributeType,
  CreatePieceDto,
  Page,
  PieceAttachmentKind,
  PieceAttachmentResponseDto,
  PieceAttributeValueResponseDto,
  PieceHistoryItemDto,
  PieceListFilters,
  PieceListItemDto,
  PieceResponseDto,
  PieceStatus,
  PieceTypeRefDto,
  UpdatePieceDto,
  UpdatePieceLocationDto
} from '~/types/api'

const UNASSIGNED_KEY = -1

const DEFAULT_FILTERS: PieceListFilters = {
  page: 0,
  size: 20,
  sort: 'updatedAt,desc'
}

/**
 * Deterministic positive 32-bit id from a syncId (FNV-1a), so the desktop store can present the
 * numeric `id` the UI expects while keeping syncId as the real identity. The hash is shared with
 * the other stores (locations, pieceTypes, attributes), so a location/type/attribute numeric id
 * means the same thing everywhere. Mirrors `locations.ts`.
 */
function hashId(syncId: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < syncId.length; i++) {
    h ^= syncId.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) || 1
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

  const isDesktop = (): boolean => !!useRuntimeConfig().public.desktop

  function attachmentKey(orgSlug: string, pieceId: number, attachmentId: number): string {
    return `${orgSlug}:${pieceId}:${attachmentId}`
  }

  function bucketKey(locationId: number | null): number {
    return locationId == null ? UNASSIGNED_KEY : locationId
  }

  // --- Desktop (offline-first, RxDB) support -------------------------------------------------
  // Maps the deterministic numeric id exposed to the UI back to the real syncId.
  const idToSync = new Map<number, string>()

  function dbKeyFor(orgSlug: string): string {
    const userId = useAuthStore().user?.id ?? 'anon'
    return `u_${userId}_${orgSlug}`
  }

  async function openDb(orgSlug: string) {
    const { getStockaDb } = await import('~/composables/useStockaDb')
    return getStockaDb(dbKeyFor(orgSlug))
  }

  async function runnerFor(orgSlug: string, database: Awaited<ReturnType<typeof openDb>>) {
    const session = (useNuxtApp().$stockaSync as { session?: DesktopSession } | undefined)?.session
    const apiBaseUrl = String(useRuntimeConfig().public.apiBaseUrl ?? '')
    return createSyncRunner({
      db: database,
      apiBaseUrl,
      orgSlug,
      getAccessToken: () => session?.getValidAccessToken() ?? null
    })
  }

  /** Best-effort sync (push then pull); offline failures are ignored so cached data is used. */
  async function syncQuietly(orgSlug: string, database: Awaited<ReturnType<typeof openDb>>) {
    try {
      await (await runnerFor(orgSlug, database)).run()
    } catch {
      // Offline / backend unreachable: keep working from the local cache + outbox.
    }
  }

  function liveDocs<T extends { deletedAt?: string | null }>(docs: T[]): T[] {
    return docs.filter(d => !d.deletedAt)
  }

  /** syncId → piece-type name, and numeric id → syncId, from the local piece types. */
  async function buildTypeMaps(database: Awaited<ReturnType<typeof openDb>>) {
    const docs = liveDocs((await database.pieceTypes.find().exec()).map(d => d.toJSON() as PieceTypeDoc))
    const nameBySync = new Map<string, string>()
    const syncByNum = new Map<number, string>()
    for (const t of docs) {
      nameBySync.set(t.syncId, t.name)
      syncByNum.set(hashId(t.syncId), t.syncId)
    }
    return { nameBySync, syncByNum }
  }

  /** numeric id → location syncId, from the local (live) locations. */
  async function buildLocationMap(database: Awaited<ReturnType<typeof openDb>>) {
    const docs = liveDocs((await database.locations.find().exec()).map(d => d.toJSON() as { syncId: string, deletedAt?: string | null }))
    const syncByNum = new Map<number, string>()
    for (const l of docs) syncByNum.set(hashId(l.syncId), l.syncId)
    return syncByNum
  }

  interface AttrDef { name: string, displayName: string, type: AttributeType, scope: AttributeScope }

  /** Attribute definitions (type + org scopes) keyed by syncId, plus numeric id → {syncId, scope}. */
  async function buildAttrMaps(database: Awaited<ReturnType<typeof openDb>>) {
    const typeAttrs = liveDocs((await database.pieceTypeAttributes.find().exec()).map(d => d.toJSON() as PieceTypeAttributeDoc))
    const orgAttrs = liveDocs((await database.orgAttributes.find().exec()).map(d => d.toJSON() as OrgAttributeDoc))
    const defBySync = new Map<string, AttrDef>()
    const refByNum = new Map<number, { syncId: string, scope: AttributeScope }>()
    for (const a of typeAttrs) {
      defBySync.set(a.syncId, { name: a.name, displayName: a.displayName, type: a.type as AttributeType, scope: 'TYPE' })
      refByNum.set(hashId(a.syncId), { syncId: a.syncId, scope: 'TYPE' })
    }
    for (const a of orgAttrs) {
      defBySync.set(a.syncId, { name: a.name, displayName: a.displayName, type: a.type as AttributeType, scope: 'ORG' })
      refByNum.set(hashId(a.syncId), { syncId: a.syncId, scope: 'ORG' })
    }
    return { defBySync, refByNum }
  }

  function pieceTypeRefs(doc: PieceDoc, nameBySync: Map<string, string>): PieceTypeRefDto[] {
    return doc.pieceTypeSyncIds.map((sid) => {
      const id = hashId(sid)
      idToSync.set(id, sid)
      return { id, name: nameBySync.get(sid) ?? '' }
    })
  }

  function listItemFromDoc(doc: PieceDoc, nameBySync: Map<string, string>): PieceListItemDto {
    const id = hashId(doc.syncId)
    idToSync.set(id, doc.syncId)
    if (doc.locationSyncId) idToSync.set(hashId(doc.locationSyncId), doc.locationSyncId)
    return {
      id,
      name: doc.name,
      serialNumber: doc.serialNumber ?? undefined,
      pieceTypes: pieceTypeRefs(doc, nameBySync),
      ownerUserId: doc.ownerUserId ?? undefined,
      locationId: doc.locationSyncId ? hashId(doc.locationSyncId) : undefined,
      coverAttachmentId: doc.coverAttachmentSyncId ? hashId(doc.coverAttachmentSyncId) : null,
      status: doc.status as PieceStatus,
      createdAt: doc.createdAt ?? '',
      updatedAt: doc.updatedAt ?? ''
    }
  }

  function attrValuesFromDoc(doc: PieceDoc, defBySync: Map<string, AttrDef>): PieceAttributeValueResponseDto[] {
    const all = [...doc.typeAttributeValues, ...doc.orgAttributeValues]
    return all.map((v) => {
      const def = defBySync.get(v.attributeSyncId)
      const id = hashId(v.attributeSyncId)
      idToSync.set(id, v.attributeSyncId)
      return {
        attributeId: id,
        scope: def?.scope ?? 'TYPE',
        attributeName: def?.name ?? '',
        displayName: def?.displayName ?? '',
        type: def?.type ?? 'TEXT',
        value: v.value
      }
    })
  }

  async function attachmentsFromDb(
    database: Awaited<ReturnType<typeof openDb>>,
    pieceSyncId: string
  ): Promise<PieceAttachmentResponseDto[]> {
    const docs = liveDocs((await database.attachments
      .find({ selector: { pieceSyncId } })
      .exec()).map(d => d.toJSON() as AttachmentDoc))
    return docs.map((a) => {
      const id = hashId(a.syncId)
      idToSync.set(id, a.syncId)
      return {
        id,
        kind: a.kind as PieceAttachmentKind,
        originalFilename: a.originalFilename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt ?? ''
      }
    })
  }

  async function detailFromDoc(
    database: Awaited<ReturnType<typeof openDb>>,
    doc: PieceDoc
  ): Promise<PieceResponseDto> {
    const { nameBySync } = await buildTypeMaps(database)
    const { defBySync } = await buildAttrMaps(database)
    const id = hashId(doc.syncId)
    idToSync.set(id, doc.syncId)
    return {
      id,
      organizationId: 0,
      name: doc.name,
      serialNumber: doc.serialNumber ?? undefined,
      description: doc.description ?? undefined,
      pieceTypes: pieceTypeRefs(doc, nameBySync),
      ownerUserId: doc.ownerUserId ?? undefined,
      locationId: doc.locationSyncId ? hashId(doc.locationSyncId) : undefined,
      coverAttachmentId: doc.coverAttachmentSyncId ? hashId(doc.coverAttachmentSyncId) : null,
      status: doc.status as PieceStatus,
      createdAt: doc.createdAt ?? '',
      updatedAt: doc.updatedAt ?? '',
      attributeValues: attrValuesFromDoc(doc, defBySync),
      attachments: await attachmentsFromDb(database, doc.syncId)
    }
  }

  /** Resolves the numeric refs of a create/update payload to syncIds for the repository. */
  async function resolveWriteRefs(
    database: Awaited<ReturnType<typeof openDb>>,
    payload: { pieceTypeIds?: number[], attributeValues?: { attributeId: number, scope?: AttributeScope, value: string | null }[] }
  ) {
    const { syncByNum: typeByNum } = await buildTypeMaps(database)
    const { refByNum } = await buildAttrMaps(database)
    const pieceTypeSyncIds = (payload.pieceTypeIds ?? [])
      .map(id => typeByNum.get(id))
      .filter((s): s is string => Boolean(s))
    const typeAttributeValues: AttributeValueSync[] = []
    const orgAttributeValues: AttributeValueSync[] = []
    for (const av of payload.attributeValues ?? []) {
      const ref = refByNum.get(av.attributeId)
      if (!ref) continue
      const scope = av.scope ?? ref.scope
      const entry: AttributeValueSync = { attributeSyncId: ref.syncId, value: av.value }
      if (scope === 'ORG') orgAttributeValues.push(entry)
      else typeAttributeValues.push(entry)
    }
    return { pieceTypeSyncIds, typeAttributeValues, orgAttributeValues }
  }

  async function locationSyncIdFor(database: Awaited<ReturnType<typeof openDb>>, locationId: number | null | undefined): Promise<string | null> {
    if (locationId == null) return null
    const fromCache = idToSync.get(locationId)
    if (fromCache) return fromCache
    return (await buildLocationMap(database)).get(locationId) ?? null
  }

  function comparePieces(a: PieceDoc, b: PieceDoc, sort: string | undefined): number {
    const [field = 'updatedAt', dir = 'desc'] = (sort ?? 'updatedAt,desc').split(',')
    const sign = dir.toLowerCase() === 'asc' ? 1 : -1
    if (field === 'name') return sign * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    const av = (field === 'createdAt' ? a.createdAt : a.updatedAt) ?? ''
    const bv = (field === 'createdAt' ? b.createdAt : b.updatedAt) ?? ''
    return sign * av.localeCompare(bv)
  }

  function makePage(content: PieceListItemDto[], total: number, page: number, size: number): Page<PieceListItemDto> {
    const totalPages = size > 0 ? Math.ceil(total / size) : 0
    const sort = { empty: false, sorted: true, unsorted: false }
    return {
      content,
      totalElements: total,
      totalPages,
      size,
      number: page,
      numberOfElements: content.length,
      first: page === 0,
      last: page >= totalPages - 1,
      empty: content.length === 0,
      sort,
      pageable: { offset: page * size, paged: true, pageNumber: page, pageSize: size, sort, unpaged: false }
    }
  }

  async function fetchByLocation(orgSlug: string, locationId: number | null) {
    if (isDesktop()) {
      const key = bucketKey(locationId)
      loadingFor.value = key
      try {
        const database = await openDb(orgSlug)
        await syncQuietly(orgSlug, database)
        const { nameBySync } = await buildTypeMaps(database)
        const targetSyncId = await locationSyncIdFor(database, locationId)
        const docs = liveDocs((await database.pieces.find().exec()).map(d => d.toJSON() as PieceDoc))
        const filtered = docs
          .filter(d => (locationId == null ? !d.locationSyncId : d.locationSyncId === targetSyncId))
          .map(d => listItemFromDoc(d, nameBySync))
        byLocation.value = { ...byLocation.value, [key]: filtered }
        return filtered
      } finally {
        loadingFor.value = null
      }
    }
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
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const syncId = idToSync.get(pieceId)
      if (!syncId) return
      const locationSyncId = target.clearLocation
        ? null
        : await locationSyncIdFor(database, target.locationId)
      await updatePiece(database, syncId, { locationSyncId })
      invalidateAll()
      void syncQuietly(orgSlug, database)
      return
    }
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

  async function fetchListDesktop(orgSlug: string): Promise<Page<PieceListItemDto>> {
    const f = filters.value
    const database = await openDb(orgSlug)
    await syncQuietly(orgSlug, database)
    const { nameBySync, syncByNum } = await buildTypeMaps(database)
    const typeSyncId = f.typeId != null ? syncByNum.get(f.typeId) : undefined
    const locationSyncId = f.locationId != null ? await locationSyncIdFor(database, f.locationId) : undefined
    const q = f.q?.trim().toLowerCase()
    let docs = liveDocs((await database.pieces.find().exec()).map(d => d.toJSON() as PieceDoc))
    if (f.typeId != null) docs = docs.filter(d => typeSyncId != null && d.pieceTypeSyncIds.includes(typeSyncId))
    if (f.locationId != null) docs = docs.filter(d => d.locationSyncId === locationSyncId)
    if (f.ownerUserId != null) docs = docs.filter(d => d.ownerUserId === f.ownerUserId)
    if (f.status) docs = docs.filter(d => d.status === f.status)
    if (q) docs = docs.filter(d => d.name.toLowerCase().includes(q) || (d.serialNumber ?? '').toLowerCase().includes(q))
    docs.sort((a, b) => comparePieces(a, b, f.sort))
    const total = docs.length
    const page = f.page ?? 0
    const size = f.size ?? 20
    const slice = docs.slice(page * size, page * size + size).map(d => listItemFromDoc(d, nameBySync))
    const result = makePage(slice, total, page, size)
    list.value = result.content
    pageMeta.value = result
    return result
  }

  async function fetchList(orgSlug: string, partial?: Partial<PieceListFilters>) {
    if (partial) {
      filters.value = { ...filters.value, ...partial }
    }
    if (isDesktop()) {
      loadingList.value = true
      try {
        return await fetchListDesktop(orgSlug)
      } finally {
        loadingList.value = false
      }
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
    const filterKeys: Array<keyof PieceListFilters> = ['typeId', 'locationId', 'ownerUserId', 'status', 'q']
    const filterChanged = filterKeys.some(k => k in patch && patch[k] !== filters.value[k])
    if (filterChanged) next.page = 0
    filters.value = next
    return fetchList(orgSlug)
  }

  function resetFilters(orgSlug: string) {
    filters.value = { ...DEFAULT_FILTERS }
    return fetchList(orgSlug)
  }

  async function fetchDetail(orgSlug: string, pieceId: number) {
    if (isDesktop()) {
      loadingDetail.value = pieceId
      try {
        const database = await openDb(orgSlug)
        const syncId = idToSync.get(pieceId)
        const found = syncId ? await database.pieces.findOne(syncId).exec() : null
        if (!found) return undefined
        const doc = found.toJSON() as PieceDoc
        if (doc.deletedAt) return undefined
        const piece = await detailFromDoc(database, doc)
        detailById.value = { ...detailById.value, [pieceId]: piece }
        return piece
      } finally {
        loadingDetail.value = null
      }
    }
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
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const refs = await resolveWriteRefs(database, payload)
      const doc = await createPiece(database, {
        name: payload.name,
        serialNumber: payload.serialNumber ?? null,
        description: payload.description ?? null,
        pieceTypeSyncIds: refs.pieceTypeSyncIds,
        locationSyncId: await locationSyncIdFor(database, payload.locationId),
        ownerUserId: payload.ownerUserId ?? null,
        typeAttributeValues: refs.typeAttributeValues,
        orgAttributeValues: refs.orgAttributeValues
      })
      const created = await detailFromDoc(database, doc)
      detailById.value = { ...detailById.value, [created.id]: created }
      invalidateAll()
      void syncQuietly(orgSlug, database)
      return created
    }
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
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const syncId = idToSync.get(pieceId)
      if (!syncId) return undefined
      const refs = await resolveWriteRefs(database, patch)
      const next: UpdatePiecePatch = {}
      if (patch.name !== undefined) next.name = patch.name
      if (patch.serialNumber !== undefined) next.serialNumber = patch.serialNumber
      if (patch.description !== undefined) next.description = patch.description
      if (patch.pieceTypeIds !== undefined) next.pieceTypeSyncIds = refs.pieceTypeSyncIds
      if (patch.clearOwner) next.ownerUserId = null
      else if (patch.ownerUserId !== undefined) next.ownerUserId = patch.ownerUserId
      if (patch.clearLocation) next.locationSyncId = null
      else if (patch.locationId !== undefined) next.locationSyncId = await locationSyncIdFor(database, patch.locationId)
      if (patch.attributeValues !== undefined) {
        next.typeAttributeValues = refs.typeAttributeValues
        next.orgAttributeValues = refs.orgAttributeValues
      }
      await updatePiece(database, syncId, next)
      const found = await database.pieces.findOne(syncId).exec()
      const updated = found ? await detailFromDoc(database, found.toJSON() as PieceDoc) : undefined
      if (updated) {
        detailById.value = { ...detailById.value, [updated.id]: updated }
        applyToList(updated)
      }
      invalidateAll()
      void syncQuietly(orgSlug, database)
      return updated
    }
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
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const syncId = idToSync.get(pieceId)
      if (!syncId) return
      await deletePiece(database, syncId)
      const nextDetail = { ...detailById.value }
      delete nextDetail[pieceId]
      detailById.value = nextDetail
      list.value = list.value.filter(p => p.id !== pieceId)
      invalidateAll()
      void syncQuietly(orgSlug, database)
      return
    }
    const api = useApi()
    await api(`/organizations/${orgSlug}/pieces/${pieceId}`, { method: 'DELETE' })
    const nextDetail = { ...detailById.value }
    delete nextDetail[pieceId]
    detailById.value = nextDetail
    list.value = list.value.filter(p => p.id !== pieceId)
    invalidateAll()
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

  function emptyHistoryPage(page: number, size: number): Page<PieceHistoryItemDto> {
    const sort = { empty: true, sorted: false, unsorted: true }
    return {
      content: [],
      totalElements: 0,
      totalPages: 0,
      size,
      number: page,
      numberOfElements: 0,
      first: page === 0,
      last: true,
      empty: true,
      sort,
      pageable: { offset: page * size, paged: true, pageNumber: page, pageSize: size, sort, unpaged: false }
    }
  }

  async function fetchHistory(
    orgSlug: string,
    pieceId: number,
    page = 0,
    size = 20
  ) {
    // History is server-computed (diff-based) and not part of the offline sync set, so on desktop
    // it is best-effort: when offline we surface an empty page instead of throwing.
    if (isDesktop()) {
      loadingHistory.value = pieceId
      try {
        const result = await useApi()<Page<PieceHistoryItemDto>>(
          `/organizations/${orgSlug}/pieces/${pieceId}/history`,
          { params: { page, size } }
        )
        historyByPiece.value = { ...historyByPiece.value, [pieceId]: result }
        return result
      } catch {
        const empty = emptyHistoryPage(page, size)
        historyByPiece.value = { ...historyByPiece.value, [pieceId]: empty }
        return empty
      } finally {
        loadingHistory.value = null
      }
    }
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
    idToSync.clear()
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
    revokeAttachmentBlobUrl,
    attachmentBlobUrls,
    attachmentBlobInFlight,

    historyByPiece,
    loadingHistory,
    fetchHistory,

    reset
  }
})
