/** RGB triple with components in 0–255. */
export type Rgb = [number, number, number]

/**
 * Parses a colour written as `#rgb`, `#rrggbb`, `r,g,b` or `[r,g,b]` (the formats the output
 * catalog accepts for `rgb` parameters). Returns null when the value is not a colour.
 */
export function parseRgb(value: unknown): Rgb | null {
  if (Array.isArray(value) && value.length === 3 && value.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    return [value[0], value[1], value[2]] as Rgb
  }
  if (typeof value !== 'string') return null
  const text = value.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)
  if (hex) {
    let h = hex[1]!
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const triple = /^\[?\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\]?$/.exec(text)
  if (!triple) return null
  const rgb = [Number(triple[1]), Number(triple[2]), Number(triple[3])] as Rgb
  return rgb.every(n => n <= 255) ? rgb : null
}

/** `#rrggbb` form of a colour. */
export function rgbToHex(rgb: Rgb): string {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('')
}
