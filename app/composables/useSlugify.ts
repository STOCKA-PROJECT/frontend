const COMBINING_MARKS = /[̀-ͯ]/g

export function slugify(input: string, maxLength = 24): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, maxLength)
}

export function slugifyOrgName(input: string, maxLength = 32): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
}
