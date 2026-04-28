export function initials(name?: string | null, lastName?: string | null): string {
  const first = (name ?? '').trim().charAt(0)
  const second = (lastName ?? '').trim().charAt(0)
  const result = `${first}${second}`.toUpperCase()
  return result || '?'
}
