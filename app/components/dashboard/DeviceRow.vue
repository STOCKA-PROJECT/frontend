<script setup lang="ts">
import type { DeviceResponseDto } from '~/types/api'

/**
 * One registered Raspberry Pi and the last state it reported: online/offline, player state,
 * active show, cut ports, version, IP and last error. Actions are emitted to the board.
 */
const props = defineProps<{
  device: DeviceResponseDto
  canWrite: boolean
  /** Reference instant for the relative «last heartbeat» label; the board refreshes it. */
  now: number
}>()

const emit = defineEmits<{
  rename: []
  rotate: []
  delete: []
}>()

const { t, te, locale } = useI18n()

// Same colour logic as the player's own page (rpi4-system/app/api/ui/app.js).
const STATE_TONES: Record<string, string> = {
  PLAYING: 'badge-ok',
  IDLE: 'badge-brand',
  SAFE: 'badge-warn',
  ERROR: 'badge-danger',
  TEST: 'badge-highlight'
}

// `sha256:` is 7 characters: the short form shows the first 8 hex digits of the hash.
const SHOW_HASH_START = 7
const SHOW_HASH_END = 15

interface RelativeUnit { unit: Intl.RelativeTimeFormatUnit, ms: number }
const UNITS: RelativeUnit[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 }
]

const relativeFormatter = computed(() => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }))
const absoluteFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }))

/** «fa 3 minuts» / «hace 3 minutos» / «3 minutes ago»; under a minute, «ara mateix». */
const lastSeenRelative = computed<string | null>(() => {
  const iso = props.device.lastSeenAt
  if (!iso) return null
  // A heartbeat stamped slightly in the future (clock skew) still reads as «just now».
  const diff = Math.min(0, new Date(iso).getTime() - props.now)
  const abs = Math.abs(diff)
  for (const { unit, ms } of UNITS) {
    if (abs >= ms) return relativeFormatter.value.format(Math.round(diff / ms), unit)
  }
  return t('dashboard.devices.list.just_now')
})

const lastSeenAbsolute = computed<string | null>(() => {
  const iso = props.device.lastSeenAt
  return iso ? absoluteFormatter.value.format(new Date(iso)) : null
})

const stateTone = computed(() => STATE_TONES[props.device.lastState ?? ''] ?? '')

const stateLabel = computed(() => {
  const state = props.device.lastState
  if (!state) return t('dashboard.devices.state.unknown')
  const key = `dashboard.devices.state.${state}`
  return te(key) ? t(key) : state
})

const shortHash = computed<string | null>(() => {
  const hash = props.device.lastShowHash
  return hash ? hash.slice(SHOW_HASH_START, SHOW_HASH_END) : null
})

const hasShow = computed(() => props.device.lastShowName !== null || props.device.lastShowHash !== null)
</script>

