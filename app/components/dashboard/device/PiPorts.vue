<script setup lang="ts">
import type { MotorDirection, PiHardware, PiMotor, PiSensor, PiTestParams } from '~/types/pi'
import { TESTABLE_KINDS } from '~/composables/usePiControl'
import { audioLabel, hexToRgb } from '~/utils/pi/piFormat'

/**
 * The ports of the active show with the Stocka pieces each one drives, their cut (the port ignores
 * the show) and, while no show runs, a hardware test per kind: switch a relay, light a strip,
 * segment or head in a live colour, turn a motor while its button is held, play a sound.
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
}>()

const { t, te } = useI18n()

const DEFAULT_COLOR = '#ff8c32'
const DIRECTIONS: MotorDirection[] = ['reverse', 'forward']
const colors = reactive<Record<string, string>>({})
const sounds = reactive<Record<string, string>>({})

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
  const color = hexToRgb(colorOf(hw))
  return hw.kind === 'moving_head' ? { color, intensity: 100 } : { color }
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
