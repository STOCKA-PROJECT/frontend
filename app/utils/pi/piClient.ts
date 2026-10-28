// Client of the belén Raspberry Pi's local API (`rpi4-system/app/api/server.py`, belén-api v1) for
// the device page. Ported from the belén app (`belen-app/src/api/pi.ts`, the most complete client)
// with the Local Network Access hint of the editor (`timeline-editor/app/utils/pi/piClient.ts`):
// the page is served over HTTPS and the Pi answers plain HTTP on the local network, which only
// Chrome and Edge allow, after the "local network access" permission. The Pi answers CORS for
// Stocka's origin. Reads are public; commands carry `Authorization: Pin <pin>`.

import type {
  ImportReport,
  MotorDirection,
  OverrideMode,
  PiAlert,
  PiBundles,
  PiInfo,
  PiMotor,
  PiNet,
  PiStatus,
  PiTestParams,
  PiTestStatus,
  PiUpload
} from '~/types/pi'

/** Error codes of belén-api v1 the page reacts to. */
export const PI_CODES = {
  pinRequired: 'pin_required',
  pinInvalid: 'pin_invalid',
  pinLocked: 'pin_locked',
  badOffset: 'bad_offset',
  network: 'network'
} as const

/** `{error, message}` of the Pi API with the HTTP status; `network` when the Pi could not be reached. */
export class PiApiError extends Error {
  readonly status: number
  readonly code: string
  readonly data: Record<string, unknown>

  constructor(status: number, code: string, message: string, data: Record<string, unknown> = {}) {
    super(message || code)
    this.name = 'PiApiError'
    this.status = status
    this.code = code
    this.data = data
  }

  /** The PIN is missing or wrong. */
  get needsPin(): boolean {
    return this.code === PI_CODES.pinRequired || this.code === PI_CODES.pinInvalid
  }

  /** The browser could not reach the Pi (other network, permission refused, unsupported browser). */
  get unreachable(): boolean {
    return this.code === PI_CODES.network
  }
}

export interface PiClientOptions {
  /** Six-digit PIN sent on every write; null = reads only. */
  pin?: string | null
  /** Who acts, shown by the Pi in its log (`X-Name`). */
  name?: string | null
  fetch?: typeof fetch
  /** Size of each piece of a resumable upload; 1 MiB by default. */
  chunkBytes?: number
}

export interface UploadProgress {
  sent: number
  total: number
  /** The bytes are on the Pi and it is verifying and importing the bundle. */
  verifying: boolean
}

const DEFAULT_CHUNK_BYTES = 1024 * 1024
/** How long a read waits before the Pi counts as unreachable. */
const READ_TIMEOUT_MS = 8000

/**
 * Address space hint for Chrome's Local Network Access: `local` for the Pi on the LAN; nothing for
 * loopback (an SSH tunnel on `localhost`), where Chrome would refuse a `local` hint as a mismatch.
 */
export function targetAddressSpaceOf(baseUrl: string): 'local' | undefined {
  const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./.test(host)) return undefined
  return 'local'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJson(res: Response): Promise<unknown> {
  try {
    const text = await res.text()
    return text ? JSON.parse(text) as unknown : null
  } catch {
    return null
  }
}

function errorFrom(status: number, body: unknown, fallback: string): PiApiError {
  const b = isRecord(body) ? body : {}
  const code = typeof b.error === 'string' ? b.error : `http_${status}`
  const message = typeof b.message === 'string' ? b.message : fallback
  return new PiApiError(status, code, message, b)
}

function toReport(b: Record<string, unknown>): ImportReport {
  const issues = (value: unknown) => Array.isArray(value)
    ? value.filter(isRecord).map(i => ({ level: String(i.level ?? 'error'), code: String(i.code ?? ''), message: String(i.message ?? '') }))
    : []
  const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : [])
  return {
    ok: b.ok === true,
    hash: typeof b.hash === 'string' ? b.hash : null,
    name: typeof b.name === 'string' ? b.name : null,
    errors: issues(b.errors),
    warnings: issues(b.warnings),
    imported: strings(b.imported),
    skipped: strings(b.skipped),
    activateRequested: b.activateRequested === true,
    activated: b.activated === true,
    bytes: typeof b.bytes === 'number' ? b.bytes : undefined
  }
}

