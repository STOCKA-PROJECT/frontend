/**
 * Calls `tick` every `intervalMs` while the document is visible, and once more as soon as a
 * hidden tab becomes visible again, so a list left in the background catches up right away.
 * Nothing runs during SSR or while the tab is hidden. Must be called in a component's setup:
 * it hooks `onMounted`/`onBeforeUnmount`.
 *
 * @param tick refresh callback; it must handle its own failures (rejections are not awaited)
 * @param intervalMs period between two refreshes while the tab is visible
 */
export function useVisiblePolling(tick: () => unknown, intervalMs: number): void {
  let timer: ReturnType<typeof setInterval> | null = null

  function isVisible(): boolean {
    return document.visibilityState === 'visible'
  }

  function run() {
    if (isVisible()) void tick()
  }

  onMounted(() => {
    timer = setInterval(run, intervalMs)
    document.addEventListener('visibilitychange', run)
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', run)
  })
}
