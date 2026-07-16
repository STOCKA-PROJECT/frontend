<script setup lang="ts">
import type {
  AttributeScope,
  MemberResponseDto,
  OrganizationPieceAttributeResponseDto,
  PieceAttributeFilter,
  PieceListFilters,
  PieceTypeAttributeResponseDto,
  PieceTypeResponseDto
} from '~/types/api'
import type { MultiSelectOption } from '~/components/dashboard/MultiSelect.vue'

const props = defineProps<{
  filters: PieceListFilters
  pieceTypes: PieceTypeResponseDto[]
  orgAttributes: OrganizationPieceAttributeResponseDto[]
  members: MemberResponseDto[]
  loading?: boolean
}>()

const emit = defineEmits<{
  change: [patch: Partial<PieceListFilters>]
}>()

const { t } = useI18n()

const open = shallowRef(false)
const panelId = useId()

const selectedTypeIds = computed<number[]>(() => props.filters.typeIds ?? [])
const activeAttrs = computed<PieceAttributeFilter[]>(() => props.filters.attrs ?? [])

const typeOptions = computed<MultiSelectOption[]>(() =>
  props.pieceTypes.map(pt => ({ value: pt.id, label: pt.name })))

const selectedTypes = computed<PieceTypeResponseDto[]>(() =>
  props.pieceTypes.filter(pt => selectedTypeIds.value.includes(pt.id)))

const advancedCount = computed(() => selectedTypeIds.value.length + activeAttrs.value.length)

const hasAnyFilterableAttribute = computed(() =>
  props.orgAttributes.length > 0 || selectedTypes.value.some(pt => pt.attributes.length > 0))

function attrValues(scope: AttributeScope, attributeId: number): string[] {
  return activeAttrs.value
    .find(a => a.scope === scope && a.attributeId === attributeId)?.values ?? []
}

function upsertAttr(scope: AttributeScope, attributeId: number, values: string[]): PieceAttributeFilter[] {
  const rest = activeAttrs.value.filter(a => !(a.scope === scope && a.attributeId === attributeId))
  const isEmpty = values.length === 0 || values.every(v => v === '')
  return isEmpty ? rest : [...rest, { scope, attributeId, values }]
}

function onAttrChange(scope: AttributeScope, attributeId: number, values: string[]) {
  emit('change', { attrs: upsertAttr(scope, attributeId, values) })
}

/**
 * Cambio de tipos seleccionados. Los filtros de atributos de tipos que dejan de
 * estar seleccionados se eliminan en el MISMO patch, para que la limpieza sea
 * atómica (una sola petición al servidor).
 */
function onTypesChange(values: Array<string | number>) {
  const typeIds = values.map(Number)
  const visibleTypeAttrIds = new Set(
    props.pieceTypes
      .filter(pt => typeIds.includes(pt.id))
      .flatMap(pt => pt.attributes.map(a => a.id))
  )
  const attrs = activeAttrs.value.filter(a =>
    a.scope === 'ORG' || visibleTypeAttrIds.has(a.attributeId))
  emit('change', { typeIds, attrs })
}

function clearAdvanced() {
  emit('change', { typeIds: [], attrs: [] })
}

// ---- chips de filtros activos ----------------------------------------------

interface FilterChip {
  key: string
  label: string
  remove: () => void
}

function findAttribute(scope: AttributeScope, attributeId: number):
    PieceTypeAttributeResponseDto | OrganizationPieceAttributeResponseDto | undefined {
  if (scope === 'ORG') return props.orgAttributes.find(a => a.id === attributeId)
  return props.pieceTypes.flatMap(pt => pt.attributes).find(a => a.id === attributeId)
}

function summarizeValues(filter: PieceAttributeFilter): string {
  const attribute = findAttribute(filter.scope, filter.attributeId)
  const type = attribute?.type
  if (type && ['INTEGER', 'DECIMAL', 'PRICE', 'DATE', 'DATETIME'].includes(type)) {
    const [min = '', max = ''] = filter.values
    if (min && max) return `${min} – ${max}`
    if (min) return `≥ ${min}`
    return `≤ ${max}`
  }
  if (type === 'BOOLEAN') {
    return filter.values.map(v => (v === 'true' ? t('common.yes') : t('common.no'))).join(', ')
  }
  if (type === 'MEMBER') {
    return filter.values
      .map((v) => {
        const m = props.members.find(mm => String(mm.userId) === v)
        return m ? `${m.name} ${m.lastName}`.trim() : v
      })
      .join(', ')
  }
  return filter.values.filter(v => v !== '').join(', ')
}

const chips = computed<FilterChip[]>(() => {
  const out: FilterChip[] = []
  for (const id of selectedTypeIds.value) {
    const pt = props.pieceTypes.find(p => p.id === id)
    out.push({
      key: `type:${id}`,
      label: pt?.name ?? `#${id}`,
      remove: () => onTypesChange(selectedTypeIds.value.filter(v => v !== id))
    })
  }
  for (const filter of activeAttrs.value) {
    const attribute = findAttribute(filter.scope, filter.attributeId)
    const name = attribute?.displayName ?? `#${filter.attributeId}`
    out.push({
      key: `attr:${filter.scope}:${filter.attributeId}`,
      label: `${name}: ${summarizeValues(filter)}`,
      remove: () => onAttrChange(filter.scope, filter.attributeId, [])
    })
  }
  return out
})
</script>

