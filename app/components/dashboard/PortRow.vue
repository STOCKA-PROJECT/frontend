<script setup lang="ts">
import type { AttributeType, PortResponseDto } from '~/types/api'

const props = defineProps<{
  port: PortResponseDto
  canWrite: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const { t } = useI18n()
const contract = useContractStore()

const kindLabel = computed(() => t(`dashboard.kinds.${props.port.kind}`))

/** `exp1:6/7`, `GPIO 27/17`: where a motor's two outputs are wired. */
function motorOutputs(c: Record<string, unknown>): string {
  if (typeof c.expander === 'string') return `${c.expander}:${String(c.channelForward ?? '?')}/${String(c.channelReverse ?? '?')}`
  return `GPIO ${String(c.pinForward ?? '?')}/${String(c.pinReverse ?? '?')}`
}

/** `máx 24/18 s · final: AngelDalt` (forward/reverse; a missing limit is a dash). */
function motorLimits(c: Record<string, unknown>): string {
  const parts = [`${t('dashboard.ports.list.max')} ${String(c.maxTimeForward ?? '?')}/${String(c.maxTimeReverse ?? '?')} s`]
  const forward = typeof c.limitForward === 'string' ? c.limitForward : null
  const reverse = typeof c.limitReverse === 'string' ? c.limitReverse : null
  if (forward || reverse) {
    const limits = reverse ? `${forward ?? '—'}/${reverse}` : forward!
    parts.push(`${t('dashboard.ports.list.limit')}: ${limits}`)
  }
  if (c.lockOnTimeout === true) parts.push(t('dashboard.ports.list.lock'))
  return parts.join(' · ')
}

/** `vl53l0x · ≤ 20 cm`, `ds18b20 GPIO 4 · ≥ 40 °C`: a measured sensor's model, wiring when it has a GPIO, and threshold. */
function measuredSummary(c: Record<string, unknown>): string {
  const profile = contract.sensorProfile(c.model)
  const quantities = Object.entries(profile?.quantities ?? {})
  const quantity = quantities.find(([id]) => id === c.quantity) ?? (quantities.length === 1 ? quantities[0] : undefined)
  const unit = quantity ? ` ${quantity[1].unit}` : ''
  const wiring = profile?.wiring === 'onewire' && props.port.pin != null
    ? ` GPIO ${props.port.pin}`
    : profile?.wiring === 'trig_echo' ? ` GPIO ${String(c.pinTrig ?? '?')}/${String(c.pinEcho ?? '?')}` : ''
  return `${String(c.model ?? '?')}${wiring} · ${c.activeWhen === 'above' ? '≥' : '≤'} ${String(c.threshold ?? '?')}${unit}`
}

/** `GPIO 20 · play`, `exp1:15 · stop_show`: input and what it does with the show (nothing for a plain limit switch). */
function sensorSummary(c: Record<string, unknown>): string | null {
  const onActive = typeof c.onActive === 'string' && c.onActive !== 'none' ? ` · ${c.onActive}` : ''
  if (c.source === 'measured') return `${measuredSummary(c)}${onActive}`
  const input = typeof c.expander === 'string'
    ? `${c.expander}:${String(c.channel ?? '?')}`
    : (props.port.pin == null ? null : `GPIO ${props.port.pin}`)
  if (!input) return null
  return `${input}${onActive}`
}

/** Short, monospace summary of what the kind needs: GPIO or expander channel, segment range, motor outputs, I2C or DMX address. */
const address = computed<string | null>(() => {
  const c = props.port.config ?? {}
  switch (props.port.kind) {
    case 'led_segment':
      return `${String(c.strip ?? '?')} · ${String(c.first ?? '?')}–${String(c.last ?? '?')}`
    case 'motor':
      return `${motorOutputs(c)} · ${motorLimits(c)}`
    case 'sensor':
      return sensorSummary(c)
    case 'led_strip':
      return props.port.pin == null ? null : `GPIO ${props.port.pin} · ${String(c.length ?? '?')} LED · DMA ${String(c.dma ?? '?')}/${String(c.channel ?? '?')}`
    case 'relay':
      if (typeof c.expander === 'string') return `${c.expander} · ${t('dashboard.ports.list.channel')} ${String(c.channel ?? '?')}`
      return props.port.pin == null ? null : `GPIO ${props.port.pin}${c.activeLow ? ` · ${t('dashboard.ports.list.active_low')}` : ''}`
    case 'gpio_expander':
      return `${String(c.chip ?? 'mcp23017')} · I2C 0x${typeof c.address === 'number' ? c.address.toString(16) : '?'} · bus ${String(c.bus ?? 1)}${c.activeLow ? ` · ${t('dashboard.ports.list.active_low')}` : ''}`
    case 'moving_head':
      return `DMX ${String(c.address ?? '?')} · ${String(c.profile ?? '?')}`
    default:
      return props.port.pin == null ? null : `GPIO ${props.port.pin}`
  }
})

const isInfrastructure = computed(() => props.port.pieceTypeId === null)

function typeLabel(type: AttributeType): string {
  return t(`dashboard.pieceTypes.types.${type}`)
}
</script>

<template>
  <li class="port-row flex items-start justify-between gap-3">
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="truncate text-[14px] font-semibold leading-5 text-ink">{{ port.name }}</span>
        <span class="badge badge-brand">{{ kindLabel }}</span>
        <span v-if="isInfrastructure" class="badge">{{ t('dashboard.ports.list.infrastructure') }}</span>
        <span v-else class="type-name">{{ port.pieceTypeName ?? t('dashboard.ports.list.unknown_type') }}</span>
      </div>

      <p v-if="address" class="address mt-1">{{ address }}</p>

      <ul v-if="port.parameters.length" class="mt-2 flex flex-wrap gap-1.5">
        <li v-for="p in port.parameters" :key="p.name" class="param-chip">
          <span class="font-medium text-ink">{{ p.displayName || p.name }}</span>
          <span class="text-ink-muted">·</span>
          <span class="text-ink-muted">{{ typeLabel(p.type) }}</span>
        </li>
      </ul>
    </div>

    <div v-if="canWrite" class="flex flex-shrink-0 items-center gap-1.5">
      <button type="button" class="row-btn" @click="emit('edit')">
        {{ t('dashboard.ports.list.edit') }}
      </button>
      <button type="button" class="row-btn row-btn-danger" @click="emit('delete')">
        {{ t('dashboard.ports.list.delete') }}
      </button>
    </div>
  </li>
</template>

<style scoped>
/* Brandbook: fila sobre surface-panel, radius-lg, badge per al kind (quadrat = brand), dades en mono. */
.port-row {
  border-radius: 10px;
  border: 1px solid var(--c-line-strong);
  background: var(--c-bg-card);
  padding: 12px 16px;
}
.type-name { font-size: 13px; line-height: 18px; color: var(--c-ink-soft); }
.address {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 18px;
  color: var(--c-ink-soft);
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
.badge-brand { background: var(--c-accent-soft); color: var(--c-accent); }
.badge-brand::before { border-radius: 1px; }
.param-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 3px;
  background: var(--c-bg-alt);
  padding: 2px 8px;
  font-size: 12px;
  line-height: 16px;
}
.row-btn {
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
