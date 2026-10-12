/**
 * Measures the length of an audio file in the browser before uploading it. Uses an `<audio>`
 * element (metadata only, no decoding), so it costs nothing for files of tens of megabytes.
 * Resolves to null when the browser cannot read the format.
 */
export function probeAudioDuration(file: File): Promise<number | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    const done = (ms: number | null) => {
      URL.revokeObjectURL(url)
      audio.removeAttribute('src')
      resolve(ms)
    }
    audio.addEventListener('loadedmetadata', () => {
      const sec = audio.duration
      done(Number.isFinite(sec) && sec >= 0 ? Math.round(sec * 1000) : null)
    }, { once: true })
    audio.addEventListener('error', () => done(null), { once: true })
    audio.src = url
  })
}

/** `m:ss` (or `h:mm:ss`) for a duration in milliseconds; `—` when unknown. */
export function formatAudioDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`
}
