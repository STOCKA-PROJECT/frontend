<script setup lang="ts">
import type {
  AttributeValueInputDto,
  CreatePieceDto,
  LocationResponseDto,
  MemberResponseDto,
  PieceTypeAttributeResponseDto,
  PieceTypeResponseDto
} from '~/types/api'

const props = withDefaults(defineProps<{
  pieceTypes: PieceTypeResponseDto[]
  locations: LocationResponseDto[]
  members: MemberResponseDto[]
  loading?: boolean
  errorMsg?: string | null
  submitLabel?: string
}>(), {
  loading: false,
  errorMsg: null
})

const emit = defineEmits<{
  submit: [payload: CreatePieceDto]
  cancel: []
}>()

const { t } = useI18n()

const name = ref('')
const description = ref('')
const selectedTypeIds = ref<Set<number>>(new Set())
const ownerUserId = ref<number | null>(null)
const locationId = ref<number | null>(null)
const attributeValues = ref<Record<number, string | null>>({})
const localError = ref<string | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)

const sortedPieceTypes = computed(() =>
  [...props.pieceTypes].sort((a, b) => a.name.localeCompare(b.name))
)

interface AttributeGroup {
  typeId: number
  typeName: string
  attributes: PieceTypeAttributeResponseDto[]
}

/** Per-type groups of attributes for the currently selected types. */
const attributeGroups = computed<AttributeGroup[]>(() => {
  return sortedPieceTypes.value
    .filter(pt => selectedTypeIds.value.has(pt.id))
    .map(pt => ({
      typeId: pt.id,
      typeName: pt.name,
      attributes: [...pt.attributes].sort((a, b) => a.position - b.position)
    }))
    .filter(group => group.attributes.length > 0)
})

const validAttributeIds = computed<Set<number>>(() => {
  const ids = new Set<number>()
  for (const g of attributeGroups.value) for (const a of g.attributes) ids.add(a.id)
  return ids
})

watch(selectedTypeIds, () => {
  // Drop any cached values whose attribute is no longer covered by the selected types.
  const valid = validAttributeIds.value
  const next: Record<number, string | null> = {}
  for (const [k, v] of Object.entries(attributeValues.value)) {
    if (valid.has(Number(k))) next[Number(k)] = v
  }
  attributeValues.value = next
}, { deep: true })

onMounted(() => {
  nextTick(() => nameInput.value?.focus())
})

