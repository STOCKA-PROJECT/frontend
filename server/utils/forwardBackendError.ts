import { FetchError } from 'ofetch'
import type { H3Event } from 'h3'
import { setResponseStatus, setResponseHeader } from 'h3'

/**
 * Reenvía un error del backend al cliente preservando status y ProblemDetail
 * al primer nivel del body — para que `useApiError()` pueda leer
 * `err.data.code` y mapear a la clave i18n correspondiente.
 *
 * El handler debe devolver el resultado de esta función:
 *   try { ... } catch (err) { return forwardBackendError(event, err) }
 *
 * Devolver (en vez de lanzar) evita que Nitro envuelva el body con su forma
 * por defecto (`{ statusCode, statusMessage, message, data }`) y evita el log
 * `[request error] [unhandled]` en la consola del server para 4xx esperados.
 */
export function forwardBackendError(event: H3Event, err: unknown): unknown {
  if (err instanceof FetchError && err.statusCode) {
    const body = err.data ?? err.response?._data ?? null
    setResponseStatus(event, err.statusCode, err.statusMessage)
    const upstreamType =
      err.response?.headers.get('content-type') ?? 'application/problem+json'
    setResponseHeader(event, 'content-type', upstreamType)
    return body
  }

  console.error('[backend] upstream error:', err)
  setResponseStatus(event, 502, 'Bad Gateway')
  setResponseHeader(event, 'content-type', 'application/problem+json')
  return {
    type: 'about:blank',
    title: 'Bad Gateway',
    status: 502,
    code: 'gateway.upstream_unreachable',
    detail: 'No se ha podido contactar con el servidor.'
  }
}