<template>
  <div class="border-b border-line bg-bg-soft/40">
    <div class="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">
      <button
        type="button"
        class="toggle-btn"
        :aria-expanded="open"
        :aria-controls="panelId"
        @click="open = !open"
      >
        <DashboardIcon name="caret" :size="13" class="caret" :class="{ 'is-open': open }" />
        <span>{{ t('dashboard.pieces.filters.advanced') }}</span>
        <span v-if="advancedCount > 0" class="count-badge">{{ advancedCount }}</span>
      </button>

      <ul v-if="chips.length > 0" class="m-0 flex min-w-0 flex-1 flex-wrap items-center gap-1.5 p-0"
        :aria-label="t('dashboard.pieces.filters.active_filters')">
        <li v-for="chip in chips" :key="chip.key" class="chip">
          <span class="truncate">{{ chip.label }}</span>
          <button
            type="button"
            class="chip-remove"
            :disabled="loading"
            :aria-label="`${t('dashboard.pieces.filters.remove_filter')}: ${chip.label}`"
            @click="chip.remove()"
          >
            <DashboardIcon name="x" :size="11" />
          </button>
        </li>
      </ul>

      <button
        v-if="advancedCount > 0"
        type="button"
        class="clear-advanced-btn"
        :disabled="loading"
        @click="clearAdvanced"
      >
        {{ t('dashboard.pieces.filters.clear_advanced') }}
      </button>
    </div>

    <div v-if="open" :id="panelId" class="flex flex-col gap-4 border-t border-line px-4 pb-4 pt-3 sm:px-5">
      <div class="flex flex-col gap-1 sm:max-w-sm">
        <span :id="`${panelId}-types-label`" class="section-label">
          {{ t('dashboard.pieces.filters.types') }}
        </span>
        <DashboardMultiSelect
          :model-value="selectedTypeIds"
          :options="typeOptions"
          :placeholder="t('dashboard.pieces.filters.types_placeholder')"
          :disabled="loading"
          :aria-labelledby="`${panelId}-types-label`"
          @update:model-value="onTypesChange"
        />
      </div>

      <section v-if="orgAttributes.length > 0" class="flex flex-col gap-2">
        <h4 class="section-label">{{ t('dashboard.pieces.filters.org_attributes') }}</h4>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardAttributeFilterField
            v-for="attribute in orgAttributes"
            :key="`org-${attribute.id}`"
            :attribute="attribute"
            :members="members"
            :model-value="attrValues('ORG', attribute.id)"
            :disabled="loading"
            @update:model-value="onAttrChange('ORG', attribute.id, $event)"
          />
        </div>
      </section>

      <section
        v-for="pieceType in selectedTypes"
        :key="pieceType.id"
        class="flex flex-col gap-2"
      >
        <h4 class="section-label">
          {{ t('dashboard.pieces.filters.type_attributes', { type: pieceType.name }) }}
        </h4>
        <p v-if="pieceType.attributes.length === 0" class="m-0 text-[12.5px] text-ink-muted">
          {{ t('dashboard.pieces.filters.no_attributes') }}
        </p>
        <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardAttributeFilterField
            v-for="attribute in pieceType.attributes"
            :key="`type-${attribute.id}`"
            :attribute="attribute"
            :members="members"
            :model-value="attrValues('TYPE', attribute.id)"
            :disabled="loading"
            @update:model-value="onAttrChange('TYPE', attribute.id, $event)"
          />
        </div>
      </section>

      <p
        v-if="!hasAnyFilterableAttribute && selectedTypes.length === 0"
        class="m-0 text-[12.5px] text-ink-muted"
      >
        {{ t('dashboard.pieces.filters.no_attributes') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink-soft);
  font-size: 12.5px;
  font-weight: 500;
  transition: background .12s, border-color .12s;
}
.toggle-btn:hover { background: var(--c-bg-soft); color: var(--c-ink); }
.caret { transition: transform .15s; transform: rotate(-90deg); }
.caret.is-open { transform: rotate(0deg); }

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--c-accent-soft);
  color: var(--c-accent-ink, var(--c-accent));
  font-size: 11px;
  font-weight: 600;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  height: 26px;
  padding: 0 4px 0 9px;
  border-radius: 13px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink-soft);
  font-size: 12px;
}
.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: var(--c-ink-muted);
  transition: background .12s, color .12s;
}
.chip-remove:hover:not(:disabled) { background: var(--c-bg-soft); color: var(--c-danger, var(--c-ink)); }
.chip-remove:disabled { opacity: .45; cursor: not-allowed; }

.clear-advanced-btn {
  height: 26px;
  padding: 0 9px;
  border-radius: 8px;
  color: var(--c-ink-muted);
  font-size: 12px;
  transition: background .12s, color .12s;
}
.clear-advanced-btn:hover:not(:disabled) { background: var(--c-bg-soft); color: var(--c-ink); }
.clear-advanced-btn:disabled { opacity: .45; cursor: not-allowed; }

.section-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--c-ink-muted);
  letter-spacing: .04em;
  text-transform: uppercase;
  margin: 0;
}
</style>
