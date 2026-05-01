import { FetchError } from 'ofetch'

export interface ApiErrorView {
  /** Code estable del backend o `'unknown'` si no se pudo extraer. */
  code: string
  /** HTTP status si está disponible. */
  status?: number
  /** Título corto, normalmente t('errors.title'). */
  title: string
  /** Descripción ya localizada lista para mostrar al usuario. */
  description: string
  /** Errores por campo (validación). Vacío si no aplica. */
  fieldErrors: Array<{ field: string; code: string; message: string }>
}

interface ProblemDetailBody {
  status?: number
  code?: string
  detail?: string
  message?: string
  params?: Record<string, unknown>
  errors?: Array<{ field: string; code: string; message: string }>
}

function extractBody(err: unknown): ProblemDetailBody | null {
  if (err instanceof FetchError) {
    const data = (err.data ?? err.response?._data) as ProblemDetailBody | undefined
    return data ?? null
  }
  return null
}

/**
 * Devuelve una función que traduce un error HTTP a un {@link ApiErrorView}
 * listo para mostrar. Debe llamarse en el setup del componente porque
 * captura el contexto de `useI18n()`.
 *
 * Cascada para `description`:
 *   1. `errors.<code>` traducido con vue-i18n (interpola `params`).
 *   2. `detail` o `message` que venga del backend (idioma negociado).
 *   3. `errors.generic` como último recurso.
 */
export function useApiError() {
  const { t, te } = useI18n()

  const titleFallback = te('errors.title') ? t('errors.title') : 'Error'
  const genericFallback = te('errors.generic')
    ? t('errors.generic')
    : 'An unexpected error occurred.'

  return function apiError(err: unknown): ApiErrorView {
    const body = extractBody(err)
    const code = body?.code ?? 'unknown'
    const status = body?.status
    const params = body?.params ?? {}
    const fieldErrors = body?.errors ?? []

    let description: string
    const key = `errors.${code}`
    if (te(key)) {
      description = t(key, params as Record<string, unknown>)
    } else if (body?.detail) {
      description = body.detail
    } else if (body?.message) {
      description = body.message
    } else {
      description = genericFallback
    }

    return { code, status, title: titleFallback, description, fieldErrors }
  }
}
