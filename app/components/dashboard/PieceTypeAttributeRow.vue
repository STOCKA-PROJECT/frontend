<script setup lang="ts">
import type { AttributeValidatorsDto, PieceTypeAttributeResponseDto } from '~/types/api'

const props = defineProps<{
  attr: PieceTypeAttributeResponseDto
  canWrite: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const { t } = useI18n()

const typeLabel = computed(() => t(`dashboard.pieceTypes.types.${props.attr.type}`))

function preview(v: AttributeValidatorsDto): string | null {
  switch (props.attr.type) {
    case 'TEXT':
    case 'LONGTEXT': {
      const parts: string[] = []
      if (v.minLength != null || v.maxLength != null) {
        parts.push(`${v.minLength ?? 0}–${v.maxLength ?? '∞'}`)
      }
      if (v.regex) parts.push('regex')
      return parts.length ? parts.join(' · ') : null
    }
    case 'INTEGER':
    case 'DECIMAL':
    case 'PRICE': {
      const parts: string[] = []
      if (v.min != null || v.max != null) {
        parts.push(`${v.min ?? '−∞'}…${v.max ?? '∞'}`)
      }
      if (props.attr.type === 'PRICE' && v.currency) parts.push(v.currency)
      if (v.decimals != null) parts.push(`${v.decimals}d`)
      return parts.length ? parts.join(' · ') : null
    }
    case 'DATE':
    case 'DATETIME': {
      const parts: string[] = []
      if (v.minDate || v.maxDate) parts.push(`${v.minDate ?? '…'} → ${v.maxDate ?? '…'}`)
      if (v.allowFuture === false) parts.push('-futuro')
      if (v.allowPast === false) parts.push('-pasado')
      return parts.length ? parts.join(' · ') : null
    }
    case 'SELECT':
    case 'MULTI_SELECT': {
      const n = v.options?.length ?? 0
      const parts = [t('dashboard.pieceTypes.list.option_count', { n })]
      if (props.attr.type === 'MULTI_SELECT' && (v.minItems != null || v.maxItems != null)) {
        parts.push(`${v.minItems ?? 0}–${v.maxItems ?? '∞'}`)
      }
      return parts.join(' · ')
    }
    case 'URL':
    case 'EMAIL':
      return v.maxLength != null ? `≤ ${v.maxLength}` : null
    case 'BOOLEAN':
    default:
      return null
  }
}

const previewLine = computed(() => preview(props.attr.validators ?? {}))
</script>

<template>
  <div class="row group flex items-center gap-3 rounded-[10px] border border-line bg-bg-card px-3.5 py-2.5">
    <span class="type-pill" :data-type="attr.type">
      <DashboardAttributeTypeIcon :type="attr.type" :size="12" class="opacity-80" />
      {{ typeLabel }}
    </span>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span class="truncate text-[13.5px] font-medium text-ink">
          {{ attr.displayName }}
        </span>
        <span v-if="attr.required" class="text-[12px] font-semibold text-danger" aria-hidden="true">*</span>
      </div>
      <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <code class="text-[11.5px] text-ink-muted">{{ attr.name }}</code>
        <span v-if="previewLine" class="text-[11.5px] text-ink-muted">· {{ previewLine }}</span>
      </div>
    </div>

    <div v-if="canWrite" class="row-actions-pulse flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button type="button" class="row-btn"
        :aria-label="t('dashboard.pieceTypes.attribute_form.edit_title', { name: attr.displayName })"
        @click="emit('edit')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
        </svg>
      </button>
      <button type="button" class="row-btn row-btn-danger"
        :aria-label="t('dashboard.pieceTypes.delete.attribute_confirm_title')"
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

.type-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .01em;
  background: var(--c-bg-soft);
  color: var(--c-ink-soft);
  white-space: nowrap;
}
.type-pill[data-type="MEMBER"] {
  background: color-mix(in oklab, var(--c-accent, var(--c-ink)) 10%, transparent);
  color: var(--c-ink);
}
.type-pill[data-type="INTEGER"], .type-pill[data-type="DECIMAL"], .type-pill[data-type="PRICE"] {
  color: var(--c-ink);
}
.type-pill[data-type="BOOLEAN"] {
  background: color-mix(in oklab, var(--c-accent, var(--c-ink)) 12%, transparent);
  color: var(--c-ink);
}
.type-pill[data-type="SELECT"], .type-pill[data-type="MULTI_SELECT"] {
  background: color-mix(in oklab, var(--c-ink) 8%, transparent);
}
.type-pill[data-type="DATE"], .type-pill[data-type="DATETIME"] {
  background: color-mix(in oklab, var(--c-ink) 6%, transparent);
}

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
.row-btn:hover {
  background: var(--c-bg-card);
  color: var(--c-ink);
  border-color: var(--c-line);
}
.row-btn-danger:hover {
  color: var(--c-danger);
  border-color: color-mix(in oklab, var(--c-danger) 35%, transparent);
  background: var(--c-danger-soft);
}

/* Touch devices never trigger :hover, so row actions must always be visible. */
@media (hover: none) and (pointer: coarse) {
  .row-actions-pulse { opacity: 1 !important; }
}
</style>
