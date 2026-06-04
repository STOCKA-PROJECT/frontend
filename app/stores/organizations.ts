import { defineStore } from 'pinia'
import type {
  AvailabilityResponse,
  CreateOrganizationDto,
  OrganizationLookupResponseDto,
  OrganizationResponseDto,
  UpdateOrganizationDto
} from '~/types/api'

/**
 * Organizations store. The "active" organization is encoded in the URL as `:orgSlug`
 * (see `useCurrentOrg`), so this store does not own that selection — it just keeps the
 * list of orgs the user belongs to and remembers the last slug used in a cookie so the
 * `/dashboard` redirector can land users back on their previous org.
 */
export const useOrganizationsStore = defineStore('organizations', () => {
  const list = ref<OrganizationResponseDto[]>([])
  const lastSlugCookie = useCookie<string | null>('stocka_last_org_slug', {
    sameSite: 'lax',
    secure: !import.meta.dev,
    maxAge: 60 * 60 * 24 * 365
  })

  // Drop the legacy cookie used by the pre-slug routing so it stops piling up.
  if (import.meta.client) {
    const legacy = useCookie<unknown>('stocka_org_id')
    if (legacy.value != null) legacy.value = null
  }

  function findBySlug(slug: string): OrganizationResponseDto | undefined {
    return list.value.find(o => o.slug === slug)
  }

  const isDesktop = (): boolean => !!useRuntimeConfig().public.desktop

  /** Per-account localStorage key caching the org list for offline org resolution (desktop). */
  function orgsCacheKey(): string {
    const userId = useAuthStore().user?.id ?? 'anon'
    return `stocka_orgs_${userId}`
  }

  function rememberSlug(slug: string | null) {
    lastSlugCookie.value = slug
  }

  async function fetchList() {
    if (isDesktop()) {
      // Desktop: fetch online and cache locally; fall back to the cache when offline so org
      // resolution (and thus the dashboard shell) keeps working without connectivity.
      try {
        const data = await useApi()<OrganizationResponseDto[]>('/organizations')
        list.value = data
        if (import.meta.client) {
          try { localStorage.setItem(orgsCacheKey(), JSON.stringify(data)) } catch { /* quota */ }
        }
        if (lastSlugCookie.value && !data.some(o => o.slug === lastSlugCookie.value)) {
          lastSlugCookie.value = null
        }
        return data
      } catch (err) {
        if (import.meta.client) {
          const raw = localStorage.getItem(orgsCacheKey())
          if (raw) {
            try { list.value = JSON.parse(raw) as OrganizationResponseDto[] } catch { /* corrupt */ }
          }
        }
        if (list.value.length === 0) throw err
        return list.value
      }
    }
    const api = useApi()
    const data = await api<OrganizationResponseDto[]>('/organizations')
    list.value = data
    // Drop the remembered slug if the org disappeared (user left or it was deleted).
    if (lastSlugCookie.value && !data.some(o => o.slug === lastSlugCookie.value)) {
      lastSlugCookie.value = null
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
    lastSlugCookie.value = created.slug
    return created
  }

  async function update(orgSlug: string, payload: UpdateOrganizationDto) {
    const api = useApi()
    const updated = await api<OrganizationResponseDto>(`/organizations/${orgSlug}`, {
      method: 'PATCH',
      body: payload
    })
    list.value = list.value.map(o => (o.id === updated.id ? updated : o))
    if (lastSlugCookie.value === orgSlug) {
      lastSlugCookie.value = updated.slug
    }
    return updated
  }

  async function remove(orgSlug: string) {
    const api = useApi()
    await api(`/organizations/${orgSlug}`, { method: 'DELETE' })
    list.value = list.value.filter(o => o.slug !== orgSlug)
    if (lastSlugCookie.value === orgSlug) {
      lastSlugCookie.value = null
    }
  }

  async function checkSlug(slug: string, signal?: AbortSignal): Promise<AvailabilityResponse> {
    const api = useApi()
    return await api<AvailabilityResponse>('/organizations/check-slug', {
      method: 'GET',
      query: { slug },
      signal
    })
  }

  /**
   * Resolves a slug — current or historical — against the backend. Used by the route
   * middleware when the slug in the URL is not in the loaded list (deep link, recently
   * accepted invitation, or a slug rename happened in another session).
   */
  async function lookupBySlug(slug: string): Promise<OrganizationLookupResponseDto> {
    const api = useApi()
    const result = await api<OrganizationLookupResponseDto>(`/organizations/by-slug/${encodeURIComponent(slug)}`)
    // Keep the local list in sync so the next access avoids the round-trip.
    const idx = list.value.findIndex(o => o.id === result.org.id)
    if (idx >= 0) {
      list.value = list.value.map(o => (o.id === result.org.id ? result.org : o))
    } else {
      list.value = [...list.value, result.org]
    }
    return result
  }

  function reset() {
    list.value = []
    lastSlugCookie.value = null
  }

  return {
    list,
    lastSlug: lastSlugCookie,
    findBySlug,
    rememberSlug,
    fetchList,
    create,
    update,
    remove,
    checkSlug,
    lookupBySlug,
    reset
  }
})
