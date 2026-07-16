<script setup lang="ts">
import type {
  ContactResponseDto,
  LocationResponseDto,
  MemberResponseDto,
  PieceListFilters,
  PieceTypeResponseDto
} from '~/types/api'

const props = withDefaults(defineProps<{
  filters: PieceListFilters
  pieceTypes: PieceTypeResponseDto[]
  locations: LocationResponseDto[]
  members: MemberResponseDto[]
  contacts?: ContactResponseDto[]
  loading?: boolean
}>(), { contacts: () => [] })

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
// El propietario es un único filtro con dos directorios: los <option> llevan
// el id prefijado ("u:<userId>" miembro / "c:<contactId>" contacto) y el patch
// deja siempre a undefined el directorio contrario.
function onOwnerChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (!v) {
    emit('change', { ownerUserId: undefined, ownerContactId: undefined })
  } else if (v.startsWith('c:')) {
    emit('change', { ownerUserId: undefined, ownerContactId: Number(v.slice(2)) })
  } else {
    emit('change', { ownerUserId: Number(v.slice(2)), ownerContactId: undefined })
  }
}

const ownerFilterValue = computed(() => {
  if (props.filters.ownerUserId != null) return `u:${props.filters.ownerUserId}`
  if (props.filters.ownerContactId != null) return `c:${props.filters.ownerContactId}`
  return ''
})
function onStatusChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('change', { status: v ? (v as 'ACTIVE' | 'PENDING') : undefined })
}

const hasAnyFilter = computed(() =>
  Boolean(props.filters.q || props.filters.typeId || props.filters.locationId
    || props.filters.ownerUserId || props.filters.ownerContactId || props.filters.status)
)
</script>

<template>
  <div class="grid grid-cols-1 items-end gap-2.5 border-b border-line bg-bg-soft/40 px-4 py-3.5 sm:grid-cols-2 sm:px-5 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] lg:gap-3">
    <div class="flex flex-col gap-1">
      <label for="filter-q" class="filter-label">
        {{ t('dashboard.pieces.filters.search') }}
      </label>
      <input
        id="filter-q"
        type="text"
        :value="qLocal"
        :placeholder="t('dashboard.pieces.filters.search_placeholder')"
        class="filter-input w-full"
        @input="onQInput"
      >
    </div>

    <div class="flex flex-col gap-1">
      <label for="filter-type" class="filter-label">{{ t('dashboard.pieces.filters.type') }}</label>
      <select id="filter-type" class="filter-select w-full" :value="filters.typeId ?? ''" :disabled="loading"
        @change="onTypeChange">
        <option value="">{{ t('dashboard.pieces.filters.all') }}</option>
        <option v-for="pt in pieceTypes" :key="pt.id" :value="pt.id">{{ pt.name }}</option>
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <label for="filter-location" class="filter-label">{{ t('dashboard.pieces.filters.location') }}</label>
      <select id="filter-location" class="filter-select w-full" :value="filters.locationId ?? ''" :disabled="loading"
        @change="onLocationChange">
        <option value="">{{ t('dashboard.pieces.filters.all') }}</option>
        <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <label for="filter-owner" class="filter-label">{{ t('dashboard.pieces.filters.owner') }}</label>
      <select id="filter-owner" class="filter-select w-full" :value="ownerFilterValue" :disabled="loading"
        @change="onOwnerChange">
        <option value="">{{ t('dashboard.pieces.filters.all') }}</option>
        <optgroup :label="t('dashboard.pieces.form.owner_group_members')">
          <option v-for="m in members" :key="`u-${m.userId}`" :value="`u:${m.userId}`">
            {{ m.name }} {{ m.lastName }}
          </option>
        </optgroup>
        <optgroup v-if="contacts.length > 0" :label="t('dashboard.pieces.form.owner_group_contacts')">
          <option v-for="c in contacts" :key="`c-${c.id}`" :value="`c:${c.id}`">
            {{ c.name }} {{ c.lastName ?? '' }}
          </option>
        </optgroup>
      </select>
    </div>

    <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
      <label for="filter-status" class="filter-label">{{ t('dashboard.pieces.filters.status') }}</label>
      <select id="filter-status" class="filter-select w-full" :value="filters.status ?? ''" :disabled="loading"
        @change="onStatusChange">
        <option value="">{{ t('dashboard.pieces.filters.all') }}</option>
        <option value="ACTIVE">{{ t('dashboard.pieces_table.status_active') }}</option>
        <option value="PENDING">{{ t('dashboard.pieces_table.status_pending') }}</option>
      </select>
    </div>

    <button
      v-if="hasAnyFilter"
      type="button"
      class="clear-btn sm:col-span-2 lg:col-span-1"
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
  height: 40px;
  padding: 0 10px;
  border: 1px solid var(--c-line);
  border-radius: 8px;
  background: var(--c-field);
  color: var(--c-ink);
  font-size: 14px;
  transition: border-color .12s, background .12s;
}
@media (min-width: 960px) {
  .filter-input,
  .filter-select {
    height: 36px;
    font-size: 13.5px;
  }
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
  height: 40px;
  padding: 0 12px;
  align-self: end;
  border: 1px solid var(--c-line);
  border-radius: 8px;
  background: var(--c-bg-card);
  color: var(--c-ink-soft);
  font-size: 13px;
  transition: background .12s;
}
@media (min-width: 960px) {
  .clear-btn {
    height: 36px;
    font-size: 12.5px;
  }
}
.clear-btn:hover:not(:disabled) { background: var(--c-bg-soft); color: var(--c-ink); }
.clear-btn:disabled { opacity: .45; cursor: not-allowed; }
</style>
