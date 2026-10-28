import { FetchError } from 'ofetch'

/**
 * Browser-side helpers to save a server response as a file.
 *
 * Downloads that need the session cannot be plain `<a href>` links: the access
 * token lives in the httpOnly `stocka_token` cookie and only the BFF proxy
 * (`server/api/[...path].ts`) turns it into an `Authorization` header. Callers
 * therefore fetch the bytes through `useApi()` and hand the resulting `Blob`
 * to {@link triggerDownload}.
 */

const UNSAFE_FILENAME_CHARS = /[\\/\u0000-\u001f\u007f]/g

/**
 * Saves a `Blob` by clicking a temporary `<a download>` that points at an
 * object URL. The URL is revoked on the next tick so browsers that start the
 * download asynchronously (Firefox, Safari) still see it alive.
 *
 * @param blob bytes to save
 * @param filename name suggested to the browser
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Extracts the file name from a `Content-Disposition` header, honouring the
 * RFC 5987 `filename*=UTF-8''…` form before the plain `filename=` one.
 * Path separators and control characters are stripped.
 *
 * @param header raw header value, `null`/`undefined` when absent
 * @returns the sanitised file name, or `null` when the header carries none
 */
export function filenameFromContentDisposition(header: string | null | undefined): string | null {
  if (!header) return null

  const extended = /filename\*\s*=\s*utf-8''([^;]+)/i.exec(header)
  if (extended?.[1]) {
    try {
      const decoded = sanitizeFilename(decodeURIComponent(stripQuotes(extended[1])))
      if (decoded) return decoded
    } catch {
      // malformed percent-encoding: fall back to the plain parameter
    }
  }

  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header)
  const raw = plain?.[2] ?? plain?.[1]
  return raw ? sanitizeFilename(stripQuotes(raw)) : null
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^"|"$/g, '')
}

function sanitizeFilename(value: string): string | null {
  const clean = value.replace(UNSAFE_FILENAME_CHARS, '').trim()
  return clean.length > 0 ? clean : null
}

/**
 * With `responseType: 'blob'` ofetch also parses error bodies as a `Blob`. Put the
 * ProblemDetail JSON back in place so `useApiError()` can read `code`, `detail` and
 * `issues` exactly as for any other request. `FetchError.data` is a getter over
 * `response._data`, so only the latter is assigned.
 *
 * @param err what a blob request rejected with
 */
export async function restoreJsonErrorBody(err: unknown): Promise<void> {
  if (!(err instanceof FetchError) || !err.response) return
  const data: unknown = err.response._data
  if (!(data instanceof Blob)) return
  const contentType = err.response.headers.get('content-type') ?? ''
  if (!/json/i.test(contentType)) return
  try {
    err.response._data = JSON.parse(await data.text())
  } catch {
    // not JSON after all: useApiError falls back to its generic message
  }
}
