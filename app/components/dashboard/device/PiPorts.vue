<script setup lang="ts">
import type { PortResponseDto } from '~/types/api'
import type { FixtureProfile, HeadPosition } from '~/types/contract'
import { headPositionsOf } from '~/types/contract'
import type { MotorDirection, PiHardware, PiMotor, PiSensor, PiTestParams } from '~/types/pi'
import { TESTABLE_KINDS } from '~/composables/usePiControl'
import { audioLabel, hexToRgb } from '~/utils/pi/piFormat'

/**
 * The ports of the active show with the Stocka pieces each one drives, their cut (the port ignores
 * the show) and, while no show runs, a hardware test per kind: switch a relay, light a strip or
 * segment in a live colour, turn a motor while its button is held, play a sound, move a head with
 * sliders (pan, tilt, zoom, intensity, white, colour), send it to a saved position and save where it
 * points as a new position of its Stocka port.
 */
const props = defineProps<{
  hardware: PiHardware[]
  motors: Record<string, PiMotor>
  sensors: Record<string, PiSensor>
  busy: boolean
  canControl: boolean
  canTest: boolean
  testBlocked: 'playing' | 'rehearsal' | null
  testTargets: Set<string>
  heldMotor: { name: string, direction: MotorDirection } | null
  audioFiles: string[]
  /** The organization's `moving_head` ports by name (the show's targets carry the same names), for their positions. */
  headPorts: Record<string, PortResponseDto>
  /** Fixture profile of each head port by name, for the slider ranges. */
  headProfiles: Record<string, FixtureProfile>
  /** Whether the user may save positions on the ports (OWNER or MANAGER). */
  canSavePositions: boolean
}>()

const emit = defineEmits<{
  toggle: [hw: PiHardware]
  clear: []
  unlock: [motor: string]
  testOn: [name: string, params: PiTestParams]
  testLive: [name: string, params: PiTestParams]
  testOff: [name: string]
  testOffAll: []
  motorHold: [name: string, direction: MotorDirection]
  motorRelease: []
  savePosition: [port: string, position: HeadPosition]
}>()

const { t, te } = useI18n()

const DEFAULT_COLOR = '#ff8c32'
const DIRECTIONS: MotorDirection[] = ['reverse', 'forward']
const colors = reactive<Record<string, string>>({})
const sounds = reactive<Record<string, string>>({})

// ---- moving heads: slider state, saved positions, "save as position" form ----
type HeadKey = 'pan' | 'tilt' | 'zoom' | 'intensity' | 'white'
const HEAD_KEYS: HeadKey[] = ['pan', 'tilt', 'zoom', 'intensity', 'white']
interface HeadState { pan: number, tilt: number, zoom: number, intensity: number, white: number }
type SaveGroup = 'aim' | 'zoom' | 'intensity' | 'color'
const SAVE_GROUPS: SaveGroup[] = ['aim', 'zoom', 'intensity', 'color']
interface SaveDraft { open: boolean, name: string, include: Record<SaveGroup, boolean> }

const heads = reactive<Record<string, HeadState>>({})
const saveDrafts = reactive<Record<string, SaveDraft>>({})

function profileOf(hw: PiHardware): FixtureProfile | null {
  return props.headProfiles[hw.name] ?? null
}

/** Slider bounds of a head: its profile for pan/tilt/zoom, the `set` action for intensity and white. */
function headBounds(hw: PiHardware): Record<HeadKey, { min: number, max: number, step: number, unit: string }> {
  const p = profileOf(hw)
  return {
    pan: { min: 0, max: p?.pan.max ?? 540, step: 0.5, unit: '°' },
    tilt: { min: 0, max: p?.tilt.max ?? 270, step: 0.5, unit: '°' },
    zoom: { min: p?.zoom.min ?? 0, max: p?.zoom.max ?? 100, step: 0.5, unit: '°' },
    intensity: { min: 0, max: 100, step: 1, unit: '%' },
    white: { min: 0, max: 255, step: 1, unit: '' }
  }
}

