import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

/**
 * Reactive flag that turns true once the window has been scrolled past
 * `threshold` px. SSR-safe: defaults to `false` until mounted.
 */
export function useScrolled(threshold = 6) {
  const scrolled = shallowRef(false)

  onMounted(() => {
    const onScroll = () => { scrolled.value = window.scrollY > threshold }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
  })

  return scrolled
}
