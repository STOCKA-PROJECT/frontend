<script setup lang="ts">
import type { PieceTypeActionResponseDto } from '~/types/api'

const props = defineProps<{
  action: PieceTypeActionResponseDto
  canManage: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const { t } = useI18n()

const parameterCount = computed(() => props.action.parameters.length)
</script>

<template>
  <div class="row group flex items-start gap-3 rounded-[10px] border border-line bg-bg-card px-3.5 py-2.5">
    <span class="action-pill">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      {{ t('dashboard.pieceTypes.actions.pill') }}
    </span>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span class="truncate text-[13.5px] font-medium text-ink">{{ action.displayName }}</span>
      </div>
      <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <code class="text-[11.5px] text-ink-muted">{{ action.name }}</code>
        <span class="text-[11.5px] text-ink-muted">
          · {{ t('dashboard.pieceTypes.actions.parameter_count', { n: parameterCount }) }}
        </span>
      </div>
      <p v-if="action.description" class="mt-1 text-[12px] text-ink-soft">{{ action.description }}</p>

      <ul v-if="parameterCount" class="mt-1.5 flex flex-wrap gap-1.5">
        <li v-for="param in action.parameters" :key="param.name">
          <span class="param-chip">
            <span class="font-medium">{{ param.displayName || param.name }}</span>
            <span class="param-chip-type">{{ t(`dashboard.pieceTypes.types.${param.type}`) }}</span>
            <span v-if="param.required" class="text-danger" aria-hidden="true">*</span>
          </span>
        </li>
      </ul>
    </div>

    <div v-if="canManage" class="row-actions-pulse flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button type="button" class="row-btn"
        :aria-label="t('dashboard.pieceTypes.action_form.edit_title', { name: action.displayName })"
        @click="emit('edit')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
        </svg>
      </button>
      <button type="button" class="row-btn row-btn-danger"
        :aria-label="t('dashboard.pieceTypes.actions.delete_confirm_title')"
        @click="emit('delete')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.row { transition: background .12s, border-color .12s; }
.row:hover { background: var(--c-bg-soft); border-color: var(--c-line-strong); }

.action-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .01em;
  background: color-mix(in oklab, var(--c-accent, var(--c-ink)) 12%, transparent);
  color: var(--c-ink);
  white-space: nowrap;
  flex-shrink: 0;
}

.param-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-line);
  color: var(--c-ink);
  font-size: 11.5px;
}
.param-chip-type { color: var(--c-ink-muted); font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; }

.row-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--c-ink-muted);
  transition: background .12s, color .12s, border-color .12s;
}
.row-btn:hover { background: var(--c-bg-card); color: var(--c-ink); border-color: var(--c-line); }
.row-btn-danger:hover {
  color: var(--c-danger);
  border-color: color-mix(in oklab, var(--c-danger) 35%, transparent);
  background: var(--c-danger-soft);
}

@media (hover: none) and (pointer: coarse) {
  .row-actions-pulse { opacity: 1 !important; }
}
</style>
