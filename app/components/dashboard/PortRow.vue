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

const kindLabel = computed(() => t(`dashboard.kinds.${props.port.kind}`))

/** Short, monospace summary of what the kind needs: GPIO, segment range or motor pins. */
const address = computed<string | null>(() => {
  const c = props.port.config ?? {}
  switch (props.port.kind) {
    case 'led_segment':
      return `${String(c.strip ?? '?')} · ${String(c.first ?? '?')}–${String(c.last ?? '?')}`
    case 'motor':
      return `R ${String(c.pinR ?? '?')} · L ${String(c.pinL ?? '?')} · S ${String(c.sensorPin ?? '?')}`
    case 'led_strip':
      return props.port.pin == null ? null : `GPIO ${props.port.pin} · ${String(c.length ?? '?')} LED · DMA ${String(c.dma ?? '?')}/${String(c.channel ?? '?')}`
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