<template>
  <li class="device-row flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="truncate text-[14px] font-semibold leading-5 text-ink">{{ device.name }}</span>
        <span class="badge" :class="device.online ? 'badge-ok' : ''">
          {{ device.online ? t('dashboard.devices.list.online') : t('dashboard.devices.list.offline') }}
        </span>
        <span class="badge" :class="stateTone">{{ stateLabel }}</span>
        <span
          v-if="lastSeenRelative"
          class="text-[12.5px] leading-4 text-ink-muted"
          :title="lastSeenAbsolute ? t('dashboard.devices.list.last_seen_title', { date: lastSeenAbsolute }) : undefined"
        >
          {{ lastSeenRelative }}
        </span>
        <span v-else class="text-[12.5px] leading-4 text-ink-muted">
          {{ t('dashboard.devices.list.never_seen') }}
        </span>
      </div>

      <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px]">
        <span class="label">{{ t('dashboard.devices.list.show_label') }}</span>
        <template v-if="hasShow">
          <span class="text-ink">{{ device.lastShowName ?? '—' }}</span>
          <code v-if="shortHash" class="mono text-ink-muted" :title="device.lastShowHash ?? undefined">{{ shortHash }}</code>
        </template>
        <span v-else class="text-ink-muted">{{ t('dashboard.devices.list.no_show') }}</span>
      </p>

      <div v-if="device.lastOverrides.length" class="mt-2 flex flex-wrap items-center gap-1.5">
        <span class="label">{{ t('dashboard.devices.list.overrides_label') }}</span>
        <span v-for="port in device.lastOverrides" :key="port" class="badge badge-danger">{{ port }}</span>
      </div>

      <dl class="meta mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <div class="meta-item">
          <dt>{{ t('dashboard.devices.list.version') }}</dt>
          <dd>{{ device.lastVersion ?? '—' }}</dd>
        </div>
        <div class="meta-item">
          <dt>{{ t('dashboard.devices.list.ip') }}</dt>
          <dd>{{ device.lastIp ?? '—' }}</dd>
        </div>
        <div class="meta-item">
          <dt>{{ t('dashboard.devices.list.token') }}</dt>
          <dd>{{ device.tokenPrefix }}…</dd>
        </div>
        <div class="meta-item">
          <dt>{{ t('dashboard.devices.list.board') }}</dt>
          <dd>{{ device.board }}</dd>
        </div>
        <div v-if="device.deviceId" class="meta-item">
          <dt>{{ t('dashboard.devices.list.device_id') }}</dt>
          <dd>{{ device.deviceId }}</dd>
        </div>
      </dl>

      <p v-if="device.lastError" class="mt-1.5 truncate text-[12.5px] leading-4 text-ink-muted" :title="device.lastError">
        <span class="label">{{ t('dashboard.devices.list.last_error') }}</span>
        {{ device.lastError }}
      </p>
    </div>

    <div v-if="canWrite" class="flex flex-shrink-0 flex-wrap items-center gap-1.5">
      <button type="button" class="row-btn" @click="emit('rename')">
        <DashboardIcon name="edit" :size="14" />
        {{ t('dashboard.devices.list.rename') }}
      </button>
      <button type="button" class="row-btn" @click="emit('rotate')">
        <DashboardIcon name="refresh" :size="14" />
        {{ t('dashboard.devices.list.rotate') }}
      </button>
      <button type="button" class="row-btn row-btn-danger" @click="emit('delete')">
        <DashboardIcon name="trash" :size="14" />
        {{ t('dashboard.devices.list.delete') }}
      </button>
    </div>
  </li>
</template>

<style scoped>
/* Brandbook: fila sobre surface-panel, radius-lg, badges d'estat amb els parells ok/warn/danger, dades en mono. */
.device-row {
  border-radius: 10px;
  border: 1px solid var(--c-line-strong);
  background: var(--c-bg-card);
  padding: 12px 16px;
}
.label {
  font-size: 11px;
  line-height: 14px;
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--c-ink-muted);
}
.mono {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12.5px;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 8px;
  border-radius: 3px;
  background: var(--c-bg-alt);
  color: var(--c-ink-soft);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  white-space: nowrap;
}
.badge::before { content: ""; width: 6px; height: 6px; flex: none; border-radius: 50%; background: currentColor; }
.badge-ok { background: var(--c-ok-soft); color: var(--c-ok); }
.badge-brand { background: var(--c-accent-soft); color: var(--c-accent-ink); }
.badge-warn { background: var(--c-warn-soft); color: var(--c-warn-ink); }
.badge-danger { background: var(--c-danger-soft); color: var(--c-danger); }
.badge-highlight { background: color-mix(in oklab, var(--c-highlight) 22%, var(--c-bg-card)); color: var(--c-highlight-ink); }
.meta-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12.5px;
  line-height: 16px;
}
.meta-item dt { color: var(--c-ink-muted); }
.meta-item dd {
  margin: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  color: var(--c-ink-soft);
}
.row-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--c-line-control, var(--c-line-strong));
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .12s, border-color .12s, color .12s;
}
.row-btn:hover { background: var(--c-bg-soft); }
.row-btn-danger { border-color: var(--c-danger); color: var(--c-danger); }
.row-btn-danger:hover { background: var(--c-danger-soft); }
</style>
