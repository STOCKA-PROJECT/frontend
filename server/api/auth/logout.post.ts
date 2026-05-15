export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'stocka_token')
  const base = getBackendBaseUrl()

  if (token) {
    try {
      await $fetch(`${base}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch {
      // logout is fire-and-forget; clear cookie regardless
    }
  }

  deleteCookie(event, 'stocka_token', { path: '/' })
  return { success: true }
})
