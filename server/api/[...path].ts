import { proxyRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const base = getBackendBaseUrl()
  const path = event.path.replace(/^\/api\/?/, '/')
  const target = `${base}${path}`

  return await proxyRequest(event, target, {
    fetchOptions: {
      redirect: 'manual'
    }
  })
})