/** Where the sliders of a head stand; starts centred, closed and at full intensity (what `identify` lights). */
function headState(hw: PiHardware): HeadState {
  let state = heads[hw.name]
  if (!state) {
    const b = headBounds(hw)
    state = { pan: Math.round(b.pan.max / 2), tilt: Math.round(b.tilt.max / 2), zoom: b.zoom.min, intensity: 100, white: 0 }
    heads[hw.name] = state
  }
  return state
}

function headParams(hw: PiHardware): PiTestParams {
  const s = headState(hw)
  return { pan: s.pan, tilt: s.tilt, zoom: s.zoom, intensity: s.intensity, white: s.white, color: hexToRgb(colorOf(hw)) }
}

/** A slider moved: the head follows live while it is on; otherwise the value waits for «Encén». */
function onHead(hw: PiHardware, key: HeadKey, event: Event) {
  const raw = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(raw)) return
  headState(hw)[key] = raw
  if (testing(hw)) emit('testLive', hw.name, headParams(hw))
}

function savedPositions(hw: PiHardware): HeadPosition[] {
  return headPositionsOf(props.headPorts[hw.name]?.config)
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')
}

/** Sends the head to a saved position: the sliders take its values (the rest stay) and the head moves, switching on if needed. */
function goTo(hw: PiHardware, position: HeadPosition) {
  const state = headState(hw)
  for (const key of HEAD_KEYS) {
    const value = position[key]
    if (typeof value === 'number') state[key] = value
  }
  if (position.color) colors[hw.name] = toHex(position.color)
  if (testing(hw)) emit('testLive', hw.name, headParams(hw))
  else emit('testOn', hw.name, headParams(hw))
}

function saveDraft(hw: PiHardware): SaveDraft {
  let draft = saveDrafts[hw.name]
  if (!draft) {
    draft = { open: false, name: '', include: { aim: true, zoom: true, intensity: true, color: true } }
    saveDrafts[hw.name] = draft
  }
  return draft
}

function openSave(hw: PiHardware) {
  const draft = saveDraft(hw)
  draft.open = !draft.open
}

function canConfirmSave(hw: PiHardware): boolean {
  const draft = saveDraft(hw)
  return draft.name.trim() !== '' && SAVE_GROUPS.some(g => draft.include[g])
}

/** Builds the position from the sliders and the chosen groups and hands it to the page, which saves it on the Stocka port. */
function confirmSave(hw: PiHardware) {
  const draft = saveDraft(hw)
  if (!canConfirmSave(hw)) return
  const s = headState(hw)
  const position: HeadPosition = { name: draft.name.trim() }
  if (draft.include.aim) {
    position.pan = s.pan
    position.tilt = s.tilt
  }
  if (draft.include.zoom) position.zoom = s.zoom
  if (draft.include.intensity) position.intensity = s.intensity
  if (draft.include.color) {
    position.color = hexToRgb(colorOf(hw))
    position.white = s.white
  }
  emit('savePosition', hw.name, position)
  draft.open = false
  draft.name = ''
}

/** Whether saving would replace a position the port already has (same name, case-insensitive). */
function replacesExisting(hw: PiHardware): boolean {
  const name = saveDraft(hw).name.trim().toLowerCase()
  return name !== '' && savedPositions(hw).some(p => p.name.trim().toLowerCase() === name)
}

