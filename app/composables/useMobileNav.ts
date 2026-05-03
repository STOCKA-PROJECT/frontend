import { onBeforeUnmount, onMounted, watch } from 'vue'

/**
 * Shared open/closed state for the dashboard's mobile navigation drawer.
 *
 * The Topbar toggles it; the Sidebar reads it to decide whether to render the
 * drawer overlay. State is held by `useState` so SSR and the two sibling
 * components stay in sync without prop drilling.
 *
 * The composable also wires three side effects when called from the consumer
 * that owns the drawer (typically the Sidebar):
 *
 * <ul>
 *   <li>Closes on route change.</li>
 *   <li>Closes when the user presses {@code Escape}.</li>
 *   <li>Locks {@code document.body} scroll while open.</li>
 * </ul>
 *
 * Topbar callers can pass {@code observeSideEffects: false} to skip those
 * effects (otherwise both components would attach listeners twice).
 *
 * @param options optional flags; pass {@code { observeSideEffects: false }} on
 *                consumers that only need to read/toggle the flag
 * @return reactive state object with {@code isOpen}, {@code open}, {@code close}, {@code toggle}
 */
export function useMobileNav(options: { observeSideEffects?: boolean } = {}) {
  const isOpen = useState<boolean>('mobile-nav-open', () => false)

  function open() {
    isOpen.value = true
  }
  function close() {
    isOpen.value = false
  }
  function toggle() {
    isOpen.value = !isOpen.value
  }

  if (options.observeSideEffects !== false) {
    const route = useRoute()

    watch(() => route.fullPath, () => {
      if (isOpen.value) close()
    })

    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen.value) close()
    }

    onMounted(() => {
      document.addEventListener('keydown', onKeydown)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('keydown', onKeydown)
      if (typeof document !== 'undefined') {
        document.body.style.overflow = ''
      }
    })

    watch(isOpen, (open) => {
      if (typeof document === 'undefined') return
      document.body.style.overflow = open ? 'hidden' : ''
    })
  }

  return { isOpen, open, close, toggle }
}
