/** Groups of the port list, in display order; strips and their segments share one group. */
export const PORT_GROUP_IDS = ['relay', 'motor', 'leds', 'moving_head', 'audio', 'sensor', 'gpio_expander', 'other'] as const
export type PortGroupId = (typeof PORT_GROUP_IDS)[number]

const GROUP_OF_KIND: Record<string, PortGroupId> = {
  relay: 'relay',
  motor: 'motor',
  led_strip: 'leds',
  led_segment: 'leds',
  moving_head: 'moving_head',
  audio: 'audio',
  sensor: 'sensor',
  gpio_expander: 'gpio_expander',
}

/** What the grouping needs from a port of `status.hardware`. */
export interface PortLike {
  name: string
  kind: string
  off: boolean
  pieces?: string[]
}

export interface PortGroup<T extends PortLike> {
  id: PortGroupId
  /** Ports with pieces first (by piece), then the free ones (by port name). */
  ports: T[]
  /** How many ports of the group are cut. */
  cut: number
  /** How many ports of the group drive a piece of the loaded show. */
  withPieces: number
}

/** The group a port kind belongs to; kinds this version does not know go to `other`. */
export function portGroupOf(kind: string): PortGroupId {
  return GROUP_OF_KIND[kind] ?? 'other'
}

/** The pieces a port drives in the loaded show («Pastor · Ovella»), or '' when it drives none. */
export function portPieces(port: Pick<PortLike, 'pieces'>): string {
  return (port.pieces ?? []).filter((piece) => piece.trim() !== '').join(' · ')
}

/** What a port is called in the list: its pieces, or its own name when it drives none. */
export function portTitle(port: Pick<PortLike, 'name' | 'pieces'>): string {
  return portPieces(port) || port.name
}

/**
 * The ports by group, in {@link PORT_GROUP_IDS} order and without the empty groups. Inside a group
 * the ports that drive a piece come first; numbers in names sort naturally («Relé 2» before «Relé 10»).
 */
export function groupPorts<T extends PortLike>(hardware: readonly T[], locale = 'ca'): PortGroup<T>[] {
  const byGroup = new Map<PortGroupId, T[]>()
  for (const port of hardware) {
    const id = portGroupOf(port.kind)
    const list = byGroup.get(id)
    if (list) list.push(port)
    else byGroup.set(id, [port])
  }
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  const groups: PortGroup<T>[] = []
  for (const id of PORT_GROUP_IDS) {
    const ports = byGroup.get(id)
    if (!ports) continue
    ports.sort((a, b) => {
      const free = Number(portPieces(a) === '') - Number(portPieces(b) === '')
      return free || collator.compare(portTitle(a), portTitle(b)) || collator.compare(a.name, b.name)
    })
    groups.push({ id, ports, cut: ports.filter((p) => p.off).length, withPieces: ports.filter((p) => portPieces(p) !== '').length })
  }
  return groups
}

/**
 * Whether a group shows its ports. A group with a cut port or a port under test is always open (nothing
 * in force hides); otherwise what the user chose, and before any choice only the groups with pieces.
 */
export function isGroupOpen(group: PortGroup<PortLike>, testing: ReadonlySet<string>, chosen: Partial<Record<PortGroupId, boolean>>): boolean {
  if (group.cut > 0 || group.ports.some((p) => testing.has(p.name))) return true
  return chosen[group.id] ?? group.withPieces > 0
}

/** Reads the open/closed choices saved under `key`; anything unreadable is no choice at all. */
export function readGroupChoices(storage: Pick<Storage, 'getItem'> | undefined, key: string): Partial<Record<PortGroupId, boolean>> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(key) ?? 'null')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Partial<Record<PortGroupId, boolean>> = {}
    for (const id of PORT_GROUP_IDS) {
      const value = (parsed as Record<string, unknown>)[id]
      if (typeof value === 'boolean') out[id] = value
    }
    return out
  } catch {
    return {}
  }
}

/** Saves the open/closed choices; a full or forbidden storage is ignored (the choice lasts the session). */
export function writeGroupChoices(storage: Pick<Storage, 'setItem'> | undefined, key: string, chosen: Partial<Record<PortGroupId, boolean>>): void {
  try {
    storage?.setItem(key, JSON.stringify(chosen))
  } catch {
    // nothing to do: the choice is a convenience
  }
}
