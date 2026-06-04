import { defineStore } from 'pinia'

import type { DesktopSession } from '~/auth/desktopSession'
import {
  createPieceType,
  deletePieceType,
  renamePieceType
} from '~/data/pieceTypeRepository'
import {
  createPieceTypeAttribute,
  deletePieceTypeAttribute,
  updatePieceTypeAttribute
} from '~/data/pieceTypeAttributeRepository'
import type { PieceTypeAttributeDoc, PieceTypeDoc } from '~/db/schemas'
import { createSyncRunner } from '~/sync/runner'
import type {
  AttributeType,
  AttributeValidatorsDto,
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

/**
 * Deterministic positive 32-bit id from a syncId (FNV-1a), so the desktop store can present the
 * numeric `id` the UI expects while keeping syncId as the real identity. Stable across sessions;
 * collisions are negligible at organization scale. Mirrors `locations.ts`.
 */
function hashId(syncId: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < syncId.length; i++) {
    h ^= syncId.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) || 1
}

export const usePieceTypesStore = defineStore('pieceTypes', () => {
  const byId = ref<Record<number, PieceTypeResponseDto>>({})
  const order = ref<number[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  // Actions are a separate, gated sub-resource (only available on admin-owned orgs), so they are
  // fetched on demand and kept in their own map keyed by piece-type id rather than embedded in the
  // piece type payload. They are NOT part of the offline sync set, so on desktop they stay
  // online-only (the API path below).
  const actionsByTypeId = ref<Record<number, PieceTypeActionResponseDto[]>>({})

  const list = computed(() =>
    order.value
      .map(id => byId.value[id])
      .filter((t): t is PieceTypeResponseDto => Boolean(t))
  )

  const isDesktop = (): boolean => !!useRuntimeConfig().public.desktop

  // --- Desktop (offline-first, RxDB) support -------------------------------------------------
  // Maps the deterministic numeric id exposed to the UI back to the real syncId (covers both
  // piece types and their attributes, since the hash space is shared).
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

  function parseValidators(json: string | null | undefined): AttributeValidatorsDto {
    if (!json) return {}
    try {
      return JSON.parse(json) as AttributeValidatorsDto
    } catch {
      return {}
    }
  }

  function serializeValidators(validators: AttributeValidatorsDto | undefined): string | null {
    if (!validators || Object.keys(validators).length === 0) return null
    return JSON.stringify(validators)
  }

  function attrDtoFromDoc(doc: PieceTypeAttributeDoc): PieceTypeAttributeResponseDto {
    const id = hashId(doc.syncId)
    idToSync.set(id, doc.syncId)
    return {
      id,
      name: doc.name,
      displayName: doc.displayName,
      type: doc.type as AttributeType,
      required: doc.required,
      position: doc.position,
      validators: parseValidators(doc.validatorsJson)
    }
  }

  function typeDtoFromDoc(
    typeDoc: PieceTypeDoc,
    attrDocs: PieceTypeAttributeDoc[]
  ): PieceTypeResponseDto {
    const id = hashId(typeDoc.syncId)
    idToSync.set(id, typeDoc.syncId)
    const attributes = attrDocs
      .filter(a => !a.deletedAt)
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(attrDtoFromDoc)
    return {
      id,
      organizationId: 0,
      name: typeDoc.name,
      createdAt: typeDoc.createdAt ?? '',
      updatedAt: typeDoc.updatedAt ?? '',
      attributes
    }
  }

  /** Loads all live piece types (with embedded attributes) from RxDB into the store state. */
  async function rebuildFromDb(database: Awaited<ReturnType<typeof openDb>>) {
    const typeDocs = (await database.pieceTypes.find().exec())
      .map(d => d.toJSON() as PieceTypeDoc)
      .filter(t => !t.deletedAt)
    const attrDocs = (await database.pieceTypeAttributes.find().exec())
      .map(d => d.toJSON() as PieceTypeAttributeDoc)
    const attrsByType = new Map<string, PieceTypeAttributeDoc[]>()
    for (const a of attrDocs) {
      const bucket = attrsByType.get(a.pieceTypeSyncId) ?? []
      bucket.push(a)
      attrsByType.set(a.pieceTypeSyncId, bucket)
    }
    idToSync.clear()
    const nextById: Record<number, PieceTypeResponseDto> = {}
    const nextOrder: number[] = []
    const sortedTypes = typeDocs
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    for (const t of sortedTypes) {
      const dto = typeDtoFromDoc(t, attrsByType.get(t.syncId) ?? [])
      nextById[dto.id] = dto
      nextOrder.push(dto.id)
    }
    byId.value = nextById
    order.value = nextOrder
  }

  async function rebuildOne(database: Awaited<ReturnType<typeof openDb>>, syncId: string) {
    const typeDoc = await database.pieceTypes.findOne(syncId).exec()
    if (!typeDoc) return undefined
    const t = typeDoc.toJSON() as PieceTypeDoc
    if (t.deletedAt) return undefined
    const attrDocs = (await database.pieceTypeAttributes
      .find({ selector: { pieceTypeSyncId: syncId } })
      .exec()).map(d => d.toJSON() as PieceTypeAttributeDoc)
    const dto = typeDtoFromDoc(t, attrDocs)
    upsert(dto)
    return dto
  }

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

  // --- Public actions (dual-mode: desktop uses RxDB, web uses the API) -----------------------

  async function fetchAll(orgSlug: string) {
    if (isDesktop()) {
      loading.value = true
      try {
        const database = await openDb(orgSlug)
        await syncQuietly(orgSlug, database)
        await rebuildFromDb(database)
        loaded.value = true
      } finally {
        loading.value = false
      }
      return list.value
    }
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
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const syncId = idToSync.get(id)
      if (!syncId) return undefined
      return rebuildOne(database, syncId)
    }
    const api = useApi()
    const data = await api<PieceTypeResponseDto>(`/organizations/${orgSlug}/piece-types/${id}`)
    upsert(data)
    return data
  }

  async function create(orgSlug: string, payload: CreatePieceTypeDto) {
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const typeDoc = await createPieceType(database, { name: payload.name })
      for (const [index, attr] of (payload.attributes ?? []).entries()) {
        await createPieceTypeAttribute(database, {
          pieceTypeSyncId: typeDoc.syncId,
          name: attr.name,
          displayName: attr.displayName,
          type: attr.type,
          required: attr.required,
          position: attr.position ?? index,
          validatorsJson: serializeValidators(attr.validators)
        })
      }
      const dto = (await rebuildOne(database, typeDoc.syncId))!
      void syncQuietly(orgSlug, database)
      return dto
    }
    const api = useApi()
    const created = await api<PieceTypeResponseDto>(`/organizations/${orgSlug}/piece-types`, {
      method: 'POST',
      body: payload
    })
    upsert(created)
    return created
  }

  async function update(orgSlug: string, id: number, payload: UpdatePieceTypeDto) {
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const syncId = idToSync.get(id)
      if (!syncId) return undefined
      if (payload.name !== undefined) await renamePieceType(database, syncId, payload.name)
      const dto = await rebuildOne(database, syncId)
      void syncQuietly(orgSlug, database)
      return dto
    }
    const api = useApi()
    const updated = await api<PieceTypeResponseDto>(`/organizations/${orgSlug}/piece-types/${id}`, {
      method: 'PATCH',
      body: payload
    })
    upsert(updated)
    return updated
  }

  async function softDelete(orgSlug: string, id: number) {
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const syncId = idToSync.get(id)
      if (!syncId) return
      await deletePieceType(database, syncId)
      removeFromState(id)
      void syncQuietly(orgSlug, database)
      return
    }
    const api = useApi()
    await api(`/organizations/${orgSlug}/piece-types/${id}`, { method: 'DELETE' })
    removeFromState(id)
  }

  async function addAttribute(orgSlug: string, typeId: number, payload: CreatePieceTypeAttributeDto) {
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const pieceTypeSyncId = idToSync.get(typeId)
      if (!pieceTypeSyncId) return undefined
      const doc = await createPieceTypeAttribute(database, {
        pieceTypeSyncId,
        name: payload.name,
        displayName: payload.displayName,
        type: payload.type,
        required: payload.required,
        position: payload.position,
        validatorsJson: serializeValidators(payload.validators)
      })
      await rebuildOne(database, pieceTypeSyncId)
      void syncQuietly(orgSlug, database)
      return attrDtoFromDoc(doc)
    }
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
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const pieceTypeSyncId = idToSync.get(typeId)
      const attrSyncId = idToSync.get(attrId)
      if (!pieceTypeSyncId || !attrSyncId) return undefined
      const patch: Parameters<typeof updatePieceTypeAttribute>[2] = {}
      if (payload.name !== undefined) patch.name = payload.name
      if (payload.displayName !== undefined) patch.displayName = payload.displayName
      if (payload.type !== undefined) patch.type = payload.type
      if (payload.required !== undefined) patch.required = payload.required
      if (payload.position !== undefined) patch.position = payload.position
      if (payload.validators !== undefined) patch.validatorsJson = serializeValidators(payload.validators)
      await updatePieceTypeAttribute(database, attrSyncId, patch)
      await rebuildOne(database, pieceTypeSyncId)
      void syncQuietly(orgSlug, database)
      return byId.value[typeId]?.attributes.find(a => a.id === attrId)
    }
    const api = useApi()
    const updated = await api<PieceTypeAttributeResponseDto>(
      `/organizations/${orgSlug}/piece-types/${typeId}/attributes/${attrId}`,
      { method: 'PATCH', body: payload }
    )
    await fetchOne(orgSlug, typeId)
    return updated
  }

  async function removeAttribute(orgSlug: string, typeId: number, attrId: number) {
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const pieceTypeSyncId = idToSync.get(typeId)
      const attrSyncId = idToSync.get(attrId)
      if (!pieceTypeSyncId || !attrSyncId) return
      await deletePieceTypeAttribute(database, attrSyncId)
      await rebuildOne(database, pieceTypeSyncId)
      void syncQuietly(orgSlug, database)
      return
    }
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
    idToSync.clear()
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
