/**
 * Keeps `<img>` elements that point at `/api/...` (cover thumbnails, galleries) alive across the
 * 15-minute access cookie. The browser sends the cookie by itself and caches the immutable
 * responses for a year, so an image normally never fails; but a page left open and scrolled after
 * an idle period lazy-loads with an expired cookie and gets a 401. On error the session is
 * refreshed once (same mutex as the API client) and the image retried under a `?retry=1` suffix;
 * an image that still fails is reported broken so the template can show its placeholder.
 */
export function useImageRetry() {
  const api = useApi()
  const retried = ref<Set<string>>(new Set())
  const broken = ref<Set<string>>(new Set())

  /** The `src` to bind: the URL itself, or its retry variant after a refreshed session. */
  function srcFor(url: string | null | undefined): string | undefined {
    if (!url) return undefined
    return retried.value.has(url) ? `${url}?retry=1` : url
  }

  /** Whether the image gave up (failed again after the session refresh). */
  function isBroken(url: string | null | undefined): boolean {
    return !!url && broken.value.has(url)
  }

  /** `@error` handler: refresh the session once, then retry; a second failure marks it broken. */
  async function onError(url: string | null | undefined) {
    if (!url) return
    if (retried.value.has(url)) {
      broken.value = new Set(broken.value).add(url)
      return
    }
    const refreshed = await api.refresh()
    if (!refreshed) {
      broken.value = new Set(broken.value).add(url)
      return
    }
    retried.value = new Set(retried.value).add(url)
  }

  return { srcFor, isBroken, onError }
}
