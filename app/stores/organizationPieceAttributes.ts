import { defineStore } from 'pinia'
import type {
  CreateOrganizationPieceAttributeDto,
  OrganizationPieceAttributeResponseDto,
  UpdateOrganizationPieceAttributeDto
} from '~/types/api'

/**
 * Pinia store for organization-level piece attributes (OWNER+MANAGER manage; any member reads).
 * Mirrors `usePieceTypesStore` but scopes everything to a single organization slug and a flat list.
 */
export const useOrganizationPieceAttributesStore = defineStore('organizationPieceAttributes', () => {
  const byOrg = ref<Record<string, OrganizationPieceAttributeResponseDto[]>>({})
  const loading = ref(false)
  const loadedOrgSlugs = ref<Set<string>>(new Set())

  function listFor(orgSlug: string): OrganizationPieceAttributeResponseDto[] {
    return byOrg.value[orgSlug] ?? []
  }

  function setList(orgSlug: string, list: OrganizationPieceAttributeResponseDto[]) {
    byOrg.value = { ...byOrg.value, [orgSlug]: list }
  }

  async function fetchAll(orgSlug: string) {
    const api = useApi()
    loading.value = true
    try {
      const data = await api<OrganizationPieceAttributeResponseDto[]>(
        `/organizations/${orgSlug}/piece-attributes`
      )
      setList(orgSlug, data)
      loadedOrgSlugs.value = new Set([...loadedOrgSlugs.value, orgSlug])
      return data
    } finally {
      loading.value = false
    }
  }

  async function create(orgSlug: string, payload: CreateOrganizationPieceAttributeDto) {
    const api = useApi()
    const created = await api<OrganizationPieceAttributeResponseDto>(
      `/organizations/${orgSlug}/piece-attributes`,
      { method: 'POST', body: payload }
    )
    setList(orgSlug, [...listFor(orgSlug), created])
    return created
  }

  async function update(orgSlug: string, attributeId: number, payload: UpdateOrganizationPieceAttributeDto) {
    const api = useApi()
    const updated = await api<OrganizationPieceAttributeResponseDto>(
      `/organizations/${orgSlug}/piece-attributes/${attributeId}`,
      { method: 'PATCH', body: payload }
    )
    setList(orgSlug, listFor(orgSlug).map(a => (a.id === updated.id ? updated : a)))
    return updated
  }

  async function softDelete(orgSlug: string, attributeId: number) {
    const api = useApi()
    await api(`/organizations/${orgSlug}/piece-attributes/${attributeId}`, { method: 'DELETE' })
    setList(orgSlug, listFor(orgSlug).filter(a => a.id !== attributeId))
  }

  function reset() {
    byOrg.value = {}
    loading.value = false
    loadedOrgSlugs.value = new Set()
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
