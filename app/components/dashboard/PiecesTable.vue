<script setup lang="ts">
import type { PieceListItemDto } from '~/types/api'

const props = withDefaults(defineProps<{
  pieces: PieceListItemDto[]
  orgId?: number | null
  loading?: boolean
  showLocation?: boolean
  showOwner?: boolean
  canWrite?: boolean
  linkTo?: (piece: PieceListItemDto) => string
  locationName?: (id?: number) => string | undefined
  ownerName?: (id?: number) => string | undefined
}>(), {
  loading: false,
  showLocation: false,
  showOwner: false,
  canWrite: false,
  orgId: null
})

const emit = defineEmits<{
  delete: [piece: PieceListItemDto]
  open: [piece: PieceListItemDto]
}>()

const { t, locale } = useI18n()
const router = useRouter()
const piecesStore = usePiecesStore()

const thumbVariant = (piece: PieceListItemDto) => {
  const seed = piece.pieceTypes[0]?.id ?? piece.id
  return `t-${(seed % 5) + 1}` as const
}

// Las blob URLs de las portadas viven en el store de piezas, así que se
// reutilizan entre listados y vista detalle sin volver a descargar la imagen
// al navegar. Aquí sólo disparamos las descargas que faltan.
function coverUrlFor(piece: PieceListItemDto): string | null {
  if (!piece.coverAttachmentId || props.orgId == null) return null
  return piecesStore.attachmentBlobUrls[`${props.orgId}:${piece.id}:${piece.coverAttachmentId}`] ?? null
}

watch(
  () => props.pieces.map(p => `${p.id}:${p.coverAttachmentId ?? 0}`),
  () => {
    if (props.orgId == null) return
    for (const p of props.pieces) {
      if (!p.coverAttachmentId) continue
      // Idempotente: si está cacheada o en vuelo, no relanza el fetch.
      void piecesStore.fetchAttachmentBlobUrl(props.orgId, p.id, p.coverAttachmentId)
    }
  },
  { immediate: true, deep: true }
)

// Vista previa de la portada en lightbox, abierta al pulsar la miniatura.
const previewOpen = ref(false)
const previewUrl = ref<string | null>(null)
const previewName = ref('')

function openPreview(piece: PieceListItemDto) {
  const url = coverUrlFor(piece)
  if (!url) return
  previewUrl.value = url
  previewName.value = piece.name
  previewOpen.value = true
}

const dateLocale = computed(() => {
  const l = locale.value as string
  return l === 'ca' ? 'ca-ES' : l === 'en' ? 'en-US' : 'es-ES'
})

const statusLabel = (s: PieceListItemDto['status']) => s === 'PENDING'
  ? t('dashboard.pieces_table.status_pending')
  : t('dashboard.pieces_table.status_active')
const statusClass = (s: PieceListItemDto['status']) => s === 'PENDING' ? 'tag-warn' : 'tag-ok'

function relativeDate(iso: string): string {
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
}

const isEmpty = computed(() => !props.loading && props.pieces.length === 0)
const isInteractive = computed(() => Boolean(props.linkTo))

function locationLabel(id?: number): string {
  if (id == null) return t('dashboard.pieces.unassigned_location')
  return props.locationName?.(id) ?? `#${id}`
}
function ownerLabel(id?: number): string {
  if (id == null) return t('dashboard.pieces.no_owner')
  return props.ownerName?.(id) ?? `#${id}`
}

function onRowClick(piece: PieceListItemDto, e: MouseEvent) {
  if (!props.linkTo) return
  // Si el click viene de un botón/enlace dentro de la fila (miniatura,
  // papelera, etc.) no navegamos: el botón ya tiene su propia acción.
  const target = e.target
  if (target instanceof Element && target.closest('button, a')) return
  emit('open', piece)
  void router.push(props.linkTo(piece))
}

function onRowKey(e: KeyboardEvent, piece: PieceListItemDto) {
  if (!props.linkTo) return
  if (e.key !== 'Enter' && e.key !== ' ') return
  const target = e.target
  if (target instanceof Element && target.closest('button, a')) return
  e.preventDefault()
  emit('open', piece)
  void router.push(props.linkTo(piece))
}

