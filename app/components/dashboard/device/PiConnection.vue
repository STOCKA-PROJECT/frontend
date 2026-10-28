<script setup lang="ts">
import type { DeviceResponseDto } from '~/types/api'
import type { PiInfo } from '~/types/pi'
import type { PiConnection } from '~/composables/usePiControl'

/**
 * The device's heartbeat (from Stocka) and the local connection of this browser to the player:
 * where it connects, whether it answers, and why commands may be unavailable.
 */
const props = defineProps<{
  device: DeviceResponseDto
  connection: PiConnection
  info: PiInfo | null
  canControl: boolean
  isSpectator: boolean
}>()

const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()

const CONNECTION_TONES: Record<PiConnection, string> = {
  idle: '',
  connecting: 'badge-warn',
  connected: 'badge-ok',
  unreachable: 'badge-danger'
}

const address = computed(() => props.device.localUrl?.replace(/^https?:\/\//, '') ?? null)

/** The site's CSP only lets the browser reach the player over plain HTTP on its port, 8080. */
const PLAYER_PORT = '8080'
const portSupported = computed(() => {
  const url = props.device.localUrl
  if (!url) return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' && parsed.port === PLAYER_PORT
  } catch {
    return false
  }
})
</script>

<template>
  <section class="dp-card flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <h1 class="mr-1 text-[22px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[26px]">{{ device.name }}</h1>
      <span class="badge" :class="device.online ? 'badge-ok' : ''">
        {{ device.online ? t('dashboard.devices.list.online') : t('dashboard.devices.list.offline') }}
      </span>
      <span class="badge" :class="CONNECTION_TONES[connection]">{{ t(`dashboard.device.pi.connection.${connection}`) }}</span>
    </div>

    <dl class="dp-meta">
      <div>
        <dt>{{ t('dashboard.device.pi.address') }}</dt>
        <dd>{{ address ?? '—' }}</dd>
      </div>
      <div v-if="info">
        <dt>{{ t('dashboard.device.pi.player_name') }}</dt>
        <dd>{{ info.device.name }}</dd>
      </div>
      <div v-if="info">
        <dt>{{ t('dashboard.device.pi.version') }}</dt>
        <dd>{{ info.version }}<template v-if="info.simulate"> · {{ t('dashboard.device.pi.simulated') }}</template></dd>
      </div>
      <div v-if="device.deviceId">
        <dt>{{ t('dashboard.devices.list.device_id') }}</dt>
        <dd>{{ device.deviceId }}</dd>
      </div>
    </dl>

    <p v-if="!address" class="dp-notice dp-notice-warn">{{ t('dashboard.device.pi.no_address') }}</p>
    <p v-else-if="!portSupported" class="dp-notice dp-notice-warn">{{ t('dashboard.device.pi.port_unsupported') }}</p>
    <template v-else-if="connection === 'unreachable'">
      <p class="dp-notice dp-notice-danger">{{ t('dashboard.device.pi.unreachable_hint') }}</p>
      <div>
        <button type="button" class="dp-btn" @click="emit('retry')">
          <DashboardIcon name="refresh" :size="14" />
          {{ t('dashboard.device.pi.retry') }}
        </button>
      </div>
    </template>
    <p v-if="address && !canControl" class="dp-hint">
      {{ isSpectator ? t('dashboard.device.pi.read_only_spectator') : t('dashboard.device.pi.read_only_no_pin') }}
    </p>
  </section>
</template>
