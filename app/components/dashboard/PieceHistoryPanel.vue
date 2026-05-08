<script setup lang="ts">
import { FetchError } from 'ofetch'
import type { MemberResponseDto, PieceHistoryAction, PieceHistoryItemDto } from '~/types/api'

const props = defineProps<{
  orgId: number
  pieceId: number
  members: MemberResponseDto[]
}>()

const { t, locale } = useI18n()
const pieces = usePiecesStore()

const errorMsg = ref<string | null>(null)

const dateLocale = computed(() => {
  const l = locale.value as string
  return l === 'ca' ? 'ca-ES' : l === 'en' ? 'en-US' : 'es-ES'
})

const memberById = computed(() => {
  const map = new Map<number, MemberResponseDto>()
  for (const m of props.members) map.set(m.userId, m)
  return map
})

function actorName(id?: number): string {
  if (id == null) return t('dashboard.pieces.history.unknown_actor')
  const m = memberById.value.get(id)
  return m ? `${m.name} ${m.lastName}`.trim() : t('dashboard.pieces.history.removed_actor')
}

function actionLabel(action: PieceHistoryAction): string {
  return t(`dashboard.pieces.history.action.${action}`)
}

const KNOWN_FIELDS = new Set([
  'name', 'serialNumber', 'description', 'owner', 'location',
  'status', 'pieceTypes', 'attachment', 'coverAttachmentId'
])

function fieldLabel(fieldName: string): string {
  if (KNOWN_FIELDS.has(fieldName)) return t(`dashboard.pieces.history.field.${fieldName}`)
  if (fieldName.startsWith('org:')) return fieldName.slice(4)
  return fieldName
}

function statusLabel(value: string): string {
  const key = `dashboard.pieces.history.status.${value}`
  const translated = t(key)
  return translated === key ? value : translated
}

function diffValue(item: PieceHistoryItemDto, side: 'old' | 'new'): string {
  const raw = side === 'old' ? item.oldValue : item.newValue
  if (raw == null || raw === '') return t('dashboard.pieces.history.none')
  if (item.action === 'STATUS_CHANGED') return statusLabel(raw)
  return raw
}

