<script setup lang="ts">
import type {
  MemberResponseDto,
  OrganizationPieceAttributeResponseDto,
  PieceTypeAttributeResponseDto
} from '~/types/api'
import type { MultiSelectOption } from '~/components/dashboard/MultiSelect.vue'

type FilterableAttribute = PieceTypeAttributeResponseDto | OrganizationPieceAttributeResponseDto

const props = withDefaults(defineProps<{
  attribute: FilterableAttribute
  /** Valores del filtro: lista para selects, `[term]` para texto, `[min, max]` para rangos. */
  modelValue: string[]
  members?: MemberResponseDto[]
  disabled?: boolean
}>(), { members: () => [], disabled: false })

const emit = defineEmits<{
  'update:modelValue': [values: string[]]
}>()

const { t } = useI18n()

const fieldId = useId()

const isRange = computed(() =>
  ['INTEGER', 'DECIMAL', 'PRICE', 'DATE', 'DATETIME'].includes(props.attribute.type))
const isText = computed(() =>
  ['TEXT', 'LONGTEXT', 'URL', 'EMAIL'].includes(props.attribute.type))
const isNumeric = computed(() =>
  ['INTEGER', 'DECIMAL', 'PRICE'].includes(props.attribute.type))

// ---- selects (SELECT / MULTI_SELECT / BOOLEAN / MEMBER) --------------------

const selectOptions = computed<MultiSelectOption[]>(() => {
  if (props.attribute.type === 'BOOLEAN') {
    return [
      { value: 'true', label: t('common.yes') },
      { value: 'false', label: t('common.no') }
    ]
  }
  if (props.attribute.type === 'MEMBER') {
    const roles = props.attribute.validators?.eligibleRoles
    const allow = roles && roles.length > 0 ? new Set(roles) : null
    return props.members
      .filter(m => !allow || allow.has(m.role))
      .map(m => ({ value: String(m.userId), label: `${m.name} ${m.lastName}`.trim() }))
  }
  return (props.attribute.validators?.options ?? []).map(o => ({ value: o, label: o }))
})

function onSelectChange(values: Array<string | number>) {
  emit('update:modelValue', values.map(String))
}

// ---- texto libre (contains, con debounce) ----------------------------------

const textLocal = shallowRef(props.modelValue[0] ?? '')
let textTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.modelValue, (next) => {
  if (isText.value && (next[0] ?? '') !== textLocal.value) textLocal.value = next[0] ?? ''
})

function onTextInput(e: Event) {
  textLocal.value = (e.target as HTMLInputElement).value
  if (textTimer) clearTimeout(textTimer)
  textTimer = setTimeout(() => {
    const v = textLocal.value.trim()
    emit('update:modelValue', v.length === 0 ? [] : [v])
  }, 350)
}

// ---- rangos (numéricos y fechas) -------------------------------------------

const rangeFrom = shallowRef(props.modelValue[0] ?? '')
const rangeTo = shallowRef(props.modelValue[1] ?? '')
let rangeTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.modelValue, (next) => {
  if (!isRange.value) return
  if ((next[0] ?? '') !== rangeFrom.value) rangeFrom.value = next[0] ?? ''
  if ((next[1] ?? '') !== rangeTo.value) rangeTo.value = next[1] ?? ''
})

function emitRange() {
  const from = rangeFrom.value.trim()
  const to = rangeTo.value.trim()
  emit('update:modelValue', from === '' && to === '' ? [] : [from, to])
}

function onRangeInput(bound: 'from' | 'to', e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (bound === 'from') rangeFrom.value = v
  else rangeTo.value = v
  if (rangeTimer) clearTimeout(rangeTimer)
  // Los inputs numéricos disparan por tecleo; agrupamos antes de pedir al servidor.
  rangeTimer = setTimeout(emitRange, isNumeric.value ? 400 : 0)
}

onBeforeUnmount(() => {
  if (textTimer) clearTimeout(textTimer)
  if (rangeTimer) clearTimeout(rangeTimer)
})

const rangeInputType = computed(() => {
  if (props.attribute.type === 'DATE') return 'date'
  if (props.attribute.type === 'DATETIME') return 'datetime-local'
  return 'number'
})

const numericStep = computed(() => {
  if (props.attribute.type === 'INTEGER') return '1'
  const decs = props.attribute.validators?.decimals
  if (decs == null || decs <= 0) return '0.01'
  return (1 / Math.pow(10, decs)).toString()
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <label :for="fieldId" class="filter-attr-label">
      {{ attribute.displayName }}
    </label>

    <DashboardMultiSelect
      v-if="!isRange && !isText"
      :input-id="fieldId"
      :model-value="modelValue"
      :options="selectOptions"
      :placeholder="t('dashboard.pieces.filters.all')"
      :disabled="disabled"
      :searchable="attribute.type !== 'BOOLEAN'"
      @update:model-value="onSelectChange"
    />

    <input
      v-else-if="isText"
      :id="fieldId"
      type="text"
      :value="textLocal"
      :placeholder="t('dashboard.pieces.filters.contains_placeholder')"
      :disabled="disabled"
      class="filter-attr-input"
      @input="onTextInput"
    >

    <div v-else class="flex items-center gap-1.5">
      <input
        :id="fieldId"
        :type="rangeInputType"
        :step="isNumeric ? numericStep : undefined"
        :value="rangeFrom"
        :placeholder="t('dashboard.pieces.filters.from')"
        :aria-label="`${attribute.displayName} — ${t('dashboard.pieces.filters.from')}`"
        :disabled="disabled"
        class="filter-attr-input min-w-0 flex-1"
        @input="onRangeInput('from', $event)"
      >
      <span class="text-[12px] text-ink-muted" aria-hidden="true">–</span>
      <input
        :type="rangeInputType"
        :step="isNumeric ? numericStep : undefined"
        :value="rangeTo"
        :placeholder="t('dashboard.pieces.filters.to')"
        :aria-label="`${attribute.displayName} — ${t('dashboard.pieces.filters.to')}`"
        :disabled="disabled"
        class="filter-attr-input min-w-0 flex-1"
        @input="onRangeInput('to', $event)"
      >
    </div>
  </div>
</template>

<style scoped>
.filter-attr-label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--c-ink-muted);
  letter-spacing: .03em;
  text-transform: uppercase;
}
.filter-attr-input {
  height: 38px;
  padding: 0 10px;
  width: 100%;
  border: 1px solid var(--c-line);
  border-radius: 9px;
  background: var(--c-field);
  color: var(--c-ink);
  font-size: 13.5px;
  transition: border-color .12s, background .12s;
}
.filter-attr-input:focus {
  outline: none;
  border-color: var(--c-accent);
  background: var(--c-bg-card);
}
.filter-attr-input:disabled {
  opacity: .55;
  cursor: not-allowed;
}
</style>
