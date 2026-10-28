<script setup lang="ts">
import type { PiAlert, PiMotor } from '~/types/pi'

/** Alerts of the player, newest first, with the unlock of a motor still locked by its timeout. */
const props = defineProps<{
  alerts: PiAlert[]
  motors: Record<string, PiMotor>
  canControl: boolean
  busy: boolean
}>()

const emit = defineEmits<{ clear: [], unlock: [motor: string] }>()

const { t, te, locale } = useI18n()

const newestFirst = computed(() => [...props.alerts].reverse())
const formatter = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }))

function label(code: string): string {
  const key = `dashboard.devices.alerts.${code}`
  return /^[a-z0-9_]+$/.test(code) && te(key) ? t(key) : t('dashboard.devices.alerts.unknown', { code })
}

function when(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : formatter.value.format(date)
}

/** Only the newest timeout of each motor offers the unlock, and only while it is still locked. */
const unlockable = computed(() => {
  const out = new Set<number>()
  const seen = new Set<string>()
  newestFirst.value.forEach((alert, index) => {
    if (alert.code !== 'motor_timeout' || !alert.port || seen.has(alert.port)) return
    seen.add(alert.port)
    if (props.motors[alert.port]?.locked) out.add(index)
  })
  return out
})
</script>

<template>
  <section class="dp-card alerts-card" role="alert" aria-live="assertive">
    <div class="dp-card-head">
      <span class="dp-label alerts-title">{{ t('dashboard.device.pi.alerts.title') }}</span>
      <span class="badge badge-danger">{{ alerts.length }}</span>
    </div>
    <ul class="dp-list">
      <li v-for="(alert, index) in newestFirst" :key="`${alert.at}|${alert.code}|${alert.port}|${index}`" class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <p class="text-[13.5px] font-medium text-ink">
            {{ label(alert.code) }}<template v-if="alert.port"> · <code class="mono">{{ alert.port }}</code></template>
          </p>
          <p v-if="alert.message" class="text-[13px] leading-[18px] text-ink-soft">{{ alert.message }}</p>
          <p class="dp-hint">{{ when(alert.at) }}</p>
        </div>
        <button
          v-if="canControl && unlockable.has(index) && alert.port"
          type="button"
          class="dp-btn dp-btn-primary"
          :disabled="busy"
          @click="emit('unlock', alert.port)"
        >
          {{ t('dashboard.device.pi.alerts.unlock') }}
        </button>
      </li>
    </ul>
    <button v-if="canControl" type="button" class="dp-btn mt-2" :disabled="busy" @click="emit('clear')">
      {{ t('dashboard.device.pi.alerts.clear') }}
    </button>
  </section>
</template>

<style scoped>
.alerts-card { border-color: var(--c-danger); box-shadow: inset 4px 0 0 var(--c-danger); }
.alerts-title { color: var(--c-danger); }
</style>
