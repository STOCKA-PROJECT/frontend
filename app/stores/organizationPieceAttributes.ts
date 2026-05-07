import { defineStore } from 'pinia'
import type {
  CreateOrganizationPieceAttributeDto,
  OrganizationPieceAttributeResponseDto,
  UpdateOrganizationPieceAttributeDto
} from '~/types/api'

/**
 * Pinia store for organization-level piece attributes (OWNER+MANAGER manage; any member reads).
 * Mirrors `usePieceTypesStore` but scopes everything to a single organization id and a flat list.
 */
export const useOrganizationPieceAttributesStore = defineStore('organizationPieceAttributes', () => {
  const byOrg = ref<Record<number, OrganizationPieceAttributeResponseDto[]>>({})
  const loading = ref(false)
  const loadedOrgIds = ref<Set<number>>(new Set())

  function listFor(orgId: number): OrganizationPieceAttributeResponseDto[] {
    return byOrg.value[orgId] ?? []
  }

  function setList(orgId: number, list: OrganizationPieceAttributeResponseDto[]) {
    byOrg.value = { ...byOrg.value, [orgId]: list }
  }

  async function fetchAll(orgId: number) {
    const api = useApi()
    loading.value = true
    try {
      const data = await api<OrganizationPieceAttributeResponseDto[]>(
        `/organizations/${orgId}/piece-attributes`
      )
      setList(orgId, data)
      loadedOrgIds.value = new Set([...loadedOrgIds.value, orgId])
      return data
    } finally {
      loading.value = false
    }
  }

  async function create(orgId: number, payload: CreateOrganizationPieceAttributeDto) {
    const api = useApi()
    const created = await api<OrganizationPieceAttributeResponseDto>(
      `/organizations/${orgId}/piece-attributes`,
      { method: 'POST', body: payload }
    )
    setList(orgId, [...listFor(orgId), created])
    return created
  }

  async function update(orgId: number, attributeId: number, payload: UpdateOrganizationPieceAttributeDto) {
    const api = useApi()
    const updated = await api<OrganizationPieceAttributeResponseDto>(
      `/organizations/${orgId}/piece-attributes/${attributeId}`,
      { method: 'PATCH', body: payload }
    )
    setList(orgId, listFor(orgId).map(a => (a.id === updated.id ? updated : a)))
    return updated
  }

  async function softDelete(orgId: number, attributeId: number) {
    const api = useApi()
    await api(`/organizations/${orgId}/piece-attributes/${attributeId}`, { method: 'DELETE' })
    setList(orgId, listFor(orgId).filter(a => a.id !== attributeId))
  }

  function reset() {
    byOrg.value = {}
    loading.value = false
    loadedOrgIds.value = new Set()
  }

  return {
    byOrg,
    loading,
    loadedOrgIds,
    listFor,
    fetchAll,
    create,
    update,
    softDelete,
    reset
  }
})