function parseTypeList(value?: string | null): string[] {
  if (!value) return []
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

function typeDiffs(item: PieceHistoryItemDto): { added: string[]; removed: string[] } {
  const oldSet = new Set(parseTypeList(item.oldValue))
  const newSet = new Set(parseTypeList(item.newValue))
  return {
    added: [...newSet].filter(v => !oldSet.has(v)),
    removed: [...oldSet].filter(v => !newSet.has(v))
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(dateLocale.value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof FetchError) {
    const data = e.response?._data as { message?: string; detail?: string } | undefined
    return data?.message ?? data?.detail ?? fallback
  }
  return fallback
}

const currentPage = ref(0)
const pageSize = 20

const historyPage = computed(() => pieces.historyByPiece[props.pieceId] ?? null)
const items = computed<PieceHistoryItemDto[]>(() => historyPage.value?.content ?? [])

async function load(page = currentPage.value) {
  errorMsg.value = null
  try {
    await pieces.fetchHistory(props.orgId, props.pieceId, page, pageSize)
    currentPage.value = page
  } catch (e) {
    errorMsg.value = extractErrorMessage(e, t('dashboard.pieces.errors.load_history'))
  }
}

watch(() => props.pieceId, () => {
  currentPage.value = 0
  void load(0)
}, { immediate: true })

function shortValue(value?: string): string {
  if (value == null || value === '') return '—'
  if (value.length > 80) return `${value.slice(0, 80)}…`
  return value
}

const showingDiff = (item: PieceHistoryItemDto) =>
  item.action === 'PIECE_UPDATED'
  || item.action === 'OWNER_CHANGED'
  || item.action === 'LOCATION_CHANGED'
  || item.action === 'STATUS_CHANGED'
  || item.action === 'ATTRIBUTE_VALUE_CHANGED'

const showingTypeDiff = (item: PieceHistoryItemDto) =>
  item.action === 'PIECE_TYPES_CHANGED'
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="errorMsg" role="alert"
      class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <div v-if="pieces.loadingHistory === pieceId && items.length === 0" class="flex flex-col gap-3">
      <div v-for="i in 4" :key="`hs-${i}`" class="h-[68px] animate-pulse rounded-lg bg-bg-soft" />
    </div>

    <div v-else-if="items.length === 0" class="empty-state">
      {{ t('dashboard.pieces.history.empty') }}
    </div>

    <ol v-else class="timeline">
      <li v-for="item in items" :key="item.id" class="timeline-item">
        <span class="timeline-dot" :class="`tone-${item.action}`" aria-hidden="true" />
        <div class="timeline-card">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-medium text-[13.5px] text-ink">{{ actionLabel(item.action) }}</span>
            <span class="text-[11.5px] text-ink-muted">{{ formatDate(item.createdAt) }}</span>
          </div>
          <div class="text-[12px] text-ink-soft">
            {{ t('dashboard.pieces.history.by_actor', { actor: actorName(item.actorUserId) }) }}
          </div>
          <div v-if="item.fieldName" class="mt-1 text-[12px] text-ink-soft">
            <span class="field-pill">{{ fieldLabel(item.fieldName) }}</span>
          </div>
          <div v-if="showingTypeDiff(item)" class="mt-2 flex flex-col gap-1.5 text-[12.5px]">
            <div v-if="typeDiffs(item).added.length" class="chip-row">
              <span class="diff-label">{{ t('dashboard.pieces.history.added') }}</span>
              <span v-for="t2 in typeDiffs(item).added" :key="`add-${item.id}-${t2}`"
                class="chip chip-add">{{ t2 }}</span>
            </div>
            <div v-if="typeDiffs(item).removed.length" class="chip-row">
              <span class="diff-label">{{ t('dashboard.pieces.history.removed') }}</span>
              <span v-for="t2 in typeDiffs(item).removed" :key="`rem-${item.id}-${t2}`"
                class="chip chip-remove">{{ t2 }}</span>
            </div>
          </div>
          <div v-else-if="showingDiff(item)" class="mt-2 grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-2">
            <div class="diff-block diff-old">
              <span class="diff-label">{{ t('dashboard.pieces.history.before') }}</span>
              <span class="diff-value">{{ shortValue(diffValue(item, 'old')) }}</span>
            </div>
            <div class="diff-block diff-new">
              <span class="diff-label">{{ t('dashboard.pieces.history.after') }}</span>
              <span class="diff-value">{{ shortValue(diffValue(item, 'new')) }}</span>
            </div>
          </div>
          <div v-else-if="item.newValue || item.oldValue" class="mt-2 text-[12.5px] text-ink-soft">
            {{ shortValue(item.newValue || item.oldValue) }}
          </div>
        </div>
      </li>
    </ol>

    <DashboardPagination
      v-if="historyPage && historyPage.totalPages > 1"
      :page="historyPage.number"
      :total-pages="historyPage.totalPages"
      :size="historyPage.size || pageSize"
      :total-elements="historyPage.totalElements"
      :disabled="pieces.loadingHistory === pieceId"
      :size-options="[pageSize]"
      @update:page="load"
      @update:size="() => { /* size fijo */ }"
    />
  </div>
</template>

<style scoped>
.empty-state {
  border: 1px dashed var(--c-line);
  background: var(--c-bg-soft);
  border-radius: 10px;
  padding: 28px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--c-ink-muted);
}

.timeline {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0 0 0 18px;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 6px;
  bottom: 6px;
  width: 1px;
  background: var(--c-line);
}
.timeline-item {
  position: relative;
  padding: 0 0 14px 14px;
}
.timeline-item:last-child { padding-bottom: 0; }
.timeline-dot {
  position: absolute;
  left: -18px;
  top: 16px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--c-bg-card);
  border: 2px solid var(--c-ink-muted);
}
.tone-PIECE_CREATED { border-color: var(--c-accent); }
.tone-PIECE_DELETED { border-color: var(--c-danger); }
.tone-ATTACHMENT_ADDED { border-color: var(--c-accent); }
.tone-ATTACHMENT_REMOVED { border-color: var(--c-danger); }
.tone-STATUS_CHANGED { border-color: var(--c-warn); }

.timeline-card {
  background: var(--c-bg-card);
  border: 1px solid var(--c-line);
  border-radius: 10px;
  padding: 10px 12px;
}

.diff-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 7px;
}
.diff-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--c-ink-muted);
}
.diff-value {
  font-size: 12.5px;
  color: var(--c-ink);
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.diff-old { background: color-mix(in oklab, var(--c-danger) 6%, transparent); }
.diff-new { background: color-mix(in oklab, var(--c-accent) 8%, transparent); }

.field-pill {
  display: inline-block;
  border-radius: 999px;
  padding: 2px 9px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-line);
  font-size: 11px;
  font-weight: 500;
  color: var(--c-ink);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
}
.chip-add {
  background: color-mix(in oklab, var(--c-accent) 12%, transparent);
  border-color: color-mix(in oklab, var(--c-accent) 35%, transparent);
  color: var(--c-ink);
}
.chip-add::before { content: '+'; opacity: .65; }
.chip-remove {
  background: color-mix(in oklab, var(--c-danger) 10%, transparent);
  border-color: color-mix(in oklab, var(--c-danger) 35%, transparent);
  color: var(--c-ink);
  text-decoration: line-through;
  text-decoration-color: color-mix(in oklab, var(--c-danger) 50%, transparent);
}
.chip-remove::before { content: '−'; opacity: .65; text-decoration: none; }
</style>
