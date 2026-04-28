import { ref, toValue, watch, onScopeDispose, type MaybeRefOrGetter } from 'vue'
import type { AvailabilityResponse, AvailabilityReason } from '~/types/api'

export type AvailabilityStatus =
  | 'idle'
  | 'invalid'
  | 'checking'
  | 'available'
  | 'taken'
  | 'reserved'

export interface UseAvailabilityOptions {
  isFormatValid: (value: string) => boolean
  fetcher: (value: string, signal: AbortSignal) => Promise<AvailabilityResponse>
  debounceMs?: number
}

export function useAvailability(
  value: MaybeRefOrGetter<string>,
  opts: UseAvailabilityOptions
) {
  const status = ref<AvailabilityStatus>('idle')
  const debounceMs = opts.debounceMs ?? 400

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let controller: AbortController | null = null

  function cancelInFlight() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (controller) {
      controller.abort()
      controller = null
    }
  }

  function reasonToStatus(reason: AvailabilityReason | null | undefined): AvailabilityStatus {
    switch (reason) {
      case 'TAKEN': return 'taken'
      case 'RESERVED': return 'reserved'
      case 'INVALID_FORMAT': return 'invalid'
      default: return 'available'
    }
  }

  watch(
    () => toValue(value),
    (current) => {
      cancelInFlight()

      if (!current) {
        status.value = 'idle'
        return
      }
      if (!opts.isFormatValid(current)) {
        status.value = 'invalid'
        return
      }

      status.value = 'checking'

      debounceTimer = setTimeout(async () => {
        controller = new AbortController()
        const signal = controller.signal
        try {
          const result = await opts.fetcher(current, signal)
          if (signal.aborted) return
          status.value = result.available ? 'available' : reasonToStatus(result.reason)
        } catch (err) {
          if (signal.aborted) return
          status.value = 'idle'
        }
      }, debounceMs)
    },
    { immediate: true }
  )

  onScopeDispose(() => cancelInFlight())

  return { status }
}
