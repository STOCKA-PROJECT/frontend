<script setup lang="ts">
import type { MemberResponseDto, PieceTypeAttributeResponseDto } from '~/types/api'

const props = withDefaults(defineProps<{
  attribute: PieceTypeAttributeResponseDto
  modelValue: string | null
  members?: MemberResponseDto[]
  disabled?: boolean
}>(), { disabled: false, members: () => [] })

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const { t } = useI18n()

const fieldId = computed(() => `attr-${props.attribute.id}`)

function set(serialized: string | null) {
  emit('update:modelValue', serialized)
}

function onTextInput(e: Event) {
  const v = (e.target as HTMLInputElement | HTMLTextAreaElement).value
  set(v.length === 0 ? null : v)
}

function onNumberInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  set(v.length === 0 ? null : v)
}

function onBooleanChange(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  set(checked ? 'true' : 'false')
}

function onDateInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  set(v.length === 0 ? null : v)
}

function onSelectChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  set(v.length === 0 ? null : v)
}

const booleanChecked = computed(() => props.modelValue === 'true')

const multiSelected = computed<Set<string>>(() => {
  const raw = props.modelValue
  if (!raw) return new Set()
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) return new Set(parsed.map(String))
    } catch { /* fallthrough */ }
  }
  return new Set(trimmed.split(',').map(s => s.trim()).filter(Boolean))
})

function toggleMulti(option: string) {
  const next = new Set(multiSelected.value)
  if (next.has(option)) next.delete(option)
  else next.add(option)
  set(next.size === 0 ? null : JSON.stringify([...next]))
}

const decimalStep = computed(() => {
  const decs = props.attribute.validators?.decimals
  if (decs == null || decs <= 0) return '0.01'
  return (1 / Math.pow(10, decs)).toString()
})

const dateMin = computed(() => props.attribute.validators?.minDate)
const dateMax = computed(() => props.attribute.validators?.maxDate)

const labelSuffix = computed(() => {
  if (props.attribute.required) return ' *'
  return ''
})

const memberUserId = computed<number | null>(() => {
  const raw = props.modelValue
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
})

function onMemberChange(userId: number | null) {
  set(userId == null ? null : String(userId))
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="fieldId" class="attr-label">
      {{ attribute.displayName }}<span class="text-danger">{{ labelSuffix }}</span>
    </label>

    <input
      v-if="attribute.type === 'TEXT'"
      :id="fieldId"
      type="text"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :maxlength="attribute.validators?.maxLength"
      :pattern="attribute.validators?.regex"
      class="attr-input"
      @input="onTextInput"
    >

    <textarea
      v-else-if="attribute.type === 'LONGTEXT'"
      :id="fieldId"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :maxlength="attribute.validators?.maxLength"
      class="attr-input attr-textarea"
      rows="3"
      @input="onTextInput"
    />

    <input
      v-else-if="attribute.type === 'INTEGER'"
      :id="fieldId"
      type="number"
      step="1"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :min="attribute.validators?.min"
      :max="attribute.validators?.max"
      class="attr-input"
      @input="onNumberInput"
    >

    <input
      v-else-if="attribute.type === 'DECIMAL'"
      :id="fieldId"
      type="number"
      :step="decimalStep"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :min="attribute.validators?.min"
      :max="attribute.validators?.max"
      class="attr-input"
      @input="onNumberInput"
    >

    <div v-else-if="attribute.type === 'PRICE'" class="relative">
      <input
        :id="fieldId"
        type="number"
        :step="decimalStep"
        :value="modelValue ?? ''"
        :disabled="disabled"
        :min="attribute.validators?.min"
        :max="attribute.validators?.max"
        class="attr-input pr-14"
        @input="onNumberInput"
      >
      <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] font-medium text-ink-muted">
        {{ attribute.validators?.currency ?? '' }}
      </span>
    </div>

    <input
      v-else-if="attribute.type === 'DATE'"
      :id="fieldId"
      type="date"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :min="dateMin"
      :max="dateMax"
      class="attr-input"
      @input="onDateInput"
    >

    <input
      v-else-if="attribute.type === 'DATETIME'"
      :id="fieldId"
      type="datetime-local"
      :value="modelValue ?? ''"
      :disabled="disabled"
      class="attr-input"
      @input="onDateInput"
    >

    <label v-else-if="attribute.type === 'BOOLEAN'" class="inline-flex items-center gap-2 self-start">
      <input
        :id="fieldId"
        type="checkbox"
        :checked="booleanChecked"
        :disabled="disabled"
        class="h-4 w-4 rounded border-line accent-accent"
        @change="onBooleanChange"
      >
      <span class="text-[13.5px] text-ink-soft">
        {{ booleanChecked ? t('common.yes') : t('common.no') }}
      </span>
    </label>

    <select
      v-else-if="attribute.type === 'SELECT'"
      :id="fieldId"
      :value="modelValue ?? ''"
      :disabled="disabled"
      class="attr-input"
      @change="onSelectChange"
    >
      <option value="">{{ t('dashboard.pieces.attribute.select_placeholder') }}</option>
      <option
        v-for="opt in (attribute.validators?.options ?? [])"
        :key="opt"
        :value="opt"
      >{{ opt }}</option>
    </select>

    <div
      v-else-if="attribute.type === 'MULTI_SELECT'"
      class="flex flex-wrap gap-2 rounded-lg border border-line bg-field px-2.5 py-2"
    >
      <label
        v-for="opt in (attribute.validators?.options ?? [])"
        :key="opt"
        class="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-bg-card px-2 py-1 text-[12.5px] text-ink-soft"
      >
        <input
          type="checkbox"
          :checked="multiSelected.has(opt)"
          :disabled="disabled"
          class="h-3.5 w-3.5 flex-shrink-0 accent-accent"
          @change="toggleMulti(opt)"
        >
        <span class="truncate">{{ opt }}</span>
      </label>
    </div>

    <input
      v-else-if="attribute.type === 'URL'"
      :id="fieldId"
      type="url"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :maxlength="attribute.validators?.maxLength"
      class="attr-input"
      @input="onTextInput"
    >

    <input
      v-else-if="attribute.type === 'EMAIL'"
      :id="fieldId"
      type="email"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :maxlength="attribute.validators?.maxLength"
      class="attr-input"
      @input="onTextInput"
    >

    <DashboardMemberSelect
      v-else-if="attribute.type === 'MEMBER'"
      :input-id="fieldId"
      :model-value="memberUserId"
      :members="members"
      :eligible-roles="attribute.validators?.eligibleRoles"
      :disabled="disabled"
      @update:model-value="onMemberChange"
    />
  </div>
</template>

<style scoped>
.attr-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--c-ink-soft);
  letter-spacing: .02em;
}
.attr-input {
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
.attr-input:focus {
  outline: none;
  border-color: var(--c-accent);
  background: var(--c-bg-card);
}
.attr-input:disabled {
  background: var(--c-bg-soft);
  color: var(--c-ink-muted);
  cursor: not-allowed;
}
.attr-textarea {
  height: auto;
  min-height: 76px;
  padding: 9px 12px;
  resize: vertical;
}
</style>
