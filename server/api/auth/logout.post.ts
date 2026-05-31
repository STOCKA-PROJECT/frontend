export default defineEventHandler(async (event) => {
  const accessToken = getAccessCookie(event)
  const refreshToken = getRefreshCookie(event)
  const base = getBackendBaseUrl()

  if (accessToken) {
    try {
      await $fetch(`${base}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(refreshToken ? { cookie: `stocka_refresh=${refreshToken}` } : {})
        }
      })
    } catch {
      // logout is fire-and-forget; clear cookies regardless
    }
  }

  clearAuthCookies(event)
  return { success: true }
})
