<script setup lang="ts">
import type { PieceListItemDto } from '~/types/api'

const props = defineProps<{
  piece: PieceListItemDto
  draggable?: boolean
}>()

const { t, locale } = useI18n()

const { onDragStart, onDragEnd, dragging } = useDragSource(
  () => ({ kind: 'piece', id: props.piece.id }),
  { disabled: () => !props.draggable }
)

const thumbVariant = computed(() => `t-${(props.piece.pieceTypeId % 5) + 1}`)

const dateLocale = computed(() => {
  const l = locale.value as string
  return l === 'ca' ? 'ca-ES' : l === 'en' ? 'en-US' : 'es-ES'
})

const statusLabel = computed(() => props.piece.status === 'PENDING'
  ? t('dashboard.pieces_table.status_pending')
  : t('dashboard.pieces_table.status_active'))

const statusClass = computed(() => props.piece.status === 'PENDING' ? 'tag-warn' : 'tag-ok')

const updatedAtLabel = computed(() => {
  const iso = props.piece.updatedAt
  if (!iso) return ''
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return t('dashboard.pieces_table.now')
  if (min < 60) return t('dashboard.pieces_table.minutes_ago', { min })
  const h = Math.floor(min / 60)
  if (h < 24) return t('dashboard.pieces_table.hours_ago', { h })
  const d = Math.floor(h / 24)
  if (d < 7) return t('dashboard.pieces_table.days_ago', { d })
  return date.toLocaleDateString(dateLocale.value, { day: '2-digit', month: 'short' })
})
</script>

<template>
  <div
    :draggable="draggable ? true : false"
    class="piece-row flex items-center gap-3 rounded-[10px] border border-line bg-bg-card px-3 py-2.5 transition-[background,border-color,opacity] duration-150"
    :class="{ 'is-draggable': draggable, 'is-dragging': dragging }"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <span v-if="draggable" class="grip text-ink-muted" aria-hidden="true">
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="2" cy="3" r="1.2" />
        <circle cx="2" cy="8" r="1.2" />
        <circle cx="2" cy="13" r="1.2" />
        <circle cx="8" cy="3" r="1.2" />
        <circle cx="8" cy="8" r="1.2" />
        <circle cx="8" cy="13" r="1.2" />
      </svg>
    </span>

    <div :class="['piece-thumb flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-lg text-bg-card', thumbVariant]">
      <DashboardIcon name="box" :size="14" />
    </div>

    <div class="min-w-0 flex-1">
      <div class="truncate text-[13.5px] font-medium text-ink">{{ piece.name }}</div>
      <div class="truncate text-[11.5px] text-ink-muted">{{ piece.pieceTypeName }}</div>
    </div>

    <span :class="['tag flex-shrink-0', statusClass]">
      <span class="dt" />{{ statusLabel }}
    </span>
    <span class="hidden flex-shrink-0 text-[11.5px] text-ink-muted sm:inline">{{ updatedAtLabel }}</span>
  </div>
</template>

<style scoped>
.piece-row.is-draggable { cursor: grab; }
.piece-row.is-draggable:hover { background: var(--c-bg-soft); border-color: var(--c-line-strong); }
.piece-row.is-draggable:active { cursor: grabbing; }
.piece-row.is-dragging { opacity: .5; }
.grip { display: inline-flex; align-items: center; padding: 0 2px; cursor: grab; }

.piece-thumb.t-1 { background: linear-gradient(135deg, #dccfb8, #c8b89c); }
.piece-thumb.t-2 { background: linear-gradient(135deg, #cdd9c8, #a8baa3); }
.piece-thumb.t-3 { background: linear-gradient(135deg, #d3dde6, #b6c1cd); }
.piece-thumb.t-4 { background: linear-gradient(135deg, #ead9c9, #d4bda7); }
.piece-thumb.t-5 { background: linear-gradient(135deg, #dfd4c0, #c2b59a); }

.tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
}
.tag .dt { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.tag-ok { background: var(--c-accent-soft); color: var(--c-accent-ink); }
.tag-warn { background: var(--c-warn-soft); color: #8a6324; }
</style>