function onDelete(e: MouseEvent, piece: PieceListItemDto) {
  e.stopPropagation()
  emit('delete', piece)
}
</script>

<template>
  <div>
    <!-- Vista escritorio (md+): tabla completa -->
    <div class="hidden overflow-x-auto md:block">
      <table v-if="!isEmpty" class="w-full min-w-[680px] border-collapse text-[13.5px]">
        <thead>
          <tr>
            <th class="th">{{ t('dashboard.pieces_table.col_item') }}</th>
            <th class="th">{{ t('dashboard.pieces_table.col_type') }}</th>
            <th v-if="showLocation" class="th">{{ t('dashboard.pieces.filters.location') }}</th>
            <th v-if="showOwner" class="th">{{ t('dashboard.pieces.filters.owner') }}</th>
            <th class="th">{{ t('dashboard.pieces_table.col_status') }}</th>
            <th class="th">{{ t('dashboard.pieces_table.col_updated') }}</th>
            <th v-if="canWrite" class="th th-actions"><span class="sr-only">{{ t('dashboard.pieces.actions.delete') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in 4" :key="`s-${i}`">
              <td class="td"><span class="block h-5 w-48 animate-pulse rounded bg-bg-soft" /></td>
              <td class="td"><span class="block h-4 w-24 animate-pulse rounded bg-bg-soft" /></td>
              <td v-if="showLocation" class="td"><span class="block h-4 w-24 animate-pulse rounded bg-bg-soft" /></td>
              <td v-if="showOwner" class="td"><span class="block h-4 w-24 animate-pulse rounded bg-bg-soft" /></td>
              <td class="td"><span class="block h-5 w-20 animate-pulse rounded bg-bg-soft" /></td>
              <td class="td"><span class="block h-4 w-16 animate-pulse rounded bg-bg-soft" /></td>
              <td v-if="canWrite" class="td" />
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="p in pieces"
              :key="p.id"
              class="row"
              :class="{ 'row-interactive': isInteractive }"
              :tabindex="isInteractive ? 0 : -1"
              @click="onRowClick(p, $event)"
              @keydown="(e) => onRowKey(e, p)"
            >
              <td class="td">
                <div class="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    class="piece-thumb-btn piece-thumb-wrap"
                    :disabled="!coverUrlFor(p)"
                    :aria-label="t('dashboard.pieces_table.preview_cover_aria', { name: p.name })"
                    @click.stop="openPreview(p)"
                  >
                    <img
                      v-if="coverUrlFor(p)"
                      :src="coverUrlFor(p)!"
                      :alt="p.name"
                      class="piece-thumb-img"
                      loading="lazy"
                    >
                    <span
                      v-else
                      :class="['piece-thumb flex h-full w-full items-center justify-center rounded-lg text-bg-card', thumbVariant(p)]"
                    >
                      <DashboardIcon name="box" :size="16" />
                    </span>
                  </button>
                  <div class="min-w-0">
                    <div class="truncate font-medium tracking-[-0.005em] text-ink">{{ p.name }}</div>
                    <div v-if="p.serialNumber"
                      class="truncate font-mono text-[11.5px] tabular-nums text-ink-muted">
                      #{{ p.serialNumber }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="td">
                <div v-if="p.pieceTypes.length > 0" class="flex flex-wrap gap-1">
                  <span v-for="t in p.pieceTypes" :key="t.id" class="type-chip">{{ t.name }}</span>
                </div>
                <span v-else class="text-ink-muted">—</span>
              </td>
              <td v-if="showLocation" class="td">
                <span class="text-ink-soft">{{ locationLabel(p.locationId) }}</span>
              </td>
              <td v-if="showOwner" class="td">
                <span class="text-ink-soft">{{ ownerLabel(p.ownerUserId) }}</span>
              </td>
              <td class="td">
                <span :class="['tag', statusClass(p.status)]">
                  <span class="dt" />{{ statusLabel(p.status) }}
                </span>
              </td>
              <td class="td">
                <span class="text-[12.5px] text-ink-muted">{{ relativeDate(p.updatedAt) }}</span>
              </td>
              <td v-if="canWrite" class="td td-actions">
                <button
                  type="button"
                  class="trash-btn"
                  :aria-label="t('dashboard.pieces.actions.delete')"
                  :title="t('dashboard.pieces.actions.delete')"
                  @click="(e) => onDelete(e, p)"
                >
                  <DashboardIcon name="trash" :size="15" />
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div v-else class="flex flex-col items-center gap-3 px-5 py-12 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-bg-soft text-ink-muted">
          <DashboardIcon name="box" :size="20" />
        </div>
        <p class="max-w-[280px] text-[13.5px] text-ink-soft">
          {{ t('dashboard.pieces_table.empty') }}
        </p>
      </div>
    </div>

    <!-- Vista móvil (<md): tarjetas -->
    <div class="flex flex-col gap-2 md:hidden">
      <template v-if="loading">
        <div v-for="i in 4" :key="`sc-${i}`" class="piece-card piece-card-skel">
          <span class="piece-thumb-wrap-card animate-pulse rounded-lg bg-bg-soft" />
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <span class="block h-4 w-3/4 animate-pulse rounded bg-bg-soft" />
            <span class="block h-3 w-1/2 animate-pulse rounded bg-bg-soft" />
            <span class="block h-3 w-1/3 animate-pulse rounded bg-bg-soft" />
          </div>
        </div>
      </template>

      <div v-else-if="isEmpty" class="flex flex-col items-center gap-3 px-5 py-12 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-bg-soft text-ink-muted">
          <DashboardIcon name="box" :size="20" />
        </div>
        <p class="max-w-[280px] text-[13.5px] text-ink-soft">
          {{ t('dashboard.pieces_table.empty') }}
        </p>
      </div>

      <template v-else>
        <article
          v-for="p in pieces"
          :key="p.id"
          class="piece-card"
          :class="{ 'piece-card-interactive': isInteractive }"
          :tabindex="isInteractive ? 0 : -1"
          :role="isInteractive ? 'button' : undefined"
          @click="onRowClick(p, $event)"
          @keydown="(e) => onRowKey(e, p)"
        >
          <button
            type="button"
            class="piece-thumb-btn piece-thumb-wrap-card"
            :disabled="!coverUrlFor(p)"
            :aria-disabled="coverUrlFor(p) ? undefined : 'true'"
            :aria-label="t('dashboard.pieces_table.preview_cover_aria', { name: p.name })"
            @click.stop="openPreview(p)"
          >
            <img
              v-if="coverUrlFor(p)"
              :src="coverUrlFor(p)!"
              :alt="p.name"
              class="piece-thumb-img"
              loading="lazy"
            >
            <span
              v-else
              :class="['piece-thumb flex h-full w-full items-center justify-center rounded-lg text-bg-card', thumbVariant(p)]"
            >
              <DashboardIcon name="box" :size="18" />
            </span>
          </button>

          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div class="flex min-w-0 items-center gap-2">
              <div class="min-w-0 flex-1 truncate font-medium tracking-[-0.005em] text-ink">
                {{ p.name }}
              </div>
              <span :class="['tag', statusClass(p.status)]">
                <span class="dt" />{{ statusLabel(p.status) }}
              </span>
            </div>

            <div v-if="p.serialNumber"
              class="truncate font-mono text-[11.5px] tabular-nums text-ink-muted">
              #{{ p.serialNumber }}
            </div>

            <div v-if="p.pieceTypes.length > 0" class="flex flex-wrap gap-1">
              <span v-for="t in p.pieceTypes" :key="t.id" class="type-chip">{{ t.name }}</span>
            </div>

            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted">
              <span v-if="showLocation" class="truncate">
                {{ locationLabel(p.locationId) }}
              </span>
              <span v-if="showLocation && (showOwner || p.updatedAt)" class="text-ink-muted/60">·</span>
              <span v-if="showOwner" class="truncate">
                {{ ownerLabel(p.ownerUserId) }}
              </span>
              <span v-if="showOwner && p.updatedAt" class="text-ink-muted/60">·</span>
              <span>{{ relativeDate(p.updatedAt) }}</span>
            </div>
          </div>

          <button
            v-if="canWrite"
            type="button"
            class="trash-btn-card"
            :aria-label="t('dashboard.pieces.actions.delete')"
            :title="t('dashboard.pieces.actions.delete')"
            @click="(e) => onDelete(e, p)"
          >
            <DashboardIcon name="trash" :size="16" />
          </button>
        </article>
      </template>
    </div>

    <DashboardImageLightbox
      v-model:open="previewOpen"
      :url="previewUrl"
      :name="previewName"
    />
  </div>
</template>

<style scoped>
.th {
  text-align: left;
  font-weight: 500;
  color: var(--c-ink-soft);
  font-size: 12px;
  letter-spacing: .04em;
  text-transform: uppercase;
  padding: 10px 16px;
  background: var(--c-bg-soft);
  border-bottom: 1px solid var(--c-line);
}
@media (min-width: 640px) {
  .th { padding: 10px 20px; }
}
.th-actions { width: 48px; }
.td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--c-line);
  vertical-align: middle;
}
@media (min-width: 640px) {
  .td { padding: 14px 20px; }
}
.td-actions { padding: 12px 10px; width: 48px; }
@media (min-width: 640px) {
  .td-actions { padding: 14px 12px; }
}
.row:last-child .td { border-bottom: 0; }
.row { transition: background .12s; }
.row:hover { background: var(--c-bg-soft); }
.row-interactive { cursor: pointer; }
.row-interactive:focus-visible { outline: 2px solid var(--c-accent); outline-offset: -2px; background: var(--c-bg-soft); }

