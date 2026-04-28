import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'

const DEFAULT_SELECTOR = '.reveal, .reveal-left, .reveal-right, .mock, .features, .steps'

/**
 * Adds an `in-view` class to elements matching `selector` once they enter the
 * viewport. Used to drive CSS-only reveal animations.
 *
 * Re-runs after every route change so that pages mounted via `<NuxtPage>` after
 * a navigation (locale switch, router push, etc.) have their fresh `.reveal`
 * elements observed too. Without this, switching locale on the home page hides
 * the new translated content because it stays at `opacity: 0`.
 */
export function useReveal(selector: string = DEFAULT_SELECTOR) {
  let io: IntersectionObserver | null = null
  const route = useRoute()

  function revealAll() {
    document.querySelectorAll(selector).forEach(el => el.classList.add('in-view'))
  }

  function setup() {
    if (typeof window === 'undefined') return

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealAll()
      return
    }

    io?.disconnect()
    io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('in-view')
        io?.unobserve(entry.target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })

    document.querySelectorAll(selector).forEach((el) => {
      if (el.classList.contains('in-view')) return
      io!.observe(el)
    })
  }

  onMounted(() => {
    setup()
  })

  watch(() => route.fullPath, async () => {
    await nextTick()
    setup()
  })

  onBeforeUnmount(() => {
    io?.disconnect()
    io = null
  })
}
