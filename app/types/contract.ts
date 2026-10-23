import type { AttributeType } from '~/types/api'

// Output catalog served by the backend at GET /contract/catalog. It is the vocabulary shared with
// the Raspberry Pi player: the kinds of output a port can be, what each kind needs in its config,
// and the actions (with typed parameters) a piece type of that kind may define.

export type OutputKind = 'relay' | 'gpio_expander' | 'led_strip' | 'led_segment' | 'motor' | 'audio' | 'moving_head' | 'sensor'
export type CatalogType = 'int' | 'number' | 'bool' | 'string' | 'rgb' | 'rgb_list' | 'enum'

export const OUTPUT_KINDS: readonly OutputKind[] = ['relay', 'gpio_expander', 'led_strip', 'led_segment', 'motor', 'audio', 'moving_head', 'sensor']

export interface CatalogParam {
  type: CatalogType
  required?: boolean
  default?: unknown
  min?: number
  max?: number
  values?: string[]
  /** The single parameter that receives the clip length (seconds) in the timeline editor. */
  duration?: boolean
  asset?: 'audio'
  /** Config keys only: the value must be the name of a port of this kind. */
  ref?: OutputKind
  /** Hint for editors: usually fixed on the piece-type action (static) rather than set per clip. */
  static?: boolean
  recommended?: [number, number]
  notes?: string
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
  /** `true`: always a GPIO pin; `'optional'`: a pin unless the config addresses the port otherwise (relay or sensor on an expander); `false`: never (a motor carries its two outputs in the config). */
  pin: boolean | 'optional'
  notes?: string
  config: Record<string, CatalogParam>
  actions: Record<string, CatalogAction>
}

export type PinMode = 'required' | 'optional' | 'none'

/** What a sensor does with the show when it becomes active (`config.onActive`). */
export type SensorOnActive = 'none' | 'play' | 'stop_show' | 'panic'

/** Where a sensor's state comes from: a digital input, or a value read by a model of `profiles.sensor`. */
export type SensorSource = 'digital' | 'measured'

/**
 * Config of a `sensor` port. Digital (default): a native pin (on the port) or an expander channel.
 * Measured: a `model` of `profiles.sensor` with its own wiring, active when the value crosses `threshold`.
 */
export interface SensorConfig {
  /** Default `digital`. */
  source?: SensorSource
  expander?: string
  channel?: number
  /** Default `true`: active when the input is low (contact to ground with pull-up). */
  activeLow?: boolean
  /** Default `up`; on an expander only `up` or `none`. */
  pull?: 'up' | 'down' | 'none'
  /** 0–2000 ms, default 50. */
  debounceMs?: number
  /** Default `none` (limit switch only). */
  onActive?: SensorOnActive
  /** Measured only: id of a `profiles.sensor` entry. */
  model?: string
  /** Measured only: required when the model measures more than one quantity. */
  quantity?: string
  /** Measured, I2C models: bus (default 1) and address (default the profile's first). */
  bus?: number
  address?: number
  /** Measured, `trig_echo` models: the two GPIOs. */
  pinTrig?: number
  pinEcho?: number
  /** Measured, 1-Wire models: `28-xxxxxxxxxxxx`; without it, the first sensor of the bus. */
  deviceId?: string
  /** Measured: in the unit of the quantity. */
  threshold?: number
  /** Measured: `below` = active at or under the threshold, `above` = at or over it. */
  activeWhen?: 'above' | 'below'
  /** Measured: margin to release, default 0. */
  hysteresis?: number
  /** Measured: reading period, default the profile's. */
  pollMs?: number
}

/** How a measured-sensor model is connected to the Pi. */
export type SensorWiring = 'i2c' | 'onewire' | 'trig_echo'

/** A measured-sensor model (`profiles.sensor.<id>`): wiring, I2C addresses and measured quantities. */
export interface SensorProfile {
  name: string
  wiring: SensorWiring
  /** I2C models: accepted addresses, the first is the default. */
  addresses?: number[]
  quantities: Record<string, { unit: string, min: number, max: number }>
  pollMs: number
  notes?: string
}

/**
 * Config of an H-bridge `motor` port: both outputs on native GPIOs (`pinForward` + `pinReverse`,
 * optional `activeLow`) or both on channels of the same expander, never mixed.
 */
export interface MotorConfig {
  pinForward?: number
  pinReverse?: number
  expander?: string
  channelForward?: number
  channelReverse?: number
  /** Native outputs only; on an expander the board decides. */
  activeLow?: boolean
  /** 0–5000 ms, default 50: both outputs off when reversing. */
  switchDelayMs?: number
  /** Hard cut, seconds, per direction. */
  maxTimeForward: number
  maxTimeReverse: number
  /** Name of a `sensor` port: limit switch of each direction. */
  limitForward?: string
  limitReverse?: string
  /** A direction with a limit switch that ends by max time locks the motor until unlocked on the Pi. */
  lockOnTimeout?: boolean
}

/** How ports of a kind carry their pin. */
export function pinModeOf(spec: CatalogKind | null | undefined): PinMode {
  if (!spec) return 'none'
  if (spec.pin === true) return 'required'
  if (spec.pin === 'optional') return 'optional'
  return 'none'
}

/** A DMX fixture profile (`profiles.moving_head.<id>`): channel count and physical ranges. */
export interface FixtureProfile {
  name: string
  mode?: string
  channels: number
  pan: { max: number }
  tilt: { max: number }
  zoom: { min: number, max: number }
  notes?: string
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
  profiles?: { moving_head?: Record<string, FixtureProfile>, sensor?: Record<string, SensorProfile> }
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
    case 'rgb_list':
      return 'TEXT'
  }
}

/** Name of the parameter that receives the clip length, if the action has one. */
export function durationParamOf(action: CatalogAction): string | undefined {
  return Object.entries(action.params).find(([, p]) => p.duration)?.[0]
}
