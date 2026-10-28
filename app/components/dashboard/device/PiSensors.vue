<script setup lang="ts">
import type { PiSensor } from '~/types/pi'

/** Live readings of the sensor ports, in alphabetical order; cutting them is done from the ports. */
const props = defineProps<{ sensors: Record<string, PiSensor> }>()

const { t, te } = useI18n()

const list = computed(() => Object.entries(props.sensors)
  .map(([name, sensor]) => ({ name, ...sensor }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })))

function onActiveLabel(onActive: string): string {
  const key = `dashboard.device.pi.sensors.on_${onActive}`
  return te(key) ? t(key) : onActive
}

/** `18.5 cm (≤ 20 cm)` for a measured sensor; null for a digital one. */
function reading(sensor: PiSensor): string | null {
  if (sensor.value === undefined) return null
  const unit = sensor.unit ? ` ${sensor.unit}` : ''
  const value = sensor.value === null ? t('dashboard.device.pi.sensors.no_reading') : `${sensor.value}${unit}`
  return `${value} (${sensor.activeWhen === 'above' ? '≥' : '≤'} ${sensor.threshold ?? '?'}${unit})`
}
</script>

<template>
  <section class="dp-card">
    <div class="dp-card-head">
      <span class="dp-label">{{ t('dashboard.device.pi.sensors.title') }}</span>
    </div>
    <ul v-if="list.length" class="dp-list">
      <li v-for="sensor in list" :key="sensor.name" class="flex items-center gap-3" :class="{ 'sensor-off': sensor.blocked }">
        <span
          class="sensor-dot"
          :class="{ 'is-on': sensor.active }"
          role="img"
          :aria-label="sensor.active ? t('dashboard.device.pi.sensors.active') : t('dashboard.device.pi.sensors.inactive')"
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-[13.5px] font-medium text-ink">{{ sensor.name }}</span>
          <span class="dp-hint">
            <code class="mono">{{ sensor.address }}</code>
            <template v-if="reading(sensor)"> · <code class="mono">{{ reading(sensor) }}</code></template>
            · {{ onActiveLabel(sensor.onActive) }} ·
            <span :class="sensor.active ? 'text-ok' : ''">{{ sensor.active ? t('dashboard.device.pi.sensors.active') : t('dashboard.device.pi.sensors.inactive') }}</span>
          </span>
        </div>
        <span v-if="sensor.blocked" class="badge badge-danger">{{ t('dashboard.device.pi.ports.cut_badge') }}</span>
      </li>
    </ul>
    <p v-else class="dp-hint">{{ t('dashboard.device.pi.sensors.none') }}</p>
  </section>
</template>

<style scoped>
.sensor-dot { width: 10px; height: 10px; flex: none; border-radius: 50%; background: var(--c-line-strong); transition: background-color .12s, box-shadow .12s; }
.sensor-dot.is-on { background: var(--c-ok); box-shadow: 0 0 0 3px var(--c-ok-soft); }
.sensor-off { opacity: .7; }
@media (prefers-reduced-motion: reduce) { .sensor-dot { transition: none; } }
</style>
