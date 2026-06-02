import type { AttributeType, AttributeValidatorsDto, OrganizationRole } from '~/types/api'

/**
 * Shared, framework-agnostic helpers for the attribute/parameter typing system. These mirror the
 * rules used by {@link PieceTypeAttributeFormDialog} so piece-type action parameters can reuse the
 * exact same {@link AttributeType} and {@link AttributeValidatorsDto} machinery.
 */

export type ValidatorKey = keyof AttributeValidatorsDto

export const ATTRIBUTE_TYPES: AttributeType[] = [
  'TEXT', 'LONGTEXT', 'INTEGER', 'DECIMAL', 'PRICE',
  'DATE', 'DATETIME', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'URL', 'EMAIL', 'MEMBER'
]

export const ORG_ROLES: OrganizationRole[] = ['OWNER', 'MANAGER', 'USER', 'SPECTATOR']

/** Which validator fields are relevant for each attribute/parameter type. */
export const VALIDATOR_FIELDS: Record<AttributeType, ValidatorKey[]> = {
  TEXT: ['minLength', 'maxLength', 'regex'],
  LONGTEXT: ['minLength', 'maxLength'],
  INTEGER: ['min', 'max'],
  DECIMAL: ['min', 'max', 'decimals'],
  PRICE: ['min', 'max', 'decimals', 'currency'],
  DATE: ['minDate', 'maxDate', 'allowFuture', 'allowPast'],
  DATETIME: ['minDate', 'maxDate', 'allowFuture', 'allowPast'],
  BOOLEAN: [],
  SELECT: ['options'],
  MULTI_SELECT: ['options', 'minItems', 'maxItems'],
  URL: ['maxLength'],
  EMAIL: ['maxLength'],
  MEMBER: ['eligibleRoles']
}

/** Canonical technical-name shape shared by attributes, actions and parameters. */
export const NAME_PATTERN = /^[a-z][a-z0-9_]{0,79}$/

/** Derives a valid technical name (lowercase + underscores) from a free-text display name. */
export function slugifyName(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return /^[a-z]/.test(base) ? base : (base ? `a_${base}`.slice(0, 80) : '')
}

/** Strips empty/blank/undefined entries; returns `undefined` when nothing meaningful remains. */
export function cleanValidators(input: AttributeValidatorsDto): AttributeValidatorsDto | undefined {
  const out: AttributeValidatorsDto = {}
  let any = false
  for (const k of Object.keys(input) as ValidatorKey[]) {
    const v = input[k]
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v.trim() === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    ;(out as Record<string, unknown>)[k] = v
    any = true
  }
  return any ? out : undefined
}
