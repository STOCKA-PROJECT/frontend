import { proxyRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const base = getBackendBaseUrl()
  const target = `${base}${event.path}`

  return await proxyRequest(event, target, {
    fetchOptions: {
      redirect: 'manual'
    }
  })
})
