import type { OrganizationResponseDto } from '~/types/api'

/**
 * Reads the active organization from the current route (`/dashboard/{orgSlug}/...`) and
 * resolves it against the loaded list in the organizations store. The slug in the URL is
 * the single source of truth — there is no cookie or store-only "current org" anymore.
 *
 * Returns reactive refs so callers can `watch` them; updates to the slug (the user
 * navigates to a different org) trigger reloads without remounting the page component.
 */
export function useCurrentOrg() {
  const route = useRoute()
  const orgs = useOrganizationsStore()

  const slug = computed<string | null>(() => {
    const raw = route.params.orgSlug
    if (typeof raw === 'string' && raw.length > 0) return raw
    return null
  })

  const org = computed<OrganizationResponseDto | null>(() => {
    const s = slug.value
    if (!s) return null
    return orgs.list.find(o => o.slug === s) ?? null
  })

  const id = computed<number | null>(() => org.value?.id ?? null)

  return { slug, org, id }
}
