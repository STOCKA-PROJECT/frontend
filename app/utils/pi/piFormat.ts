// Formatting of what the belén player reports, for the device page (ported from the belén app's
// `util/format.ts` and `util/piLabels.ts`). Locale-neutral except where a locale is passed.

/** `1.2 MB` from bytes; `—` when unknown. */
export function formatBytes(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = n
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(i ? 1 : 0)} ${units[i]}`
}

/** `2 h 17 min` from seconds. */
export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h ? `${h} h ${m} min` : `${m} min`
}

/** `m:ss` from milliseconds. */
export function formatMs(ms: number | null | undefined): string {
  const s = Math.floor((ms ?? 0) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Whole percent of `done` over `total`, clamped to 0–100. */
export function percent(done: number, total: number | null | undefined): number {
  if (!total || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
}

/** `sha256:3b34827b…` → `3b34827b`. */
export function hash8(hash: string | null | undefined): string {
  return hash ? hash.replace(/^sha256:/, '').slice(0, 8) : ''
}

/** An audio asset of the Pi without the attachment id Stocka puts in front (`12-riu.mp3` → `riu.mp3`). */
export function audioLabel(name: string): string {
  return name.replace(/^\d+-(?=.)/, '')
}

/** `#rrggbb` of a colour input as the `[r, g, b]` the Pi takes; black for anything else. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : [0, 0, 0]
}
