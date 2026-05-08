<script setup lang="ts">
import type { PieceTypeResponseDto } from '~/types/api'

defineProps<{
  types: PieceTypeResponseDto[]
  loading: boolean
  selectedId: number | null
  canWrite: boolean
}>()

const emit = defineEmits<{
  select: [id: number]
  create: []
  rename: [id: number]
  delete: [id: number]
}>()

const { t } = useI18n()
</script>

<template>
  <section class="flex h-full flex-col overflow-hidden rounded-[14px] border border-line bg-bg-card">
    <header class="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
      <h2 class="text-[13px] font-semibold tracking-[-0.005em] text-ink">
        {{ t('dashboard.pieceTypes.list.header') }}
      </h2>
      <button v-if="canWrite" type="button" class="header-btn" @click="emit('create')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>{{ t('dashboard.pieceTypes.list.new') }}</span>
      </button>
    </header>

    <div v-if="loading && types.length === 0" class="flex flex-col gap-1.5 p-3">
      <div v-for="i in 4" :key="`s-${i}`"
        class="h-[44px] animate-pulse rounded-[10px] border border-line bg-bg-soft" />
    </div>

    <div v-else-if="types.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p class="max-w-[240px] text-[13px] text-ink-muted">
        {{ t('dashboard.pieceTypes.list.empty') }}
      </p>
      <button v-if="canWrite" type="button" class="header-btn" @click="emit('create')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>{{ t('dashboard.pieceTypes.list.new') }}</span>
      </button>
    </div>

    <ul v-else class="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
      <li v-for="t_ in types" :key="t_.id" class="group relative">
        <button type="button"
          class="type-row"
          :class="{ 'is-active': selectedId === t_.id }"
          @click="emit('select', t_.id)">
          <span class="truncate font-medium">{{ t_.name }}</span>
          <span class="ml-auto count-chip">
            {{ t('dashboard.pieceTypes.list.attribute_count', { n: t_.attributes.length }) }}
          </span>
        </button>

        <div v-if="canWrite"
          class="row-actions absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 group-hover:flex group-focus-within:flex">
          <button type="button" class="row-btn"
            :aria-label="t('dashboard.pieceTypes.form.rename_title')"
            @click.stop="emit('rename', t_.id)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
            </svg>
          </button>
          <button type="button" class="row-btn row-btn-danger"
            :aria-label="t('dashboard.pieceTypes.delete.confirm_title')"
            @click.stop="emit('delete', t_.id)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.header-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .12s, border-color .12s;
}
.header-btn:hover { background: var(--c-bg-soft); border-color: var(--c-line-strong); }

.type-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--c-ink);
  font-size: 13.5px;
  text-align: left;
  transition: background .1s, border-color .1s, color .1s;
}
.type-row:hover { background: var(--c-bg-soft); }
.type-row.is-active {
  background: var(--c-ink);
  color: var(--c-bg-card);
}
.type-row.is-active .count-chip {
  background: color-mix(in oklab, var(--c-bg-card) 18%, transparent);
  color: var(--c-bg-card);
}

.count-chip {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--c-bg-soft);
  color: var(--c-ink-muted);
  font-size: 11px;
  font-weight: 500;
}

.row-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink-muted);
  transition: background .12s, color .12s, border-color .12s;
}
.row-btn:hover { background: var(--c-bg-soft); color: var(--c-ink); border-color: var(--c-line-strong); }
.row-btn-danger:hover {
  color: var(--c-danger);
  border-color: color-mix(in oklab, var(--c-danger) 35%, transparent);
  background: var(--c-danger-soft);
}

/* Touch devices never trigger :hover, so row actions must be permanently visible. */
@media (hover: none) and (pointer: coarse) {
  .row-actions { display: flex !important; }
}
</style>
