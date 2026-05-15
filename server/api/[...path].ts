import { proxyRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const base = getBackendBaseUrl()
  const path = event.path.replace(/^\/api\/?/, '/')
  const target = `${base}${path}`

  const token = getCookie(event, 'stocka_token')
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  return await proxyRequest(event, target, {
    headers,
    fetchOptions: {
      redirect: 'manual'
    }
  })
})
