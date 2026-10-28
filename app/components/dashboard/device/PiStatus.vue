<script setup lang="ts">
import type { PiInfo, PiScheduleDay, PiStatus } from '~/types/pi'
import { formatBytes, formatMs, formatUptime, percent } from '~/utils/pi/piFormat'

/**
 * What the player is doing now (state, show, mode, cycle, schedule of the button, its clock, a
 * rehearsal from the editor, the last error) and the main commands: play, stop and everything safe.
 */
const props = defineProps<{
  status: PiStatus
  info: PiInfo | null
  canControl: boolean
  busy: boolean
}>()

const emit = defineEmits<{ play: [], stop: [], panic: [], endRehearsal: [] }>()

const { t, te } = useI18n()

const STATE_TONES: Record<string, string> = { PLAYING: 'badge-ok', IDLE: 'badge-brand', SAFE: 'badge-warn', ERROR: 'badge-danger', TEST: 'badge-highlight' }
const DAYS: PiScheduleDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const confirmPanic = ref(false)

const playing = computed(() => props.status.state === 'PLAYING')
const stateLabel = computed(() => {
  const key = `dashboard.devices.state.${props.status.state}`
  return te(key) ? t(key) : props.status.state
})
const modeLabel = computed(() => {
  const mode = props.status.mode
  if (!mode) return '—'
  const key = `dashboard.device.pi.status.mode_${mode.on}`
  const label = te(key) ? t(key) : mode.on
  return mode.on === 'pulse' ? `${label} × ${mode.cycles}` : label
})
const cycleText = computed(() => {
  const s = props.status
  if (!playing.value) return '—'
  return `${s.cycle}${s.cyclesTarget ? ` / ${s.cyclesTarget}` : ''} · ${formatMs(s.cycleMs)} / ${formatMs(s.durationMs ?? 0)}`
})
const cyclePercent = computed(() => (playing.value ? percent(props.status.cycleMs, props.status.durationMs) : 0))

