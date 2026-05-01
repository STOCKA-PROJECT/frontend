<script setup lang="ts">
import type { PieceTypeResponseDto } from '~/types/api'

const props = defineProps<{
  detail: PieceTypeResponseDto | null
  canWrite: boolean
}>()

const emit = defineEmits<{
  rename: []
  delete: []
  'add-attribute': []
  'edit-attribute': [attrId: number]
  'delete-attribute': [attrId: number]
}>()

const { t, locale } = useI18n()

const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value, {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
}))

function fmtDate(iso: string | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return dateFormatter.value.format(d)
}

const attributesCount = computed(() => props.detail?.attributes.length ?? 0)
</script>

<template>
  <section class="flex h-full flex-col overflow-hidden rounded-[14px] border border-line bg-bg-card">
    <div v-if="!detail" class="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center">
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-bg-soft text-ink-muted">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </div>
      <p class="max-w-[320px] text-[13.5px] text-ink-soft">
        {{ t('dashboard.pieceTypes.detail.empty') }}
      </p>
    </div>

    <template v-else>
      <header class="flex flex-col gap-2 border-b border-line px-6 py-4 max-md:px-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate text-[20px] font-semibold tracking-[-0.015em] text-ink">
              {{ detail.name }}
            </h2>
            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-muted">
              <span>{{ t('dashboard.pieceTypes.detail.created_at', { date: fmtDate(detail.createdAt) }) }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ t('dashboard.pieceTypes.detail.updated_at', { date: fmtDate(detail.updatedAt) }) }}</span>
            </div>
          </div>

          <div v-if="canWrite" class="flex items-center gap-2">
            <button type="button" class="action-btn" @click="emit('rename')">
              {{ t('dashboard.pieceTypes.form.rename_title') }}
            </button>
            <button type="button" class="action-btn action-btn-danger" @click="emit('delete')">
              {{ t('dashboard.pieceTypes.delete.confirm_label') }}
            </button>
          </div>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto px-6 py-4 max-md:px-4">
        <section>
          <div class="mb-3 flex items-center justify-between gap-2">
            <h3 class="text-[11.5px] font-semibold uppercase tracking-[.06em] text-ink-muted">
              {{ t('dashboard.pieceTypes.detail.attributes_title', { n: attributesCount }) }}
            </h3>
            <button v-if="canWrite" type="button" class="action-btn"
              @click="emit('add-attribute')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{{ t('dashboard.pieceTypes.detail.add_attribute') }}</span>
            </button>
          </div>

          <div v-if="!detail.attributes.length"
            class="rounded-[10px] border border-dashed border-line bg-bg-soft px-4 py-8 text-center">
            <p class="text-[13px] text-ink-muted">
              {{ t('dashboard.pieceTypes.detail.empty_attributes') }}
            </p>
          </div>

          <ul v-else class="flex flex-col gap-1.5">
            <li v-for="attr in detail.attributes" :key="attr.id">
              <DashboardPieceTypeAttributeRow :attr="attr" :can-write="canWrite"
                @edit="emit('edit-attribute', attr.id)"
                @delete="emit('delete-attribute', attr.id)" />
            </li>
          </ul>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .12s, border-color .12s, color .12s;
}
.action-btn:hover { background: var(--c-bg-soft); border-color: var(--c-line-strong); }
.action-btn-danger { color: var(--c-danger); border-color: color-mix(in oklab, var(--c-danger) 35%, transparent); }
.action-btn-danger:hover { background: var(--c-danger-soft); }
</style>