.piece-thumb-btn {
  /* Reseteo del botón nativo para que la miniatura conserve su aspecto. */
  padding: 0;
  border: 0;
  background: var(--c-bg-soft);
  cursor: pointer;
  display: block;
  transition: box-shadow .15s, transform .15s;
}
.piece-thumb-btn:disabled {
  cursor: default;
}
.piece-thumb-btn:not(:disabled):hover {
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--c-accent) 35%, transparent);
}
.piece-thumb-btn:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

.piece-thumb-wrap {
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 8px;
  overflow: hidden;
}
.piece-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
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
.tag .dt {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}
.tag-ok { background: var(--c-accent-soft); color: var(--c-accent-ink); }
.tag-warn { background: var(--c-warn-soft); color: #8a6324; }

.type-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-line);
  font-size: 11.5px;
  color: var(--c-ink-soft);
  white-space: nowrap;
}

.trash-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--c-ink-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background .12s, border-color .12s, color .12s;
}
.trash-btn:hover {
  background: color-mix(in oklab, var(--c-danger) 8%, transparent);
  border-color: color-mix(in oklab, var(--c-danger) 30%, transparent);
  color: var(--c-danger);
}
.trash-btn:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 1px; }

/* Vista de tarjetas (móvil) */
.piece-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--c-line);
  border-radius: 12px;
  background: var(--c-bg-card);
  transition: background .12s, border-color .12s;
}
.piece-card-skel { align-items: center; }
.piece-card-interactive { cursor: pointer; }
.piece-card-interactive:hover { background: var(--c-bg-soft); }
.piece-card-interactive:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}
.piece-thumb-wrap-card {
  width: 56px;
  height: 56px;
  flex: none;
  border-radius: 10px;
  overflow: hidden;
}
.trash-btn-card {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--c-ink-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background .12s, border-color .12s, color .12s;
}
.trash-btn-card:hover {
  background: color-mix(in oklab, var(--c-danger) 8%, transparent);
  border-color: color-mix(in oklab, var(--c-danger) 30%, transparent);
  color: var(--c-danger);
}
.trash-btn-card:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 1px; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