/** `dl 18:30` from a local time of the Pi (ISO without offset). */
function piTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = t(`dashboard.device.pi.days.${DAYS[(d.getDay() + 6) % 7]}`)
  return `${day} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const scheduleText = computed(() => {
  const schedule = props.status.schedule
  if (!schedule) return null
  const windows = schedule.windows
    .map(w => `${DAYS.filter(d => w.days.includes(d)).map(d => t(`dashboard.device.pi.days.${d}`)).join(', ')} ${w.from}–${w.to}`)
    .join('; ')
  const rule = t(schedule.rule === 'allow' ? 'dashboard.device.pi.status.schedule_allow' : 'dashboard.device.pi.status.schedule_block')
  if (!schedule.applies) return { windows: `${rule} ${windows}`, now: t('dashboard.device.pi.status.schedule_ignored') }
  const now = t(schedule.open ? 'dashboard.device.pi.status.schedule_open' : 'dashboard.device.pi.status.schedule_closed')
  return {
    windows: `${rule} ${windows}`,
    now: schedule.nextChange ? t('dashboard.device.pi.status.schedule_until', { now, when: piTime(schedule.nextChange) }) : now
  }
})

const clockText = computed(() => {
  const clock = props.status.clock
  if (!clock) return null
  if (!clock.reliable) return t('dashboard.device.pi.status.clock_unreliable')
  return `${piTime(clock.now)} (${t(clock.source === 'ntp' ? 'dashboard.device.pi.status.clock_ntp' : 'dashboard.device.pi.status.clock_client')})`
})

const rehearsalText = computed(() => {
  const r = props.status.rehearsal
  if (!r) return null
  const parts = [`«${r.showName || t('dashboard.device.pi.status.none')}»`, `${formatMs(r.fromMs)} → ${formatMs(r.toMs)}`]
  if (r.loop) parts.push(t('dashboard.device.pi.status.rehearsal_loop'))
  return parts.join(' · ')
})

const freeBytes = computed(() => formatBytes(props.status.freeBytes ?? props.info?.freeBytes))
const uptime = computed(() => formatUptime(props.status.uptimeS ?? props.info?.uptimeS))

function onConfirmPanic() {
  confirmPanic.value = false
  emit('panic')
}
</script>

<template>
  <section class="dp-card flex flex-col gap-3">
    <div class="dp-card-head !mb-0">
      <span class="dp-label">{{ t('dashboard.device.pi.status.title') }}</span>
      <span class="badge" :class="STATE_TONES[status.state] ?? ''">{{ stateLabel }}</span>
    </div>

    <div>
      <span class="dp-label">{{ t('dashboard.device.pi.status.show') }}</span>
      <p class="truncate text-[18px] font-semibold tracking-[-0.015em] text-ink">{{ status.showName || t('dashboard.device.pi.status.none') }}</p>
    </div>

    <dl class="kpis">
      <div><dt class="dp-label">{{ t('dashboard.device.pi.status.mode') }}</dt><dd>{{ modeLabel }}</dd></div>
      <div><dt class="dp-label">{{ t('dashboard.device.pi.status.cycle') }}</dt><dd class="tabular-nums">{{ cycleText }}</dd></div>
      <div><dt class="dp-label">{{ t('dashboard.device.pi.status.uptime') }}</dt><dd class="tabular-nums">{{ uptime }}</dd></div>
      <div><dt class="dp-label">{{ t('dashboard.device.pi.status.free') }}</dt><dd class="tabular-nums">{{ freeBytes }}</dd></div>
    </dl>
    <div class="dp-progress" role="progressbar" :aria-valuenow="cyclePercent" aria-valuemin="0" aria-valuemax="100">
      <span :style="{ width: `${cyclePercent}%` }" />
    </div>

    <div v-if="rehearsalText" class="dp-notice dp-notice-info flex flex-col gap-1">
      <span class="dp-label">{{ t('dashboard.device.pi.status.rehearsal') }}</span>
      <span>{{ rehearsalText }}</span>
      <span v-for="m in status.rehearsal?.skippedMotors ?? []" :key="m.target">
        {{ m.reason === 'cut'
          ? t('dashboard.device.pi.status.rehearsal_cut', { motor: m.target })
          : t('dashboard.device.pi.status.rehearsal_unbalanced', { motor: m.target, forward: m.forward, reverse: m.reverse }) }}
      </span>
      <div v-if="canControl">
        <button type="button" class="dp-btn" :disabled="busy" @click="emit('endRehearsal')">{{ t('dashboard.device.pi.status.rehearsal_end') }}</button>
      </div>
    </div>

    <div v-if="scheduleText" class="text-[13px] leading-[18px]">
      <span class="dp-label">{{ t('dashboard.device.pi.status.schedule') }}</span>
      <p class="text-ink">{{ scheduleText.windows }}</p>
      <p class="text-ink-soft">{{ scheduleText.now }}</p>
    </div>
    <div v-if="clockText" class="text-[13px] leading-[18px]">
      <span class="dp-label">{{ t('dashboard.device.pi.status.clock') }}</span>
      <p :class="status.clock?.reliable ? 'text-ink' : 'text-warn-ink'">{{ clockText }}</p>
    </div>
    <p v-if="status.lastError" class="dp-notice dp-notice-danger">
      <strong>{{ t('dashboard.device.pi.status.last_error') }}:</strong> {{ status.lastError }}
    </p>

    <div v-if="canControl" class="flex flex-col gap-2 border-t border-line pt-3">
      <div class="flex gap-2">
        <button
          type="button"
          class="dp-btn dp-btn-lg dp-btn-primary flex-1"
          :disabled="busy || playing || !status.showHash || !!status.rehearsal"
          @click="emit('play')"
        >
          ▶ {{ t('dashboard.device.pi.controls.play') }}
        </button>
        <button type="button" class="dp-btn dp-btn-lg flex-1" :disabled="busy || !playing" @click="emit('stop')">
          ■ {{ t('dashboard.device.pi.controls.stop') }}
        </button>
      </div>
      <button type="button" class="dp-btn dp-btn-lg dp-btn-danger-solid w-full" :disabled="busy" @click="confirmPanic = true">
        {{ t('dashboard.device.pi.controls.panic') }}
      </button>
    </div>

    <DashboardConfirmDialog
      :open="confirmPanic"
      tone="danger"
      :title="t('dashboard.device.pi.controls.panic_title')"
      :message="t('dashboard.device.pi.controls.panic_message')"
      :confirm-label="t('dashboard.device.pi.controls.panic')"
      @confirm="onConfirmPanic"
      @close="confirmPanic = false"
    />
  </section>
</template>

<style scoped>
.kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
.kpis > div { border-radius: 6px; background: var(--c-bg-soft); padding: 8px 10px; min-width: 0; }
.kpis dd { margin: 2px 0 0; font-size: 14px; font-weight: 600; color: var(--c-ink); overflow-wrap: anywhere; }
</style>