type RawInit = Omit<RequestInit, 'headers'> & { pin?: boolean, headers?: Record<string, string>, timeoutMs?: number }

export class PiClient {
  readonly baseUrl: string
  private readonly pin: string | null
  private readonly name: string | null
  private readonly fetchFn: typeof fetch
  private readonly chunkBytes: number

  constructor(baseUrl: string, options: PiClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.pin = options.pin ?? null
    this.name = options.name ?? null
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init))
    this.chunkBytes = options.chunkBytes ?? DEFAULT_CHUNK_BYTES
  }

  // ---------------------------------------------------------------- reads

  info(): Promise<PiInfo> { return this.json('/api/info', { timeoutMs: READ_TIMEOUT_MS }) }
  status(): Promise<PiStatus> { return this.json('/api/status', { timeoutMs: READ_TIMEOUT_MS }) }
  bundles(): Promise<PiBundles> { return this.json('/api/bundles') }
  net(): Promise<PiNet> { return this.json('/api/net') }

  async logs(lines = 200): Promise<string[]> {
    const data = await this.json<{ lines?: string[] }>(`/api/logs?n=${lines}`)
    return data.lines ?? []
  }

  async alerts(): Promise<PiAlert[]> {
    const data = await this.json<{ alerts?: unknown }>('/api/alerts')
    return Array.isArray(data?.alerts) ? data.alerts.filter(isRecord) as PiAlert[] : []
  }

  /** The audio files stored on the Pi, what an audio test can play. */
  async audioFiles(): Promise<string[]> {
    const data = await this.json<{ audio?: unknown }>('/api/assets')
    return Array.isArray(data?.audio) ? data.audio.filter((n): n is string => typeof n === 'string') : []
  }

  // ---------------------------------------------------------------- control (PIN)

  /** The Pi has no battery clock: it takes this browser's time while its own is not reliable. */
  syncClock(epochMs: number = Date.now()): Promise<unknown> {
    return this.json('/api/clock', { method: 'POST', body: JSON.stringify({ epochMs }), pin: this.pin !== null })
  }

  play(): Promise<PiStatus> { return this.json('/api/play', { method: 'POST', body: '{}', pin: true }) }
  stop(): Promise<PiStatus> { return this.json('/api/stop', { method: 'POST', pin: true }) }
  panic(): Promise<PiStatus> { return this.json('/api/panic', { method: 'POST', pin: true }) }
  endRehearsal(): Promise<PiStatus> { return this.json('/api/rehearsal', { method: 'DELETE', pin: true }) }
  activate(hash: string): Promise<PiStatus> { return this.json(`/api/bundles/${encodeURIComponent(hash)}/activate`, { method: 'POST', pin: true }) }
  rollback(): Promise<PiStatus> { return this.json('/api/rollback', { method: 'POST', pin: true }) }
  deleteBundle(hash: string): Promise<{ deleted: string }> { return this.json(`/api/bundles/${encodeURIComponent(hash)}`, { method: 'DELETE', pin: true }) }

  setOverride(target: string, mode: OverrideMode): Promise<unknown> {
    return this.json('/api/overrides', { method: 'PUT', body: JSON.stringify({ target, mode }), pin: true })
  }

  clearOverrides(): Promise<unknown> { return this.json('/api/overrides', { method: 'DELETE', pin: true }) }
  clearAlerts(): Promise<unknown> { return this.json('/api/alerts', { method: 'DELETE', pin: true }) }

  unlockMotor(name: string): Promise<{ motor: string, unlocked: boolean, motors: Record<string, PiMotor> }> {
    return this.json(`/api/motors/${encodeURIComponent(name)}/unlock`, { method: 'POST', pin: true })
  }

  /**
   * A manual test order on one port while no show runs. It expires on its own (a minute; half a
   * second for a motor); repeating the same params only extends it on the Pi.
   */
  testSet(target: string, params: PiTestParams): Promise<PiTestStatus> {
    return this.json('/api/test/set', { method: 'POST', body: JSON.stringify({ target, params }), pin: true })
  }

  /** Leaves one port (or every port) safe; the Pi leaves test mode when none is left. */
  testRelease(target?: string): Promise<PiTestStatus> {
    return this.json('/api/test/release', { method: 'POST', body: JSON.stringify(target ? { target } : {}), pin: true })
  }

  /** Turns a motor in a direction for a test; the caller repeats it while the button is held. */
  motor(target: string, direction: MotorDirection): Promise<PiTestStatus> {
    return this.testSet(target, { direction })
  }

  setNetMode(mode: 'ap' | 'auto'): Promise<PiNet> { return this.json('/api/net/mode', { method: 'POST', body: JSON.stringify({ mode }), pin: true }) }
  hotspotNow(): Promise<PiNet> { return this.json('/api/net/hotspot', { method: 'POST', pin: true }) }
  reboot(): Promise<{ ok: boolean, message: string }> { return this.json('/api/system/reboot', { method: 'POST', pin: true }) }

  // ---------------------------------------------------------------- upload

  /**
   * Sends a `.belen.zip` through the resumable `/api/uploads` flow in pieces of `chunkBytes`; a
   * `409 bad_offset` re-syncs with what the Pi has. Resolves with the import report, also when the
   * Pi verified and rejected the bundle (`ok: false`).
   */
  async uploadBundle(blob: Blob, name: string, options: { activate?: boolean, onProgress?: (p: UploadProgress) => void, signal?: AbortSignal } = {}): Promise<ImportReport> {
    const size = blob.size
    const upload = await this.json<PiUpload>('/api/uploads', { method: 'POST', body: JSON.stringify({ name, size }), pin: true, signal: options.signal })
    let offset = upload.received
    options.onProgress?.({ sent: offset, total: size, verifying: false })
    while (offset < size) {
      const end = Math.min(offset + this.chunkBytes, size)
      const res = await this.fetchRaw(`/api/uploads/${encodeURIComponent(upload.uploadId)}`, {
        method: 'PUT',
        pin: true,
        signal: options.signal,
        headers: { 'Content-Range': `bytes ${offset}-${end - 1}/${size}`, 'Content-Type': 'application/octet-stream' },
        body: blob.slice(offset, end)
      })
      const body = await readJson(res)
      if (res.status === 409 && isRecord(body) && body.error === PI_CODES.badOffset && typeof body.received === 'number') {
        offset = body.received
      } else if (!res.ok) {
        throw errorFrom(res.status, body, res.statusText)
      } else {
        offset = isRecord(body) && typeof body.received === 'number' ? body.received : end
      }
      options.onProgress?.({ sent: offset, total: size, verifying: false })
    }
    options.onProgress?.({ sent: size, total: size, verifying: true })
    const res = await this.fetchRaw(`/api/uploads/${encodeURIComponent(upload.uploadId)}/finish?activate=${options.activate ? '1' : '0'}`, { method: 'POST', pin: true, signal: options.signal })
    const body = await readJson(res)
    if ((res.ok || res.status === 422) && isRecord(body) && typeof body.ok === 'boolean') return toReport(body)
    throw errorFrom(res.status, body, res.statusText)
  }

  // ---------------------------------------------------------------- plumbing

  private async fetchRaw(path: string, init: RawInit = {}): Promise<Response> {
    const { pin = false, headers = {}, timeoutMs, signal, ...rest } = init
    const merged: Record<string, string> = { Accept: 'application/json', ...headers }
    if (pin) {
      if (!this.pin) throw new PiApiError(401, PI_CODES.pinRequired, 'PIN required')
      merged.Authorization = `Pin ${this.pin}`
      if (this.name) merged['X-Name'] = this.name
    }
    if (typeof rest.body === 'string' && !merged['Content-Type']) merged['Content-Type'] = 'application/json'
    const space = targetAddressSpaceOf(this.baseUrl)
    const timeout = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
    const combined = signal && timeout ? AbortSignal.any([signal, timeout]) : (signal ?? timeout)
    try {
      // `targetAddressSpace` tells Chrome the request goes to the local network (Local Network Access).
      return await this.fetchFn(`${this.baseUrl}${path}`, { ...rest, headers: merged, signal: combined, ...(space ? { targetAddressSpace: space } : {}) } as RequestInit)
    } catch (err) {
      if (signal?.aborted) throw err
      throw new PiApiError(0, PI_CODES.network, err instanceof Error ? err.message : String(err))
    }
  }

  private async json<T>(path: string, init: RawInit = {}): Promise<T> {
    const res = await this.fetchRaw(path, init)
    const body = await readJson(res)
    if (!res.ok) throw errorFrom(res.status, body, res.statusText)
    return body as T
  }
}
