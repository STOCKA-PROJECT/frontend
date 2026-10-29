<script setup lang="ts">
import type { PieceListItemDto } from '~/types/api'

const props = defineProps<{
  piece: PieceListItemDto
  orgSlug: string
  draggable?: boolean
}>()

const emit = defineEmits<{
  preview: [piece: PieceListItemDto]
}>()

const { t, locale } = useI18n()
const piecesStore = usePiecesStore()

const { onDragStart, onDragEnd, dragging } = useDragSource(
  () => ({ kind: 'piece', id: props.piece.id }),
  { disabled: () => !props.draggable }
)

const thumbVariant = computed(() => {
  const seed = props.piece.pieceTypes[0]?.id ?? props.piece.id
  return `t-${(seed % 5) + 1}`
})

// Same thumbnail as the pieces table: the backend's 512 px JPEG (`/thumbnail`,
// immutable cache). The panel opens the original (`/content`) in its lightbox.
const { srcFor, isBroken, onError } = useImageRetry()

const coverUrl = computed(() => props.piece.coverAttachmentId
  ? piecesStore.attachmentThumbnailUrl(props.orgSlug, props.piece.id, props.piece.coverAttachmentId)
  : null)

const hasCover = computed(() => !!coverUrl.value && !isBroken(coverUrl.value))

const typeLabel = computed(() => {
  const types = props.piece.pieceTypes
  if (types.length === 0) return ''
  if (types.length === 1) return types[0]!.name
  return `${types[0]!.name} +${types.length - 1}`
})

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

    <button
      type="button"
      class="thumb-btn"
      :disabled="!hasCover"
      :aria-label="t('dashboard.pieces_table.preview_cover_aria', { name: piece.name })"
      @click.stop="emit('preview', piece)"
    >
      <img
        v-if="hasCover"
        :src="srcFor(coverUrl)"
        :alt="piece.name"
        class="thumb-img"
        draggable="false"
        loading="lazy"
        decoding="async"
        @error="onError(coverUrl)"
      >
      <span
        v-else
        :class="['piece-thumb flex h-full w-full items-center justify-center rounded-lg text-bg-card', thumbVariant]"
      >
        <DashboardIcon name="box" :size="14" />
      </span>
    </button>

    <div class="min-w-0 flex-1">
      <div class="truncate text-[13.5px] font-medium text-ink">{{ piece.name }}</div>
      <div class="truncate text-[11.5px] text-ink-muted">{{ typeLabel }}</div>
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

/* Drag is desktop-only — hide affordances on touch devices. */
@media (hover: none) and (pointer: coarse) {
  .grip { display: none; }
  .piece-row.is-draggable { cursor: default; }
}

/* Native button reset so the thumbnail keeps its look (as in PiecesTable). */
.thumb-btn {
  width: 34px;
  height: 34px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--c-bg-soft);
  cursor: zoom-in;
  display: block;
  transition: box-shadow .15s;
}
.thumb-btn:disabled { cursor: inherit; }
.thumb-btn:not(:disabled):hover {
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--c-accent) 35%, transparent);
}
.thumb-btn:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
.thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }

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
