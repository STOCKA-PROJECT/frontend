<script setup lang="ts">
import type {
  LocationResponseDto,
  MemberResponseDto,
  PieceListFilters,
  PieceTypeResponseDto
} from '~/types/api'

const props = defineProps<{
  filters: PieceListFilters
  pieceTypes: PieceTypeResponseDto[]
  locations: LocationResponseDto[]
  members: MemberResponseDto[]
  loading?: boolean
}>()

const emit = defineEmits<{
  change: [patch: Partial<PieceListFilters>]
  clear: []
}>()

const { t } = useI18n()

const qLocal = ref(props.filters.q ?? '')
let qTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.filters.q, (next) => {
  if ((next ?? '') !== qLocal.value) qLocal.value = next ?? ''
})

function onQInput(e: Event) {
  qLocal.value = (e.target as HTMLInputElement).value
  if (qTimer) clearTimeout(qTimer)
  qTimer = setTimeout(() => {
    emit('change', { q: qLocal.value })
  }, 350)
}

onBeforeUnmount(() => { if (qTimer) clearTimeout(qTimer) })

function onTypeChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('change', { typeId: v ? Number(v) : undefined })
}
function onLocationChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('change', { locationId: v ? Number(v) : undefined })
}
function onOwnerChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('change', { ownerUserId: v ? Number(v) : undefined })
}
function onStatusChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('change', { status: v ? (v as 'ACTIVE' | 'PENDING') : undefined })
}

const hasAnyFilter = computed(() =>
  Boolean(props.filters.q || props.filters.typeId || props.filters.locationId
    || props.filters.ownerUserId || props.filters.status)
)
</script>

<template>
  <div class="flex flex-wrap items-end gap-3 border-b border-line bg-bg-soft/40 px-5 py-3.5">
    <div class="flex min-w-[220px] flex-1 flex-col gap-1">
      <label for="filter-q" class="filter-label">
        {{ t('dashboard.pieces.filters.search') }}
      </label>
      <div class="relative">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
          <DashboardIcon name="search" :size="14" />
        </span>
        <input
          id="filter-q"
          type="text"
          :value="qLocal"
          :placeholder="t('dashboard.pieces.filters.search_placeholder')"
          :disabled="loading"
          class="filter-input pl-8"
          @input="onQInput"
        >
      </div>
    </div>

    <div class="flex min-w-[150px] flex-col gap-1">
      <label for="filter-type" class="filter-label">{{ t('dashboard.pieces.filters.type') }}</label>
      <select id="filter-type" class="filter-select" :value="filters.typeId ?? ''" :disabled="loading"
        @change="onTypeChange">
        <option value="">{{ t('dashboard.pieces.filters.all') }}</option>
        <option v-for="pt in pieceTypes" :key="pt.id" :value="pt.id">{{ pt.name }}</option>
      </select>
    </div>

    <div class="flex min-w-[160px] flex-col gap-1">
      <label for="filter-location" class="filter-label">{{ t('dashboard.pieces.filters.location') }}</label>
      <select id="filter-location" class="filter-select" :value="filters.locationId ?? ''" :disabled="loading"
        @change="onLocationChange">
        <option value="">{{ t('dashboard.pieces.filters.all') }}</option>
        <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
      </select>
    </div>

    <div class="flex min-w-[160px] flex-col gap-1">
      <label for="filter-owner" class="filter-label">{{ t('dashboard.pieces.filters.owner') }}</label>
      <select id="filter-owner" class="filter-select" :value="filters.ownerUserId ?? ''" :disabled="loading"
        @change="onOwnerChange">
        <option value="">{{ t('dashboard.pieces.filters.all') }}</option>
        <option v-for="m in members" :key="m.userId" :value="m.userId">
          {{ m.name }} {{ m.lastName }}
        </option>
      </select>
    </div>

    <div class="flex min-w-[130px] flex-col gap-1">
      <label for="filter-status" class="filter-label">{{ t('dashboard.pieces.filters.status') }}</label>
      <select id="filter-status" class="filter-select" :value="filters.status ?? ''" :disabled="loading"
        @change="onStatusChange">
        <option value="">{{ t('dashboard.pieces.filters.all') }}</option>
        <option value="ACTIVE">{{ t('dashboard.pieces_table.status_active') }}</option>
        <option value="PENDING">{{ t('dashboard.pieces_table.status_pending') }}</option>
      </select>
    </div>

    <button
      v-if="hasAnyFilter"
      type="button"
      class="clear-btn"
      :disabled="loading"
      @click="emit('clear')"
    >
      {{ t('dashboard.pieces.filters.clear') }}
    </button>
  </div>
</template>

<style scoped>
.filter-label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--c-ink-muted);
  letter-spacing: .03em;
  text-transform: uppercase;
}
.filter-input,
.filter-select {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--c-line);
  border-radius: 8px;
  background: var(--c-field);
  color: var(--c-ink);
  font-size: 13.5px;
  transition: border-color .12s, background .12s;
}
.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--c-accent);
  background: var(--c-bg-card);
}
.filter-input:disabled,
.filter-select:disabled {
  opacity: .55;
  cursor: not-allowed;
}
.clear-btn {
  height: 34px;
  padding: 0 12px;
  align-self: end;
  border: 1px solid var(--c-line);
  border-radius: 8px;
  background: var(--c-bg-card);
  color: var(--c-ink-soft);
  font-size: 12.5px;
  transition: background .12s;
}
.clear-btn:hover:not(:disabled) { background: var(--c-bg-soft); color: var(--c-ink); }
.clear-btn:disabled { opacity: .45; cursor: not-allowed; }
</style>
