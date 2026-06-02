<script setup lang="ts">
import type { AttributeType, PortResponseDto } from '~/types/api'

defineProps<{
  port: PortResponseDto
  canWrite: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const { t } = useI18n()

function typeLabel(type: AttributeType): string {
  return t(`dashboard.pieceTypes.types.${type}`)
}
</script>

<template>
  <li class="port-row flex items-start justify-between gap-3 rounded-[12px] border border-line bg-bg-card p-4">
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-ink">{{ port.name }}</span>
        <span class="badge">{{ port.pieceTypeName ?? t('dashboard.ports.list.unknown_type') }}</span>
        <span class="badge badge-pin">GPIO {{ port.pin }}</span>
      </div>

      <ul v-if="port.parameters.length" class="mt-2.5 flex flex-wrap gap-1.5">
        <li v-for="p in port.parameters" :key="p.name" class="param-chip">
          <span class="font-medium text-ink">{{ p.displayName || p.name }}</span>
          <span class="text-ink-muted">·</span>
          <span class="text-ink-muted">{{ typeLabel(p.type) }}</span>
        </li>
      </ul>
      <p v-else class="mt-2 text-[12.5px] text-ink-muted">
        {{ t('dashboard.ports.list.no_parameters') }}
      </p>
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
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-soft);
  padding: 2px 9px;
  font-size: 12px;
  color: var(--c-ink-soft);
}
.badge-pin {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
}
.param-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-soft);
  padding: 3px 10px;
  font-size: 12px;
}
.row-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .15s, border-color .15s, color .15s;
}
.row-btn:hover { background: var(--c-bg-soft); }
.row-btn-danger:hover {
  color: var(--c-danger);
  border-color: color-mix(in oklab, var(--c-danger) 35%, transparent);
  background: var(--c-danger-soft);
}
</style>
