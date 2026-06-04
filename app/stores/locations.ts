import { defineStore } from 'pinia'

import type { DesktopSession } from '~/auth/desktopSession'
import {
  createLocation,
  deleteLocation,
  updateLocation
} from '~/data/locationRepository'
import { buildLocationTree, type LocationTreeNode } from '~/data/locationsTree'
import type { LocationDoc } from '~/db/schemas'
import { createSyncRunner } from '~/sync/runner'
import type {
  CreateLocationDto,
  LocationResponseDto,
  LocationTreeNodeDto,
  UpdateLocationDto
} from '~/types/api'

/**
 * Deterministic positive 32-bit id from a syncId (FNV-1a), so the desktop store can present the
 * numeric `id` the UI/board expects while keeping syncId as the real identity. Stable across
 * sessions; collisions are negligible at organization scale.
 */
function hashId(syncId: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < syncId.length; i++) {
    h ^= syncId.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) || 1
}

export const useLocationsStore = defineStore('locations', () => {
  const tree = ref<LocationTreeNodeDto[]>([])
  const detailById = ref<Record<number, LocationResponseDto>>({})
  const loadingTree = ref(false)

  const isDesktop = (): boolean => !!useRuntimeConfig().public.desktop

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

  function toNumericTree(nodes: LocationTreeNode[]): LocationTreeNodeDto[] {
    return nodes.map((node) => {
      const id = hashId(node.syncId)
      idToSync.set(id, node.syncId)
      return {
        id,
        name: node.name,
        description: node.description ?? undefined,
        children: toNumericTree(node.children)
      }
    })
  }

  async function rebuildTree(database: Awaited<ReturnType<typeof openDb>>) {
    const docs = (await database.locations.find().exec()).map((d) => d.toJSON() as LocationDoc)
    idToSync.clear()
    tree.value = toNumericTree(buildLocationTree(docs))
  }

  function detailFromDoc(doc: LocationDoc, breadcrumb: { id: number, name: string }[]): LocationResponseDto {
    return {
      id: hashId(doc.syncId),
      organizationId: 0,
      name: doc.name,
      description: doc.description ?? undefined,
      parentId: doc.parentSyncId ? hashId(doc.parentSyncId) : undefined,
      createdAt: doc.createdAt ?? '',
      updatedAt: doc.updatedAt ?? '',
      breadcrumb
    }
  }

  // --- Public actions (dual-mode: desktop uses RxDB, web uses the API) -----------------------

  async function fetchTree(orgSlug: string) {
    if (isDesktop()) {
      loadingTree.value = true
      try {
        const database = await openDb(orgSlug)
        await syncQuietly(orgSlug, database)
        await rebuildTree(database)
      } finally {
        loadingTree.value = false
      }
      return tree.value
    }
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
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const all = (await database.locations.find().exec()).map((d) => d.toJSON() as LocationDoc)
      const bySync = new Map(all.map((d) => [d.syncId, d]))
      const syncId = idToSync.get(id)
      const self = syncId ? bySync.get(syncId) : undefined
      if (!self) return undefined
      const crumbs: { id: number, name: string }[] = []
      const seen = new Set<string>()
      let cur: LocationDoc | undefined = self
      while (cur && !seen.has(cur.syncId)) {
        seen.add(cur.syncId)
        crumbs.unshift({ id: hashId(cur.syncId), name: cur.name })
        cur = cur.parentSyncId ? bySync.get(cur.parentSyncId) : undefined
      }
      const dto = detailFromDoc(self, crumbs)
      detailById.value = { ...detailById.value, [id]: dto }
      return dto
    }
    const api = useApi()
    const data = await api<LocationResponseDto>(`/organizations/${orgSlug}/locations/${id}`)
    detailById.value = { ...detailById.value, [id]: data }
    return data
  }

  async function create(orgSlug: string, payload: CreateLocationDto) {
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const parentSyncId = payload.parentId != null ? (idToSync.get(payload.parentId) ?? null) : null
      const doc = await createLocation(database, {
        name: payload.name,
        description: payload.description ?? null,
        parentSyncId
      })
      await rebuildTree(database)
      const dto = detailFromDoc(doc, [])
      detailById.value = { ...detailById.value, [dto.id]: dto }
      void syncQuietly(orgSlug, database)
      return dto
    }
    const api = useApi()
    const created = await api<LocationResponseDto>(`/organizations/${orgSlug}/locations`, {
      method: 'POST',
      body: payload
    })
    await fetchTree(orgSlug)
    return created
  }

  async function update(orgSlug: string, id: number, payload: UpdateLocationDto) {
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const syncId = idToSync.get(id)
      if (!syncId) return undefined
      const patch: { name?: string, description?: string | null, parentSyncId?: string | null } = {}
      if (payload.name !== undefined) patch.name = payload.name
      if (payload.description !== undefined) patch.description = payload.description ?? null
      if (payload.moveToRoot) patch.parentSyncId = null
      else if (payload.parentId !== undefined) {
        patch.parentSyncId = payload.parentId != null ? (idToSync.get(payload.parentId) ?? null) : null
      }
      await updateLocation(database, syncId, patch)
      await rebuildTree(database)
      void syncQuietly(orgSlug, database)
      return detailById.value[id]
    }
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
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const syncId = idToSync.get(id)
      if (!syncId) return
      await deleteLocation(database, syncId)
      await rebuildTree(database)
      const next = { ...detailById.value }
      delete next[id]
      detailById.value = next
      void syncQuietly(orgSlug, database)
      return
    }
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
    idToSync.clear()
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