function toggleType(id: number) {
  const next = new Set(selectedTypeIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedTypeIds.value = next
}

function setAttrValue(attrId: number, value: string | null) {
  attributeValues.value = { ...attributeValues.value, [attrId]: value }
}

function submit() {
  localError.value = null
  if (!name.value.trim()) {
    localError.value = t('dashboard.pieces.errors.name_required')
    return
  }
  if (selectedTypeIds.value.size === 0) {
    localError.value = t('dashboard.pieces.errors.type_required')
    return
  }

  const values: AttributeValueInputDto[] = []
  for (const group of attributeGroups.value) {
    for (const attr of group.attributes) {
      const v = attributeValues.value[attr.id]
      if (v != null && v !== '') {
        values.push({ attributeId: attr.id, value: v })
      }
    }
  }

  const payload: CreatePieceDto = {
    name: name.value.trim(),
    pieceTypeIds: [...selectedTypeIds.value]
  }
  if (description.value.trim()) payload.description = description.value.trim()
  if (ownerUserId.value != null) payload.ownerUserId = ownerUserId.value
  if (locationId.value != null) payload.locationId = locationId.value
  if (values.length > 0) payload.attributeValues = values

  emit('submit', payload)
}

const visibleError = computed(() => props.errorMsg ?? localError.value)
const buttonLabel = computed(() => props.submitLabel ?? t('dashboard.pieces.form.submit_create'))
const selectedTypesCount = computed(() => selectedTypeIds.value.size)
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <div v-if="visibleError" role="alert"
      class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ visibleError }}
    </div>

    <div class="flex flex-col gap-1.5">
      <span class="form-label">
        {{ t('dashboard.pieces.form.field_types') }} <span class="text-danger">*</span>
      </span>
      <div v-if="sortedPieceTypes.length === 0" class="text-[13px] text-ink-muted">
        {{ t('dashboard.pieces.form.no_types_yet') }}
      </div>
      <div v-else class="flex flex-wrap gap-2 rounded-lg border border-line bg-field px-3 py-2.5">
        <label
          v-for="pt in sortedPieceTypes"
          :key="pt.id"
          class="type-pill"
          :class="{ 'is-selected': selectedTypeIds.has(pt.id) }"
        >
          <input
            type="checkbox"
            class="sr-only"
            :checked="selectedTypeIds.has(pt.id)"
            :disabled="loading"
            @change="toggleType(pt.id)"
          >
          <span aria-hidden="true" class="type-pill-dot" />
          {{ pt.name }}
        </label>
      </div>
      <div class="text-[12px] text-ink-muted">
        {{ t('dashboard.pieces.form.types_help', { n: selectedTypesCount }) }}
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="piece-name" class="form-label">
        {{ t('dashboard.pieces.form.field_name') }} <span class="text-danger">*</span>
      </label>
      <input
        id="piece-name"
        ref="nameInput"
        v-model="name"
        type="text"
        maxlength="255"
        class="form-input"
        :disabled="loading"
      >
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="piece-description" class="form-label">
        {{ t('dashboard.pieces.form.field_description') }}
      </label>
      <textarea
        id="piece-description"
        v-model="description"
        class="form-input form-textarea"
        rows="3"
        :disabled="loading"
      />
    </div>

    <div class="grid grid-cols-2 gap-3 max-md:grid-cols-1">
      <div class="flex flex-col gap-1.5">
        <label for="piece-location" class="form-label">
          {{ t('dashboard.pieces.form.field_location') }}
        </label>
        <select
          id="piece-location"
          v-model.number="locationId"
          class="form-input"
          :disabled="loading"
        >
          <option :value="null">{{ t('dashboard.pieces.form.unassigned') }}</option>
          <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
        </select>
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="piece-owner" class="form-label">
          {{ t('dashboard.pieces.form.field_owner') }}
        </label>
        <select
          id="piece-owner"
          v-model.number="ownerUserId"
          class="form-input"
          :disabled="loading"
        >
          <option :value="null">{{ t('dashboard.pieces.form.no_owner') }}</option>
          <option v-for="m in members" :key="m.userId" :value="m.userId">
            {{ m.name }} {{ m.lastName }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="attributeGroups.length > 0" class="flex flex-col gap-4 border-t border-line pt-4">
      <div class="text-[12px] font-semibold uppercase tracking-[.05em] text-ink-muted">
        {{ t('dashboard.pieces.form.attributes_section') }}
      </div>
      <section v-for="group in attributeGroups" :key="group.typeId" class="attr-group">
        <h4 class="attr-group-title">{{ group.typeName }}</h4>
        <div class="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <DashboardPieceAttributeField
            v-for="attr in group.attributes"
            :key="attr.id"
            :attribute="attr"
            :model-value="attributeValues[attr.id] ?? null"
            :disabled="loading"
            @update:model-value="(v) => setAttrValue(attr.id, v)"
          />
        </div>
      </section>
    </div>

    <div class="flex items-center justify-end gap-2 border-t border-line pt-4">
      <button type="button" class="form-btn" :disabled="loading" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </button>
      <button
        type="submit"
        class="form-btn form-btn-primary"
        :disabled="loading"
        :aria-busy="loading"
      >
        {{ loading ? t('common.saving') : buttonLabel }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.form-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--c-ink-soft);
  letter-spacing: .02em;
}
.form-input {
  height: 38px;
  padding: 0 12px;
  width: 100%;
  border: 1px solid var(--c-line);
  border-radius: 9px;
  background: var(--c-field);
  color: var(--c-ink);
  font-size: 14px;
  transition: border-color .12s, background .12s;
}
.form-input:focus {
  outline: none;
  border-color: var(--c-accent);
  background: var(--c-bg-card);
}
.form-input:disabled {
  background: var(--c-bg-soft);
  color: var(--c-ink-muted);
}
.form-textarea {
  height: auto;
  min-height: 76px;
  padding: 9px 12px;
  resize: vertical;
}
.form-btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .15s, border-color .15s;
}
.form-btn:hover:not(:disabled) { background: var(--c-bg-soft); }
.form-btn:disabled { opacity: .5; cursor: not-allowed; }
.form-btn-primary {
  background: var(--c-ink);
  color: var(--c-bg-card);
  border-color: var(--c-ink);
}
.form-btn-primary:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-ink) 90%, transparent);
}

.type-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  font-size: 12.5px;
  color: var(--c-ink-soft);
  cursor: pointer;
  user-select: none;
  transition: background .12s, border-color .12s, color .12s;
}
.type-pill:hover { background: var(--c-bg-soft); color: var(--c-ink); }
.type-pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--c-line-strong);
  background: transparent;
  transition: background .12s, border-color .12s;
}
.type-pill.is-selected {
  background: var(--c-ink);
  color: var(--c-bg-card);
  border-color: var(--c-ink);
}
.type-pill.is-selected .type-pill-dot {
  background: var(--c-bg-card);
  border-color: var(--c-bg-card);
}
.type-pill input:focus-visible + .type-pill-dot {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

.attr-group { display: flex; flex-direction: column; gap: 10px; }
.attr-group-title {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 3px 11px;
  border-radius: 999px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-line);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: .02em;
  color: var(--c-ink-soft);
}

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
