export type StrengthLevel = 0 | 1 | 2 | 3 | 4

export const STRENGTH_KEYS: Record<StrengthLevel, string> = {
  0: '',
  1: 'auth.strength.weak',
  2: 'auth.strength.fair',
  3: 'auth.strength.good',
  4: 'auth.strength.strong'
}

export function scorePassword(pw: string): StrengthLevel {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const final = Math.min(4, Math.max(pw ? 1 : 0, score - 1))
  return final as StrengthLevel
}
