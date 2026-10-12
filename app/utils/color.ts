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

/**
 * Parses a list of colours: an array of colours in any {@link parseRgb} notation, a JSON array in
 * text form, or colours separated by `;` (`#f00;#0f0`). An empty list is valid.
 */
export function parseRgbList(value: unknown): Rgb[] | null {
  let items: unknown[]
  if (Array.isArray(value)) {
    items = value
  } else if (typeof value === 'string') {
    const text = value.trim()
    if (text === '') return []
    if (text.startsWith('[') && !/^\[\s*\d/.test(text)) {
      try {
        const parsed: unknown = JSON.parse(text)
        if (!Array.isArray(parsed)) return null
        items = parsed
      } catch {
        return null
      }
    } else {
      items = text.split(';')
    }
  } else {
    return null
  }
  const out: Rgb[] = []
  for (const item of items) {
    const rgb = parseRgb(item)
    if (!rgb) return null
    out.push(rgb)
  }
  return out
}

/** `#rrggbb` form of a colour. */
export function rgbToHex(rgb: Rgb): string {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('')
}
