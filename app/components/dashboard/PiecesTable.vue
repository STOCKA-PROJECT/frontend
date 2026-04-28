<script setup lang="ts">
import type { PieceListItemDto } from '~/types/api'

const props = defineProps<{
  pieces: PieceListItemDto[]
  loading?: boolean
}>()

const { t, locale } = useI18n()

const thumbVariant = (id: number) => `t-${(id % 5) + 1}` as const

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
</script>

<template>
  <div class="overflow-x-auto">
    <table v-if="!isEmpty" class="w-full border-collapse text-[13.5px]">
      <thead>
        <tr>
          <th class="th">{{ t('dashboard.pieces_table.col_item') }}</th>
          <th class="th">{{ t('dashboard.pieces_table.col_type') }}</th>
          <th class="th">{{ t('dashboard.pieces_table.col_status') }}</th>
          <th class="th">{{ t('dashboard.pieces_table.col_updated') }}</th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading">
          <tr v-for="i in 4" :key="`s-${i}`">
            <td class="td"><span class="block h-5 w-48 animate-pulse rounded bg-bg-soft" /></td>
            <td class="td"><span class="block h-4 w-24 animate-pulse rounded bg-bg-soft" /></td>
            <td class="td"><span class="block h-5 w-20 animate-pulse rounded bg-bg-soft" /></td>
            <td class="td"><span class="block h-4 w-16 animate-pulse rounded bg-bg-soft" /></td>
          </tr>
        </template>
        <template v-else>
          <tr v-for="p in pieces" :key="p.id" class="row">
            <td class="td">
              <div class="flex min-w-0 items-center gap-3">
                <div :class="['piece-thumb flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-lg text-bg-card', thumbVariant(p.pieceTypeId)]">
                  <DashboardIcon name="box" :size="16" />
                </div>
                <div class="min-w-0">
                  <div class="truncate font-medium tracking-[-0.005em] text-ink">{{ p.name }}</div>
                  <div class="truncate font-mono text-[11.5px] tabular-nums text-ink-muted">#{{ p.id }}</div>
                </div>
              </div>
            </td>
            <td class="td">
              <span class="text-ink-soft">{{ p.pieceTypeName }}</span>
            </td>
            <td class="td">
              <span :class="['tag', statusClass(p.status)]">
                <span class="dt" />{{ statusLabel(p.status) }}
              </span>
            </td>
            <td class="td">
              <span class="text-[12.5px] text-ink-muted">{{ relativeDate(p.updatedAt) }}</span>
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
</template>

<style scoped>
.th {
  text-align: left;
  font-weight: 500;
  color: var(--c-ink-soft);
  font-size: 12px;
  letter-spacing: .04em;
  text-transform: uppercase;
  padding: 10px 20px;
  background: var(--c-bg-soft);
  border-bottom: 1px solid var(--c-line);
}
.td {
  padding: 14px 20px;
  border-bottom: 1px solid var(--c-line);
  vertical-align: middle;
}
.row:last-child .td { border-bottom: 0; }
.row { transition: background .12s; }
.row:hover { background: var(--c-bg-soft); }

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
</style>
