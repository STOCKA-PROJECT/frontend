import type { MaybeRefOrGetter } from 'vue'
import type { DeviceResponseDto } from '~/types/api'
import type {
  ImportReport,
  MotorDirection,
  PiBundles,
  PiHardware,
  PiInfo,
  PiNet,
  PiStatus,
  PiTestParams,
  PiTestStatus
} from '~/types/pi'
import { PiApiError, PiClient, type UploadProgress } from '~/utils/pi/piClient'

/** Kinds of port the player can test by hand (`TEST_KINDS` of its core). */
export const TESTABLE_KINDS: readonly string[] = ['relay', 'led_strip', 'led_segment', 'motor', 'audio', 'moving_head']

/** How often the page asks the Pi for its state while it is visible. */
const STATUS_POLL_MS = 2000
/** The Pi drops a test order after a minute: the page renews the ones still on well before. */
const TEST_RENEW_MS = 20_000
/** The Pi stops a motor half a second after its last order: the page repeats it while the button is held. */
const MOTOR_REFRESH_MS = 250
/** At most one live colour per port in this time while dragging the colour picker. */
const TEST_LIVE_MS = 150
/** A just-sent order may not be in the status yet: only after this long does its absence mean the Pi dropped it. */
const TEST_GRACE_MS = 3000
/** Failed polls in a row before the page shows the Pi as unreachable. */
const MAX_POLL_FAILURES = 3

export type PiConnection = 'idle' | 'connecting' | 'connected' | 'unreachable'

/** An upload of a timeline's bundle to the Pi, from the download to the import report. */
export interface PiUploadState {
  timelineName: string
  phase: 'downloading' | 'uploading' | 'verifying' | 'done' | 'error'
  sent: number
  total: number
  report: ImportReport | null
  error: string | null
}

interface TestOrder {
  params: PiTestParams
  sentAt: number
}

/**
 * Controls one registered player from the browser, on the local network: the same options as the
 * belén app (state, play/stop/panic, ports with their pieces, cuts and hardware tests, shows,
 * network, reboot). The address and the PIN come from Stocka (`device.localUrl`, `device.pin`);
 * without a PIN (a SPECTATOR, or none saved) only the reads work.
 *
 * Polls `/api/status` every {@link STATUS_POLL_MS} while the tab is visible (Server-Sent Events do
 * not cross from an HTTPS page to the Pi) and stops when the component unmounts. Test orders the
 * user switched on stay on until switched off: they are renewed before the Pi lets them expire and
 * forgotten as soon as the Pi no longer lists them (panic, play, cut). A held motor turns while its
 * button is held and stops when it is let go, the tab is hidden or the page is left.
 *
 * Must be called in a component's setup.
 *
 * @param device the device the page shows; may be reactive and `null` while it loads
 */