function formatHeadValue(hw: PiHardware, key: HeadKey): string {
  const value = headState(hw)[key]
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${headBounds(hw)[key].unit}`
}

// The slider state and the save form of every head exist before the template reads them, so
// rendering never writes reactive state.
watch(() => props.hardware, (list) => {
  for (const hw of list) {
    if (hw.kind !== 'moving_head') continue
    headState(hw)
    saveDraft(hw)
  }
}, { immediate: true })

const cut = computed(() => props.hardware.filter(h => h.off).length)

function motorOf(hw: PiHardware): PiMotor | undefined {
  return hw.kind === 'motor' ? props.motors[hw.name] : undefined
}

/** A panic sensor ignores overrides: cutting it is refused (restoring stays possible). */
function cuttable(hw: PiHardware): boolean {
  return hw.kind !== 'sensor' || props.sensors[hw.name]?.onActive !== 'panic'
}

function testing(hw: PiHardware): boolean {
  return props.testTargets.has(hw.name)
}

function showsTest(hw: PiHardware): boolean {
  return props.canTest && TESTABLE_KINDS.includes(hw.kind) && !hw.off
}

function colorOf(hw: PiHardware): string {
  return colors[hw.name] ?? DEFAULT_COLOR
}

function colorParams(hw: PiHardware): PiTestParams {
  return hw.kind === 'moving_head' ? headParams(hw) : { color: hexToRgb(colorOf(hw)) }
}

function selectedSound(hw: PiHardware): string {
  const chosen = sounds[hw.name]
  return chosen && props.audioFiles.includes(chosen) ? chosen : (props.audioFiles[0] ?? '')
}

function onColor(hw: PiHardware, event: Event) {
  colors[hw.name] = (event.target as HTMLInputElement).value
  if (testing(hw)) emit('testLive', hw.name, colorParams(hw))
}

function switchOn(hw: PiHardware) {
  if (hw.kind === 'relay') emit('testOn', hw.name, { on: true })
  else if (hw.kind === 'audio') emit('testOn', hw.name, { audio_name: selectedSound(hw) })
  else emit('testOn', hw.name, colorParams(hw))
}

function toggleTest(hw: PiHardware) {
  if (testing(hw)) emit('testOff', hw.name)
  else switchOn(hw)
}

function holding(hw: PiHardware, direction: MotorDirection): boolean {
  return props.heldMotor?.name === hw.name && props.heldMotor.direction === direction
}

function hold(hw: PiHardware, direction: MotorDirection, event: PointerEvent) {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  emit('motorHold', hw.name, direction)
}

/** Keyboard: Space or Enter turn the motor while they are held down. */
function holdKey(hw: PiHardware, direction: MotorDirection, event: KeyboardEvent) {
  if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return
  event.preventDefault()
  emit('motorHold', hw.name, direction)
}

function release() {
  if (props.heldMotor) emit('motorRelease')
}

function motorState(motor: PiMotor): string {
  if (motor.direction) {
    const label = t(`dashboard.device.pi.motor.${motor.direction}`)
    return motor.runningS > 0 ? `${label} · ${motor.runningS.toFixed(1)} s` : label
  }
  return t('dashboard.device.pi.motor.stopped')
}

function motorLastEnd(motor: PiMotor): string | null {
  if (!motor.lastEnd) return null
  const key = `dashboard.device.pi.motor.end_${motor.lastEnd}`
  return t('dashboard.device.pi.motor.last_end', { reason: te(key) ? t(key) : motor.lastEnd })
}

// Whatever happens to the pointer or the window, a held motor stops.
onMounted(() => {
  window.addEventListener('pointerup', release)
  window.addEventListener('blur', release)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerup', release)
  window.removeEventListener('blur', release)
  release()
})
</script>

<template>
  <section class="dp-card">
    <div class="dp-card-head">
      <span class="dp-label">{{ t('dashboard.device.pi.ports.title') }}</span>
      <span class="flex flex-wrap gap-1.5">
        <span v-if="testTargets.size" class="badge badge-highlight">{{ t('dashboard.device.pi.test.active', { n: testTargets.size }) }}</span>
        <span v-if="cut" class="badge badge-danger">{{ t('dashboard.device.pi.ports.cut_count', { n: cut }) }}</span>
      </span>
    </div>
    <p class="dp-hint mb-2">
      <template v-if="canTest">{{ t('dashboard.device.pi.test.hint') }}</template>
      <template v-else-if="canControl && testBlocked === 'rehearsal'">{{ t('dashboard.device.pi.test.blocked_rehearsal') }}</template>
      <template v-else-if="canControl && testBlocked === 'playing'">{{ t('dashboard.device.pi.test.blocked_playing') }}</template>
      {{ t('dashboard.device.pi.ports.hint') }}
    </p>

    <ul v-if="hardware.length" class="dp-list">
      <li v-for="hw in hardware" :key="hw.name" class="port" :class="{ 'is-off': hw.off, 'is-testing': testing(hw) }">
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="port-name truncate">{{ hw.name }}</span>
            <span v-if="hw.pieces?.length" class="port-pieces">{{ hw.pieces.join(' · ') }}</span>
            <span class="flex flex-wrap items-center gap-1.5 dp-hint">
              <code class="mono">{{ hw.kind }}</code>
              <span v-if="hw.off" class="badge badge-danger">{{ t('dashboard.device.pi.ports.cut_badge') }}</span>
            </span>
            <span v-if="motorOf(hw)" class="flex flex-wrap items-center gap-1.5 dp-hint">
              <span :class="motorOf(hw)!.direction ? 'text-ok' : ''">{{ motorState(motorOf(hw)!) }}</span>
              <span v-if="motorOf(hw)!.locked" class="badge badge-danger">{{ t('dashboard.device.pi.motor.locked') }}</span>
              <span v-if="motorLastEnd(motorOf(hw)!)">· {{ motorLastEnd(motorOf(hw)!) }}</span>
            </span>
            <span v-if="!cuttable(hw)" class="dp-hint">{{ t('dashboard.device.pi.ports.sensor_no_cut') }}</span>
          </div>
          <div v-if="canControl" class="flex flex-shrink-0 items-center gap-1.5">
            <button v-if="motorOf(hw)?.locked" type="button" class="dp-btn dp-btn-primary" :disabled="busy" @click="emit('unlock', hw.name)">
              {{ t('dashboard.device.pi.alerts.unlock') }}
            </button>
            <button
              type="button"
              class="dp-btn"
              :class="hw.off ? 'dp-btn-primary' : 'dp-btn-quiet cut-btn'"
              :disabled="busy || (!hw.off && !cuttable(hw))"
              :aria-pressed="hw.off"
              @click="emit('toggle', hw)"
            >
              {{ hw.off ? t('dashboard.device.pi.ports.restore') : t('dashboard.device.pi.ports.cut') }}
            </button>
          </div>
        </div>

        <div v-if="showsTest(hw)" class="port-test">
          <template v-if="hw.kind === 'motor'">
            <button
              v-for="direction in DIRECTIONS"
              :key="direction"
              type="button"
              class="dp-btn hold-btn"
              :class="{ 'is-held': holding(hw, direction) }"
              :aria-pressed="holding(hw, direction)"
              :disabled="motorOf(hw)?.locked"
              @pointerdown="hold(hw, direction, $event)"
              @pointerup="release"
              @pointercancel="release"
              @lostpointercapture="release"
              @keydown="holdKey(hw, direction, $event)"
              @keyup="release"
              @contextmenu.prevent
            >
              {{ direction === 'reverse' ? `◀ ${t('dashboard.device.pi.test.reverse')}` : `${t('dashboard.device.pi.test.forward')} ▶` }}
            </button>
            <span class="dp-hint w-full">{{ t('dashboard.device.pi.test.hold') }}</span>
          </template>

          <template v-else-if="hw.kind === 'audio'">
            <select
              v-if="audioFiles.length"
              class="dp-field flex-1"
              :aria-label="t('dashboard.device.pi.test.sound', { name: hw.name })"
              :value="selectedSound(hw)"
              :disabled="testing(hw)"
              @change="sounds[hw.name] = ($event.target as HTMLSelectElement).value"
            >
              <option v-for="file in audioFiles" :key="file" :value="file">{{ audioLabel(file) }}</option>
            </select>
            <span v-else class="dp-hint flex-1">{{ t('dashboard.device.pi.test.no_sounds') }}</span>
            <button
              type="button"
              class="dp-btn"
              :class="testing(hw) ? '' : 'dp-btn-primary'"
              :disabled="busy || !audioFiles.length"
              :aria-pressed="testing(hw)"
              @click="toggleTest(hw)"
            >
              {{ testing(hw) ? `■ ${t('dashboard.device.pi.test.stop')}` : `▶ ${t('dashboard.device.pi.test.play')}` }}
            </button>
          </template>

          <template v-else>
            <input
              v-if="hw.kind !== 'relay'"
              type="color"
              class="dp-swatch"
              :value="colorOf(hw)"
              :aria-label="t('dashboard.device.pi.test.color', { name: hw.name })"
              @input="onColor(hw, $event)"
            >
            <button
              type="button"
              class="dp-btn toggle-btn"
              :class="{ 'is-on': testing(hw) }"
              :disabled="busy"
              :aria-pressed="testing(hw)"
              @click="toggleTest(hw)"
            >
              <span class="toggle-dot" aria-hidden="true" />
              {{ testing(hw) ? t('dashboard.device.pi.test.off') : t('dashboard.device.pi.test.on') }}
            </button>

            <template v-if="hw.kind === 'moving_head'">
              <div class="head-sliders">
                <label v-for="key in HEAD_KEYS" :key="key" class="head-slider">
                  <span class="flex items-baseline justify-between gap-2">
                    <span class="dp-hint">{{ t(`dashboard.device.pi.test.head.${key}`) }}</span>
                    <span class="mono head-value">{{ formatHeadValue(hw, key) }}</span>
                  </span>
                  <input
                    type="range"
                    class="dp-range"
                    :min="headBounds(hw)[key].min"
                    :max="headBounds(hw)[key].max"
                    :step="headBounds(hw)[key].step"
                    :value="headState(hw)[key]"
                    :aria-label="`${t(`dashboard.device.pi.test.head.${key}`)} · ${hw.name}`"
                    @input="onHead(hw, key, $event)"
                  >
                </label>
              </div>

              <div class="flex w-full flex-wrap items-center gap-1.5">
                <span class="dp-hint">{{ t('dashboard.device.pi.test.head.positions') }}</span>
                <template v-if="savedPositions(hw).length">
                  <button
                    v-for="position in savedPositions(hw)"
                    :key="position.name"
                    type="button"
                    class="dp-btn head-position"
                    :disabled="busy"
                    :title="t('dashboard.device.pi.test.head.goto_title', { name: position.name })"
                    @click="goTo(hw, position)"
                  >
                    ◎ {{ position.name }}
                  </button>
                </template>
                <span v-else class="dp-hint">{{ headPorts[hw.name] ? t('dashboard.device.pi.test.head.positions_none') : t('dashboard.device.pi.test.head.no_port') }}</span>
                <button
                  v-if="canSavePositions && headPorts[hw.name]"
                  type="button"
                  class="dp-btn ml-auto"
                  :class="{ 'dp-btn-primary': !saveDraft(hw).open }"
                  :disabled="busy"
                  :aria-expanded="saveDraft(hw).open"
                  @click="openSave(hw)"
                >
                  {{ saveDraft(hw).open ? t('dashboard.device.pi.test.head.cancel') : t('dashboard.device.pi.test.head.save') }}
                </button>
              </div>

              <form v-if="canSavePositions && headPorts[hw.name] && saveDraft(hw).open" class="head-save" @submit.prevent="confirmSave(hw)">
                <p class="dp-hint">{{ t('dashboard.device.pi.test.head.save_help') }}</p>
                <div class="flex flex-wrap items-center gap-2">
                  <input
                    v-model="saveDraft(hw).name"
                    type="text"
                    class="dp-field flex-1"
                    :list="`head-positions-${hw.name}`"
                    :placeholder="t('dashboard.device.pi.test.head.name_placeholder')"
                    :aria-label="t('dashboard.device.pi.test.head.name')"
                    maxlength="80"
                  >
                  <datalist :id="`head-positions-${hw.name}`">
                    <option v-for="position in savedPositions(hw)" :key="position.name" :value="position.name" />
                  </datalist>
                  <button type="submit" class="dp-btn dp-btn-primary" :disabled="busy || !canConfirmSave(hw)">
                    {{ replacesExisting(hw) ? t('dashboard.device.pi.test.head.replace') : t('dashboard.device.pi.test.head.confirm') }}
                  </button>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1">
                  <label v-for="group in SAVE_GROUPS" :key="group" class="flex items-center gap-1.5 text-[12.5px] text-ink">
                    <input v-model="saveDraft(hw).include[group]" type="checkbox" class="h-4 w-4 accent-[var(--c-accent)]">
                    {{ t(`dashboard.device.pi.test.head.include_${group}`) }}
                  </label>
                </div>
              </form>
            </template>
          </template>
        </div>
        <p v-else-if="canTest && TESTABLE_KINDS.includes(hw.kind) && hw.off" class="dp-hint mt-1">{{ t('dashboard.device.pi.ports.cut_first') }}</p>
      </li>
    </ul>
    <p v-else class="dp-hint">{{ t('dashboard.device.pi.ports.none') }}</p>

    <div v-if="canControl && (testTargets.size || cut)" class="mt-2 flex flex-wrap gap-2">
      <button v-if="testTargets.size" type="button" class="dp-btn" :disabled="busy" @click="emit('testOffAll')">{{ t('dashboard.device.pi.test.off_all') }}</button>
      <button v-if="cut" type="button" class="dp-btn" :disabled="busy" @click="emit('clear')">{{ t('dashboard.device.pi.ports.restore_all') }}</button>
    </div>
  </section>
</template>

<style scoped>
.port { padding-left: 8px; padding-right: 8px; margin: 0 -8px; border-radius: 6px; }
.head-sliders { display: grid; width: 100%; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px 14px; }
.head-slider { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.head-value { font-size: 12px; color: var(--c-ink); }
.dp-range { width: 100%; height: 22px; margin: 0; accent-color: var(--c-accent); cursor: pointer; }
.head-position { font-weight: 500; }
.head-save {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 8px;
  border-radius: 6px;
  border: 1px dashed var(--c-line-strong);
  padding: 8px 10px;
}
.port.is-off { background: var(--c-danger-soft); }
.port.is-testing { background: var(--c-warn-soft); }
.port-name { font-size: 14px; font-weight: 600; color: var(--c-ink); }
.is-off .port-name { color: var(--c-danger); }
.port-pieces { font-size: 12.5px; line-height: 16px; color: var(--c-ink-soft); overflow-wrap: anywhere; }
.dp-btn.cut-btn { color: var(--c-danger); }
.dp-btn.cut-btn:hover:not(:disabled) { background: var(--c-danger-soft); }
.port-test { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
.dp-swatch {
  width: 44px;
  height: 30px;
  flex: none;
  padding: 2px;
  border-radius: 6px;
  border: 1px solid var(--c-line-control, var(--c-line-strong));
  background: var(--c-bg-card);
  cursor: pointer;
}
.toggle-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c-line-strong); }
.toggle-btn.is-on { border-color: var(--c-ok); background: var(--c-ok-soft); color: var(--c-ok); }
.toggle-btn.is-on .toggle-dot { background: var(--c-ok); box-shadow: 0 0 0 3px var(--c-ok-soft); }
.hold-btn { flex: 1; min-width: 0; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.hold-btn.is-held { border-color: var(--c-accent); background: var(--c-accent); color: var(--c-bg-card); }
</style>
