import { FetchError } from 'ofetch'
import type { MaybeRefOrGetter } from 'vue'
import type { SceneIssueDto, TimelineResponseDto } from '~/types/api'
import { triggerDownload } from '~/utils/download'

/** Which artefact of a timeline is being downloaded. */
export type TimelineDownloadKind = 'bundle' | 'show'

/**
 * Localised description of a failed download: a one-line message and, for a 422 with
 * blocking scene errors, the first issues so the user knows what to fix in the editor.
 */
export interface TimelineDownloadFailure {
  message: string
  issues: string[]
}

const MAX_ISSUES_SHOWN = 3

function isSceneIssue(value: unknown): value is SceneIssueDto {
  return typeof value === 'object' && value !== null
    && typeof (value as SceneIssueDto).message === 'string'
}

/** Reads the `issues` array of a ProblemDetail body (422 of `/bundle` and `/show`), if any. */
function extractIssues(err: unknown): SceneIssueDto[] {
  if (!(err instanceof FetchError)) return []
  const body = (err.data ?? err.response?._data) as { issues?: unknown } | undefined
  const issues = body?.issues
  return Array.isArray(issues) ? issues.filter(isSceneIssue) : []
}

/**
 * Downloads the bundle (`.belen.zip`) or the show (`show.json`) of a timeline and saves it
 * in the browser. Must be called in a component's setup (it uses `useI18n()`).
 *
 * @param orgSlug slug of the organization that owns the timelines; may be reactive
 */
export function useTimelineDownload(orgSlug: MaybeRefOrGetter<string>) {
  const { t } = useI18n()
  const timelines = useTimelinesStore()
  const apiError = useApiError()

  /** Kind currently being downloaded, `null` when idle. Only one download runs at a time. */
  const busy = shallowRef<TimelineDownloadKind | null>(null)

  function describeFailure(err: unknown, kind: TimelineDownloadKind): TimelineDownloadFailure {
    const fallback = t(kind === 'bundle'
      ? 'dashboard.timelines.errors.download_bundle'
      : 'dashboard.timelines.errors.download_show')
    const view = apiError(err)
    const message = view.code === 'unknown' ? fallback : `${fallback} ${view.description}`

    const all = extractIssues(err)
    const ordered = [...all.filter(i => i.level === 'error'), ...all.filter(i => i.level !== 'error')]
    const issues = ordered.slice(0, MAX_ISSUES_SHOWN).map(i => i.message)
    if (ordered.length > MAX_ISSUES_SHOWN) {
      issues.push(t('dashboard.timelines.download.issues_more', { n: ordered.length - MAX_ISSUES_SHOWN }))
    }
    return { message, issues }
  }

  /**
   * Downloads `kind` of `timeline`. Resolves to `null` on success and to a localised failure
   * otherwise; never throws. Ignored (resolves `null`) while another download is running.
   */
  async function download(
    timeline: TimelineResponseDto,
    kind: TimelineDownloadKind
  ): Promise<TimelineDownloadFailure | null> {
    if (busy.value !== null) return null
    busy.value = kind
    try {
      const slug = toValue(orgSlug)
      const file = kind === 'bundle'
        ? await timelines.downloadBundle(slug, timeline)
        : await timelines.downloadShow(slug, timeline)
      triggerDownload(file.blob, file.filename)
      return null
    } catch (err) {
      return describeFailure(err, kind)
    } finally {
      busy.value = null
    }
  }

  return { busy: readonly(busy), download }
}