export function usePiControl(device: MaybeRefOrGetter<DeviceResponseDto | null>) {
  const { t } = useI18n()
  const toast = useToastStore()
  const auth = useAuthStore()

  const connection = ref<PiConnection>('idle')
  const info = shallowRef<PiInfo | null>(null)
  const status = shallowRef<PiStatus | null>(null)
  const bundles = shallowRef<PiBundles | null>(null)
  const net = shallowRef<PiNet | null>(null)
  const audioFiles = ref<string[]>([])
  const logs = ref<string[]>([])
  const busy = ref(false)
  const upload = ref<PiUploadState | null>(null)

  const testOrders = reactive<Record<string, TestOrder>>({})
  const heldMotor = ref<{ name: string, direction: MotorDirection } | null>(null)
  let renewTimer: ReturnType<typeof setInterval> | null = null
  let motorTimer: ReturnType<typeof setInterval> | null = null
  let liveTimer: ReturnType<typeof setTimeout> | null = null
  const livePending = new Map<string, PiTestParams>()
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let pollFailures = 0
  let uploadAbort: AbortController | null = null
  let disposed = false

  const target = computed(() => toValue(device))
  /**
   * Where the page connects: the device's saved address, but only plain HTTP on port 8080, the
   * only origin the site's CSP lets the browser reach (`PiConnection` explains why otherwise).
   */
  const baseUrl = computed(() => {
    const url = target.value?.localUrl
    if (!url) return null
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' && parsed.port === '8080' ? url : null
    } catch {
      return null
    }
  })
  const pin = computed(() => target.value?.pin ?? null)
  /** Commands need the PIN, which Stocka only reveals to who may control devices. */
  const canControl = computed(() => !!pin.value)
  const client = computed(() => {
    if (!baseUrl.value) return null
    const user = auth.user
    const actor = user ? [user.name, user.lastName].filter(Boolean).join(' ') || user.username : null
    return new PiClient(baseUrl.value, { pin: pin.value, name: actor })
  })

  const connected = computed(() => connection.value === 'connected')
  /** Ports of the live status in alphabetical order. */
  const hardware = computed<PiHardware[]>(() => [...(status.value?.hardware ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })))
  const playing = computed(() => status.value?.state === 'PLAYING')
  /** Ports can be tested while a show is loaded and nothing plays: no show, no rehearsal. */
  const canTest = computed(() => {
    const s = status.value
    return connected.value && canControl.value && !!s?.showHash && !s.rehearsal
      && (s.state === 'IDLE' || s.state === 'SAFE' || s.state === 'TEST')
  })
  /** Ports with a test order in force, as the Pi reports them or as this page just sent them. */
  const testTargets = computed(() => new Set([...Object.keys(status.value?.test?.targets ?? {}), ...Object.keys(testOrders)]))

  // ---------------------------------------------------------------- errors

  function messageOf(err: unknown): string {
    if (err instanceof PiApiError) {
      if (err.unreachable) return t('dashboard.device.pi.errors.unreachable')
      if (err.code === 'pin_required') return t('dashboard.device.pi.errors.pin_required')
      if (err.code === 'pin_invalid') return t('dashboard.device.pi.errors.pin_invalid')
      if (err.code === 'pin_locked') return t('dashboard.device.pi.errors.pin_locked')
      return err.message
    }
    return err instanceof Error ? err.message : String(err)
  }

  /** Runs a command; any failure becomes an error toast. Resolves `true` when it worked. */
  async function guarded(action: () => Promise<unknown>, options: { busy?: boolean, quiet?: boolean } = {}): Promise<boolean> {
    const markBusy = options.busy !== false
    if (markBusy) busy.value = true
    try {
      await action()
      return true
    } catch (err) {
      if (!options.quiet) toast.push({ type: 'error', title: t('dashboard.device.pi.errors.title'), description: messageOf(err) })
      return false
    } finally {
      if (markBusy) busy.value = false
    }
  }

  function requireClient(): PiClient {
    if (!client.value) throw new PiApiError(0, 'network', t('dashboard.device.pi.errors.no_address'))
    return client.value
  }

  // ---------------------------------------------------------------- connection

  /** Reads everything once and starts polling the state. */
  async function connect(): Promise<boolean> {
    const c = client.value
    if (!c) return false
    stopPolling()
    connection.value = 'connecting'
    try {
      info.value = await c.info()
      const [s, b, n] = await Promise.all([c.status(), c.bundles(), c.net().catch(() => null), refreshAudioFiles()])
      status.value = s
      bundles.value = b
      net.value = n
      connection.value = 'connected'
      pollFailures = 0
      adoptTests(s.test)
      if (s.clock && !s.clock.reliable) await c.syncClock().catch(() => {})
      schedulePoll()
      return true
    } catch {
      connection.value = 'unreachable'
      return false
    }
  }

  function disconnect() {
    stopPolling()
    forgetTests()
    connection.value = 'idle'
  }

  function schedulePoll() {
    if (disposed) return
    pollTimer = setTimeout(() => void poll(), STATUS_POLL_MS)
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  async function poll() {
    const c = client.value
    if (!c || disposed) return
    if (document.visibilityState === 'visible') {
      try {
        status.value = await c.status()
        pollFailures = 0
        if (connection.value !== 'connected') connection.value = 'connected'
      } catch {
        pollFailures++
        if (pollFailures >= MAX_POLL_FAILURES) connection.value = 'unreachable'
      }
    }
    schedulePoll()
  }

  async function refreshStatus() {
    status.value = await requireClient().status()
  }

  async function refreshBundles() {
    bundles.value = await requireClient().bundles()
  }

  async function refreshAudioFiles() {
    try {
      audioFiles.value = await requireClient().audioFiles()
    } catch {
      audioFiles.value = []
    }
  }

  async function refreshLogs(lines = 300) {
    await guarded(async () => { logs.value = await requireClient().logs(lines) }, { busy: false })
  }

  // ---------------------------------------------------------------- commands

  const play = () => guarded(async () => {
    const c = requireClient()
    // The Pi refuses to play in test mode: switch every test off first.
    if (status.value?.state === 'TEST') {
      forgetTests()
      await c.testRelease()
    }
    status.value = await c.play()
  })
  const stop = () => guarded(async () => { status.value = await requireClient().stop() })
  const panic = () => guarded(async () => { status.value = await requireClient().panic() })
  const endRehearsal = () => guarded(async () => { status.value = await requireClient().endRehearsal() })
  const activate = (hash: string) => guarded(async () => {
    status.value = await requireClient().activate(hash)
    await refreshBundles()
  })
  const rollback = () => guarded(async () => {
    status.value = await requireClient().rollback()
    await refreshBundles()
  })
  const deleteBundle = (hash: string) => guarded(async () => {
    await requireClient().deleteBundle(hash)
    await refreshBundles()
  })
  const toggleOverride = (hw: PiHardware) => guarded(async () => {
    if (!hw.off) forgetTest(hw.name) // cutting a port ends its test on the Pi
    await requireClient().setOverride(hw.name, hw.off ? 'normal' : 'off')
    await refreshStatus()
  })
  const clearOverrides = () => guarded(async () => {
    await requireClient().clearOverrides()
    await refreshStatus()
  })
  const clearAlerts = () => guarded(async () => {
    await requireClient().clearAlerts()
    await refreshStatus()
  })
  const unlockMotor = (name: string) => guarded(async () => {
    const result = await requireClient().unlockMotor(name)
    if (status.value) status.value = { ...status.value, motors: result.motors }
    toast.push({
      type: 'success',
      description: result.unlocked ? t('dashboard.device.pi.toasts.motor_unlocked', { name }) : t('dashboard.device.pi.toasts.motor_not_locked', { name })
    })
  })
  const setNetMode = (mode: 'ap' | 'auto') => guarded(async () => { net.value = await requireClient().setNetMode(mode) })
  const hotspotNow = () => guarded(async () => { net.value = await requireClient().hotspotNow() })
  const reboot = () => guarded(async () => {
    const result = await requireClient().reboot()
    toast.push({ type: result.ok ? 'success' : 'error', description: result.message })
  })

  // ---------------------------------------------------------------- hardware test

  /** Puts the test state the Pi answered into the live status at once, without waiting for the next poll. */
  function applyTest(test: PiTestStatus) {
    const s = status.value
    if (!s) return
    const state = test.active ? 'TEST' : s.state === 'TEST' ? 'IDLE' : s.state
    status.value = { ...s, test, state }
  }

  /**
   * Tests already on when the page connects (switched on before a reload, or from another screen)
   * stay on: the page renews them too. A motor is never adopted: it only turns while a button is held.
   */
  function adoptTests(test: PiTestStatus | undefined) {
    const now = Date.now()
    for (const [name, order] of Object.entries(test?.targets ?? {})) {
      if (order.kind === 'motor' || 'direction' in order.params) continue
      testOrders[name] = { params: order.params, sentAt: now }
    }
    if (Object.keys(testOrders).length > 0) renewTimer ??= setInterval(() => void renewTests(), TEST_RENEW_MS)
  }

  function forgetTest(name: string) {
    Reflect.deleteProperty(testOrders, name)
    livePending.delete(name)
    if (heldMotor.value?.name === name) stopMotorTimer()
    if (Object.keys(testOrders).length === 0) stopRenewal()
  }

  function forgetTests() {
    for (const name of Object.keys(testOrders)) Reflect.deleteProperty(testOrders, name)
    livePending.clear()
    if (liveTimer) clearTimeout(liveTimer)
    liveTimer = null
    stopMotorTimer()
    stopRenewal()
  }

  /** Switches a port on for a test (relay `{on}`, LEDs or head `{color}`, audio `{audio_name}`) until {@link testOff}. */
  function testOn(name: string, params: PiTestParams, options: { busy?: boolean } = {}) {
    return guarded(async () => {
      const test = await requireClient().testSet(name, params)
      testOrders[name] = { params, sentAt: Date.now() }
      applyTest(test)
      renewTimer ??= setInterval(() => void renewTests(), TEST_RENEW_MS)
    }, options)
  }

  function testOff(name: string) {
    forgetTest(name)
    return guarded(async () => applyTest(await requireClient().testRelease(name)))
  }

  function testOffAll() {
    forgetTests()
    return guarded(async () => applyTest(await requireClient().testRelease()))
  }

  /** A live change (dragging a colour): the latest params of each port at most every {@link TEST_LIVE_MS}. */
  function testLive(name: string, params: PiTestParams) {
    livePending.set(name, params)
    if (!liveTimer) flushLive()
  }

  function flushLive() {
    const batch = [...livePending]
    livePending.clear()
    if (batch.length === 0) {
      liveTimer = null
      return
    }
    for (const [name, params] of batch) void testOn(name, params, { busy: false })
    liveTimer = setTimeout(flushLive, TEST_LIVE_MS)
  }

  function stopRenewal() {
    if (renewTimer) clearInterval(renewTimer)
    renewTimer = null
  }

  async function renewTests() {
    dropTestsThePiForgot()
    for (const [name, order] of Object.entries(testOrders)) {
      try {
        applyTest(await requireClient().testSet(name, order.params))
      } catch {
        forgetTest(name)
      }
    }
    if (Object.keys(testOrders).length === 0) stopRenewal()
  }

  function dropTestsThePiForgot() {
    const onPi = status.value?.test?.targets ?? {}
    const now = Date.now()
    for (const [name, order] of Object.entries(testOrders)) {
      if (!(name in onPi) && now - order.sentAt > TEST_GRACE_MS) forgetTest(name)
    }
  }

  /** Turns a motor while its button is held; one hold is one run, still cut by its limit switch and `maxTime`. */
  function motorHold(name: string, direction: MotorDirection) {
    if (heldMotor.value) motorRelease()
    heldMotor.value = { name, direction }
    const send = async () => {
      const ok = await guarded(async () => applyTest(await requireClient().motor(name, direction)), { busy: false })
      if (!ok && heldMotor.value?.name === name) stopMotorTimer()
    }
    void send()
    motorTimer = setInterval(() => void send(), MOTOR_REFRESH_MS)
  }

  /** The motor button was let go: stop at once instead of waiting for the order to expire. */
  function motorRelease() {
    const held = heldMotor.value
    if (!held) return
    stopMotorTimer()
    void guarded(async () => applyTest(await requireClient().testRelease(held.name)), { busy: false, quiet: true })
  }

  function stopMotorTimer() {
    if (motorTimer) clearInterval(motorTimer)
    motorTimer = null
    heldMotor.value = null
  }

  watch(status, (s) => {
    if (!s || Object.keys(testOrders).length === 0) return
    if (s.state === 'PLAYING' || s.rehearsal) forgetTests()
    else dropTestsThePiForgot()
  })

  // ---------------------------------------------------------------- send a show

  /**
   * Sends a timeline to the Pi: Stocka builds its `.belen.zip` (`downloadBundle`) and the page
   * uploads it in pieces. The import report stays in {@link upload} until dismissed.
   *
   * @param timelineName shown while it goes
   * @param download     fetches the bundle from Stocka
   * @param activate     make it the active show once imported
   */
  async function sendShow(timelineName: string, download: () => Promise<Blob>, activate: boolean) {
    const state = reactive<PiUploadState>({ timelineName, phase: 'downloading', sent: 0, total: 0, report: null, error: null })
    upload.value = state
    uploadAbort = new AbortController()
    const signal = uploadAbort.signal
    try {
      const blob = await download()
      state.total = blob.size
      state.phase = 'uploading'
      const fileName = `${timelineName.replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 60) || 'show'}.belen.zip`
      state.report = await requireClient().uploadBundle(blob, fileName, {
        activate,
        signal,
        onProgress: (p: UploadProgress) => {
          state.sent = p.sent
          state.total = p.total
          if (p.verifying) state.phase = 'verifying'
        }
      })
      state.phase = 'done'
      await Promise.all([refreshBundles(), refreshStatus(), refreshAudioFiles()]).catch(() => {})
    } catch (err) {
      state.phase = 'error'
      state.error = signal.aborted ? t('dashboard.device.pi.send.cancelled') : messageOf(err)
    } finally {
      uploadAbort = null
    }
  }

  function cancelUpload() {
    uploadAbort?.abort()
  }

  function dismissUpload() {
    if (upload.value && upload.value.phase !== 'uploading' && upload.value.phase !== 'verifying' && upload.value.phase !== 'downloading') upload.value = null
  }

  // ---------------------------------------------------------------- lifecycle

  watch(baseUrl, (url, previous) => {
    if (url === previous) return
    disconnect()
    if (url) void connect()
  })

  const onHidden = () => {
    if (document.visibilityState === 'hidden') motorRelease()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onHidden)
    if (baseUrl.value) void connect()
  })

  onBeforeUnmount(() => {
    disposed = true
    document.removeEventListener('visibilitychange', onHidden)
    motorRelease()
    disconnect()
    cancelUpload()
  })

  return {
    connection,
    connected,
    canControl,
    baseUrl,
    info,
    status,
    bundles,
    net,
    audioFiles,
    logs,
    busy,
    upload,
    hardware,
    playing,
    canTest,
    testTargets,
    heldMotor,
    connect,
    refreshLogs,
    play,
    stop,
    panic,
    endRehearsal,
    activate,
    rollback,
    deleteBundle,
    toggleOverride,
    clearOverrides,
    clearAlerts,
    unlockMotor,
    setNetMode,
    hotspotNow,
    reboot,
    testOn,
    testOff,
    testOffAll,
    testLive,
    motorHold,
    motorRelease,
    sendShow,
    cancelUpload,
    dismissUpload
  }
}
