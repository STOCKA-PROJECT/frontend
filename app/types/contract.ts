import type { AttributeType } from '~/types/api'

// Output catalog served by the backend at GET /contract/catalog. It is the vocabulary shared with
// the Raspberry Pi player: the kinds of output a port can be, what each kind needs in its config,
// and the actions (with typed parameters) a piece type of that kind may define.

export type OutputKind = 'relay' | 'led_strip' | 'led_segment' | 'motor' | 'audio' | 'video' | 'button'
export type CatalogType = 'int' | 'number' | 'bool' | 'string' | 'rgb' | 'enum'

export const OUTPUT_KINDS: readonly OutputKind[] = ['relay', 'led_strip', 'led_segment', 'motor', 'audio', 'video', 'button']

export interface CatalogParam {
  type: CatalogType
  required?: boolean
  default?: unknown
  min?: number
  max?: number
  values?: string[]
  /** The single parameter that receives the clip length (seconds) in the timeline editor. */
  duration?: boolean
  asset?: 'audio' | 'video'
  /** Config keys only: the value must be the name of a port of this kind. */
  ref?: OutputKind
  recommended?: [number, number]
}

export interface CatalogAnimation {
  params: Record<string, CatalogParam>
  unsupported?: string[]
}

export interface CatalogAction {
  params: Record<string, CatalogParam>
  animations?: Record<string, CatalogAnimation>
  unsupported?: string[]
  continuous?: boolean
}

export interface CatalogKind {
  controller: string
  infrastructure: boolean
  pin: boolean
  config: Record<string, CatalogParam>
  actions: Record<string, CatalogAction>
}

export interface BoardSpec {
  name: string
  gpios: { min: number, max: number }
  reserved: Record<string, string>
  warnings: Record<string, string>
  ws281x: Record<string, { channel: number, via: string, warning?: string }>
  dma: { min: number, max: number, avoid: number[] }
}

export interface OutputCatalog {
  format: 'stocka-catalog'
  version: number
  kinds: Record<OutputKind, CatalogKind>
  boards: Record<string, BoardSpec>
}

export const DEFAULT_BOARD = 'rpi4b'

export function isOutputKind(value: unknown): value is OutputKind {
  return typeof value === 'string' && (OUTPUT_KINDS as readonly string[]).includes(value)
}

/** The attribute type a piece-type action parameter must declare to carry a catalog type. */
export function attributeTypeFor(type: CatalogType): AttributeType {
  switch (type) {
    case 'int': return 'INTEGER'
    case 'number': return 'DECIMAL'
    case 'bool': return 'BOOLEAN'
    case 'enum': return 'SELECT'
    case 'string':
    case 'rgb':
      return 'TEXT'
  }
}

/** Name of the parameter that receives the clip length, if the action has one. */
export function durationParamOf(action: CatalogAction): string | undefined {
  return Object.entries(action.params).find(([, p]) => p.duration)?.[0]
}
