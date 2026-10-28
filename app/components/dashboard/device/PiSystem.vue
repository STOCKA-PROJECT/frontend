<script setup lang="ts">
import type { PiInfo, PiNet } from '~/types/pi'

/** The player's network (mode, network, IP, forcing its own Wi-Fi) and its reboot, each confirmed first. */
const props = defineProps<{
  net: PiNet | null
  info: PiInfo | null
  canControl: boolean
  busy: boolean
}>()

const emit = defineEmits<{ netMode: [mode: 'ap' | 'auto'], hotspot: [], reboot: [] }>()

const { t } = useI18n()

type Pending = { kind: 'mode', mode: 'ap' | 'auto' } | { kind: 'hotspot' } | { kind: 'reboot' }
const pending = ref<Pending | null>(null)

const netEnabled = computed(() => !!props.net && props.net.enabled !== false)
const networkLabel = computed(() => {
  const n = props.net
  if (!n) return '—'
  if (n.hotspot) return `${n.ssid ?? props.info?.device.apSsid ?? ''} · ${t('dashboard.device.pi.system.hotspot_active')}`
  return n.ssid || t('dashboard.device.pi.system.disconnected')
})

const dialog = computed(() => {
  const p = pending.value
  if (!p) return null
  if (p.kind === 'reboot') {
    return { title: t('dashboard.device.pi.system.reboot_title'), message: t('dashboard.device.pi.system.reboot_message'), confirm: t('dashboard.device.pi.system.reboot') }
  }
  if (p.kind === 'hotspot') {
    return {
      title: t('dashboard.device.pi.system.hotspot_now'),
      message: t('dashboard.device.pi.system.hotspot_message', { ssid: props.info?.device.apSsid ?? 'belen' }),
      confirm: t('dashboard.device.pi.system.hotspot_now')
    }
  }
  return {
    title: t('dashboard.device.pi.system.net_title'),
    message: t('dashboard.device.pi.system.net_message'),
    confirm: p.mode === 'ap' ? t('dashboard.device.pi.system.net_ap') : t('dashboard.device.pi.system.net_auto')
  }
})

function confirm() {
  const p = pending.value
  pending.value = null
  if (!p) return
  if (p.kind === 'reboot') emit('reboot')
  else if (p.kind === 'hotspot') emit('hotspot')
  else emit('netMode', p.mode)
}
</script>

<template>
  <section class="dp-card flex flex-col gap-3">
    <span class="dp-label">{{ t('dashboard.device.pi.system.title') }}</span>
    <template v-if="netEnabled && net">
      <dl class="dp-meta">
        <div>
          <dt>{{ t('dashboard.device.pi.system.net_mode') }}</dt>
          <dd>{{ net.mode === 'ap' ? t('dashboard.device.pi.system.net_ap') : t('dashboard.device.pi.system.net_auto') }}</dd>
        </div>
        <div>
          <dt>{{ t('dashboard.device.pi.system.ssid') }}</dt>
          <dd>{{ networkLabel }}</dd>
        </div>
        <div>
          <dt>{{ t('dashboard.device.pi.system.ip') }}</dt>
          <dd>{{ net.ip || '—' }}</dd>
        </div>
      </dl>
      <div v-if="canControl" class="flex flex-wrap gap-2">
        <button type="button" class="dp-btn" :disabled="busy || net.mode === 'ap'" @click="pending = { kind: 'mode', mode: 'ap' }">{{ t('dashboard.device.pi.system.net_ap') }}</button>
        <button type="button" class="dp-btn" :disabled="busy || net.mode === 'auto'" @click="pending = { kind: 'mode', mode: 'auto' }">{{ t('dashboard.device.pi.system.net_auto') }}</button>
        <button type="button" class="dp-btn" :disabled="busy" @click="pending = { kind: 'hotspot' }">{{ t('dashboard.device.pi.system.hotspot_now') }}</button>
      </div>
    </template>
    <p v-else class="dp-hint">{{ t('dashboard.device.pi.system.net_disabled') }}</p>

    <div v-if="canControl" class="border-t border-line pt-3">
      <button type="button" class="dp-btn dp-btn-danger" :disabled="busy" @click="pending = { kind: 'reboot' }">
        <DashboardIcon name="refresh" :size="14" />
        {{ t('dashboard.device.pi.system.reboot') }}
      </button>
    </div>

    <DashboardConfirmDialog
      :open="dialog !== null"
      tone="danger"
      :title="dialog?.title ?? ''"
      :message="dialog?.message ?? ''"
      :confirm-label="dialog?.confirm"
      @confirm="confirm"
      @close="pending = null"
    />
  </section>
</template>
