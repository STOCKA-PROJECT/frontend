import { defineStore } from 'pinia'

import type { DesktopSession } from '~/auth/desktopSession'
import {
  createOrgAttribute,
  deleteOrgAttribute,
  updateOrgAttribute
} from '~/data/orgAttributeRepository'
import type { OrgAttributeDoc } from '~/db/schemas'
import { createSyncRunner } from '~/sync/runner'
import type {
  AttributeType,
  AttributeValidatorsDto,
  CreateOrganizationPieceAttributeDto,
  OrganizationPieceAttributeResponseDto,
  UpdateOrganizationPieceAttributeDto
} from '~/types/api'

/**
 * Deterministic positive 32-bit id from a syncId (FNV-1a), so the desktop store can present the
 * numeric `id` the UI expects while keeping syncId as the real identity. Mirrors `locations.ts`.
 */
function hashId(syncId: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < syncId.length; i++) {
    h ^= syncId.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) || 1
}

/**
 * Pinia store for organization-level piece attributes (OWNER+MANAGER manage; any member reads).
 * Mirrors `usePieceTypesStore` but scopes everything to a single organization slug and a flat list.
 * Dual-mode: desktop is backed by RxDB (offline-first), web by the API.
 */
export const useOrganizationPieceAttributesStore = defineStore('organizationPieceAttributes', () => {
  const byOrg = ref<Record<string, OrganizationPieceAttributeResponseDto[]>>({})
  const loading = ref(false)
  const loadedOrgSlugs = ref<Set<string>>(new Set())

  const isDesktop = (): boolean => !!useRuntimeConfig().public.desktop

  // Maps the deterministic numeric id exposed to the UI back to the real syncId (desktop only).
  const idToSync = new Map<number, string>()

  function listFor(orgSlug: string): OrganizationPieceAttributeResponseDto[] {
    return byOrg.value[orgSlug] ?? []
  }

  function setList(orgSlug: string, list: OrganizationPieceAttributeResponseDto[]) {
    byOrg.value = { ...byOrg.value, [orgSlug]: list }
  }

  function markLoaded(orgSlug: string) {
    loadedOrgSlugs.value = new Set([...loadedOrgSlugs.value, orgSlug])
  }

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

  function dtoFromDoc(doc: OrgAttributeDoc): OrganizationPieceAttributeResponseDto {
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

  async function rebuildFromDb(orgSlug: string, database: Awaited<ReturnType<typeof openDb>>) {
    const docs = (await database.orgAttributes.find().exec())
      .map(d => d.toJSON() as OrgAttributeDoc)
      .filter(a => !a.deletedAt)
    idToSync.clear()
    const sorted = docs.slice().sort((a, b) => a.position - b.position)
    setList(orgSlug, sorted.map(dtoFromDoc))
  }

  async function fetchAll(orgSlug: string) {
    if (isDesktop()) {
      loading.value = true
      try {
        const database = await openDb(orgSlug)
        await syncQuietly(orgSlug, database)
        await rebuildFromDb(orgSlug, database)
        markLoaded(orgSlug)
        return listFor(orgSlug)
      } finally {
        loading.value = false
      }
    }
    const api = useApi()
    loading.value = true
    try {
      const data = await api<OrganizationPieceAttributeResponseDto[]>(
        `/organizations/${orgSlug}/piece-attributes`
      )
      setList(orgSlug, data)
      markLoaded(orgSlug)
      return data
    } finally {
      loading.value = false
    }
  }

  async function create(orgSlug: string, payload: CreateOrganizationPieceAttributeDto) {
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const doc = await createOrgAttribute(database, {
        name: payload.name,
        displayName: payload.displayName,
        type: payload.type,
        required: payload.required,
        position: payload.position,
        validatorsJson: serializeValidators(payload.validators)
      })
      await rebuildFromDb(orgSlug, database)
      void syncQuietly(orgSlug, database)
      return dtoFromDoc(doc)
    }
    const api = useApi()
    const created = await api<OrganizationPieceAttributeResponseDto>(
      `/organizations/${orgSlug}/piece-attributes`,
      { method: 'POST', body: payload }
    )
    setList(orgSlug, [...listFor(orgSlug), created])
    return created
  }

  async function update(orgSlug: string, attributeId: number, payload: UpdateOrganizationPieceAttributeDto) {
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const syncId = idToSync.get(attributeId)
      if (!syncId) return undefined
      const patch: Parameters<typeof updateOrgAttribute>[2] = {}
      if (payload.name !== undefined) patch.name = payload.name
      if (payload.displayName !== undefined) patch.displayName = payload.displayName
      if (payload.type !== undefined) patch.type = payload.type
      if (payload.required !== undefined) patch.required = payload.required
      if (payload.position !== undefined) patch.position = payload.position
      if (payload.validators !== undefined) patch.validatorsJson = serializeValidators(payload.validators)
      await updateOrgAttribute(database, syncId, patch)
      await rebuildFromDb(orgSlug, database)
      void syncQuietly(orgSlug, database)
      return listFor(orgSlug).find(a => a.id === attributeId)
    }
    const api = useApi()
    const updated = await api<OrganizationPieceAttributeResponseDto>(
      `/organizations/${orgSlug}/piece-attributes/${attributeId}`,
      { method: 'PATCH', body: payload }
    )
    setList(orgSlug, listFor(orgSlug).map(a => (a.id === updated.id ? updated : a)))
    return updated
  }

  async function softDelete(orgSlug: string, attributeId: number) {
    if (isDesktop()) {
      const database = await openDb(orgSlug)
      const syncId = idToSync.get(attributeId)
      if (!syncId) return
      await deleteOrgAttribute(database, syncId)
      setList(orgSlug, listFor(orgSlug).filter(a => a.id !== attributeId))
      void syncQuietly(orgSlug, database)
      return
    }
    const api = useApi()
    await api(`/organizations/${orgSlug}/piece-attributes/${attributeId}`, { method: 'DELETE' })
    setList(orgSlug, listFor(orgSlug).filter(a => a.id !== attributeId))
  }

  function reset() {
    byOrg.value = {}
    loading.value = false
    loadedOrgSlugs.value = new Set()
    idToSync.clear()
  }

  return {
    byOrg,
    loading,
    loadedOrgSlugs,
    listFor,
    fetchAll,
    create,
    update,
    softDelete,
    reset
  }
})
