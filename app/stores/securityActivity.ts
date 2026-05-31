import { defineStore } from 'pinia'
import type { PagedResponse, SecurityActivityEntry } from '~/types/api'

const DEFAULT_PAGE_SIZE = 20

/**
 * Mirror of the user's own security audit log. Kept separate from {@code auth}
 * so unauthenticated areas don't pull this state into their store.
 *
 * <p>The list is paginated server-side; the store keeps the current page only
 * and exposes a {@code fetch(page)} action.
 */
export const useSecurityActivityStore = defineStore('securityActivity', () => {
  const entries = ref<SecurityActivityEntry[]>([])
  const page = ref(0)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const totalElements = ref(0)
  const totalPages = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPage(targetPage = 0, size = pageSize.value): Promise<void> {
    const api = useApi()
    loading.value = true
    error.value = null
    try {
      const data = await api<PagedResponse<SecurityActivityEntry>>(
        '/users/me/security/activity',
        { query: { page: targetPage, size } }
      )
      entries.value = data.content
      page.value = data.number
      pageSize.value = data.size
      totalElements.value = data.totalElements
      totalPages.value = data.totalPages
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      throw err
    } finally {
      loading.value = false
    }
  }

  function reset() {
    entries.value = []
    page.value = 0
    pageSize.value = DEFAULT_PAGE_SIZE
    totalElements.value = 0
    totalPages.value = 0
    loading.value = false
    error.value = null
  }

  return { entries, page, pageSize, totalElements, totalPages, loading, error, fetchPage, reset }
})
