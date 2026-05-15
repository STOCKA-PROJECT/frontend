import { defineStore } from 'pinia'
import type {
  AvailabilityResponse,
  CreateOrganizationDto,
  OrganizationResponseDto,
  UpdateOrganizationDto
} from '~/types/api'

export const useOrganizationsStore = defineStore('organizations', () => {
  const list = ref<OrganizationResponseDto[]>([])
  const currentIdCookie = useCookie<number | null>('stocka_org_id', {
    sameSite: 'lax',
    secure: !import.meta.dev
  })

  const current = computed<OrganizationResponseDto | null>(() => {
    if (!currentIdCookie.value) return null
    return list.value.find(o => o.id === currentIdCookie.value) ?? null
  })

  function clearOrgScopedStores() {
    useLocationsStore().reset()
    usePiecesStore().reset()
    usePieceTypesStore().reset()
    useTeamStore().reset()
    useOrganizationPieceAttributesStore().reset()
  }

  function applyCurrent(id: number | null) {
    if (currentIdCookie.value === id) return
    currentIdCookie.value = id
    clearOrgScopedStores()
  }

  function setCurrent(id: number | null) {
    applyCurrent(id)
  }

  async function fetchList() {
    const api = useApi()
    const data = await api<OrganizationResponseDto[]>('/organizations')
    list.value = data
    if (data.length > 0 && (!currentIdCookie.value || !data.find(o => o.id === currentIdCookie.value))) {
      applyCurrent(data[0]!.id)
    }
    if (data.length === 0) {
      applyCurrent(null)
    }
    return data
  }

  async function create(payload: CreateOrganizationDto) {
    const api = useApi()
    const created = await api<OrganizationResponseDto>('/organizations', {
      method: 'POST',
      body: payload
    })
    list.value = [...list.value, created]
    applyCurrent(created.id)
    return created
  }

  async function update(orgId: number, payload: UpdateOrganizationDto) {
    const api = useApi()
    const updated = await api<OrganizationResponseDto>(`/organizations/${orgId}`, {
      method: 'PATCH',
      body: payload
    })
    list.value = list.value.map(o => (o.id === updated.id ? updated : o))
    return updated
  }

  async function checkSlug(slug: string, signal?: AbortSignal): Promise<AvailabilityResponse> {
    const api = useApi()
    return await api<AvailabilityResponse>('/organizations/check-slug', {
      method: 'GET',
      query: { slug },
      signal
    })
  }

  function reset() {
    list.value = []
    applyCurrent(null)
  }

  return {
    list,
    currentId: currentIdCookie,
    current,
    setCurrent,
    fetchList,
    create,
    update,
    checkSlug,
    reset
  }
})
