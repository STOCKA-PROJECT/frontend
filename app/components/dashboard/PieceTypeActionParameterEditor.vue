<script setup lang="ts">
import type {
  ActionParameterDto,
  AttributeType,
  AttributeValidatorsDto,
  OrganizationRole,
  PieceTypeAttributeResponseDto
} from '~/types/api'
import {
  ATTRIBUTE_TYPES,
  NAME_PATTERN,
  ORG_ROLES,
  VALIDATOR_FIELDS,
  cleanValidators,
  slugifyName,
  type ValidatorKey
} from '~/utils/attributeValidators'

const props = defineProps<{
  modelValue: ActionParameterDto
  index: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ActionParameterDto]
  remove: []
}>()

const { t } = useI18n()

// The editor owns its draft state after mount (the parent keys each row by a stable uid, so this
// component is never remounted while editing). It emits the assembled parameter upward on change;
// the parent does not push values back, avoiding feedback loops.
const displayName = ref(props.modelValue.displayName)
const name = ref(props.modelValue.name)
const nameTouched = ref(Boolean(props.modelValue.name))
const type = ref<AttributeType>(props.modelValue.type)
const required = ref(props.modelValue.required)
const validators = ref<AttributeValidatorsDto>({ ...(props.modelValue.validators ?? {}) })
// Binding mode: static (a fixed value shared by every piece of the type) or dynamic (set per clip
// in the timeline editor). Defaults to static.
const dynamic = ref(props.modelValue.dynamic ?? false)
const staticValue = ref<string | null>(props.modelValue.staticValue ?? null)
// When set, this numeric parameter's value (seconds) is the clip length on the timeline.
const isDuration = ref(props.modelValue.isDuration ?? false)
const newOption = ref('')
const optionError = ref<string | null>(null)

// Only numeric parameters can be the clip duration.
const canBeDuration = computed(() => type.value === 'INTEGER' || type.value === 'DECIMAL')

// A synthetic attribute so the existing typed value field can edit the fixed static value, reusing
// the same per-type controls and validators as piece attributes.
const staticFieldAttribute = computed<PieceTypeAttributeResponseDto>(() => ({
  id: props.index,
  name: name.value || 'valor',
  displayName: (isDuration.value && canBeDuration.value)
    ? t('dashboard.pieceTypes.action_form.static_duration_value')
    : t('dashboard.pieceTypes.action_form.parameter_static_value'),
  type: type.value,
  required: required.value,
  position: props.index,
  validators: validators.value
}))
const staticValueMissing = computed(() =>
  !dynamic.value && required.value && (staticValue.value == null || staticValue.value === ''))

const visibleValidators = computed(() => VALIDATOR_FIELDS[type.value])
const showValidators = computed(() => visibleValidators.value.length > 0)
const nameInvalid = computed(() => name.value.length > 0 && !NAME_PATTERN.test(name.value))
const optionsList = computed<string[]>(() => validators.value.options ?? [])
const optionsRequired = computed(() => type.value === 'SELECT' || type.value === 'MULTI_SELECT')
const eligibleRolesList = computed<OrganizationRole[]>(() => validators.value.eligibleRoles ?? [])

function isVisible(key: ValidatorKey) {
  return visibleValidators.value.includes(key)
}

watch(displayName, (next) => {
  if (nameTouched.value) return
  name.value = slugifyName(next)
})

function onNameInput(e: Event) {
  nameTouched.value = true
  name.value = (e.target as HTMLInputElement).value
}

function onTypeChange(next: AttributeType) {
  if (next === type.value) return
  type.value = next
  validators.value = next === 'MEMBER' ? { eligibleRoles: [...ORG_ROLES] } : {}
  // The previous static value no longer matches the new type's shape.
  staticValue.value = null
  // Only numeric parameters can act as the clip duration.
  if (next !== 'INTEGER' && next !== 'DECIMAL') isDuration.value = false
  optionError.value = null
  newOption.value = ''
}

function setBinding(next: boolean) {
  dynamic.value = next
  if (next) staticValue.value = null
}

function setValidator<K extends ValidatorKey>(key: K, value: AttributeValidatorsDto[K]) {
  validators.value = { ...validators.value, [key]: value }
}

function clearValidator(key: ValidatorKey) {
  const next = { ...validators.value }
  delete next[key]
  validators.value = next
}

function onNumberInput(key: ValidatorKey, raw: string) {
  if (raw === '') {
    clearValidator(key)
  } else {
    const n = Number(raw)
    if (!Number.isNaN(n)) setValidator(key, n as never)
  }
}

function onTextInput(key: ValidatorKey, raw: string) {
  if (raw === '') clearValidator(key)
  else setValidator(key, raw as never)
}

function onBoolInput(key: ValidatorKey, checked: boolean) {
  setValidator(key, checked as never)
}

function addOption() {
  const trimmed = newOption.value.trim()
  if (!trimmed) {
    optionError.value = t('dashboard.pieceTypes.attribute_form.validators.options_empty')
    return
  }
  const exists = optionsList.value.some(o => o.toLowerCase() === trimmed.toLowerCase())
  if (exists) {
    optionError.value = t('dashboard.pieceTypes.attribute_form.validators.options_duplicate')
    return
  }
  setValidator('options', [...optionsList.value, trimmed] as never)
  newOption.value = ''
  optionError.value = null
}

function removeOption(value: string) {
  setValidator('options', optionsList.value.filter(o => o !== value) as never)
}

function onOptionKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addOption()
  }
}

function toggleEligibleRole(role: OrganizationRole, checked: boolean) {
  const current = new Set(eligibleRolesList.value)
  if (checked) current.add(role)
  else current.delete(role)
  setValidator('eligibleRoles', [...current] as never)
}

watch([displayName, name, type, required, validators, dynamic, staticValue, isDuration], () => {
  const cleaned = cleanValidators(validators.value)
  const duration = isDuration.value && canBeDuration.value
  const hasStatic = !dynamic.value && staticValue.value != null && staticValue.value !== ''
  emit('update:modelValue', {
    name: name.value,
    displayName: displayName.value,
    type: type.value,
    required: required.value,
    dynamic: dynamic.value,
    ...(hasStatic ? { staticValue: staticValue.value } : {}),
    ...(duration ? { isDuration: true } : {}),
    ...(cleaned ? { validators: cleaned } : {})
  })
}, { immediate: true })
</script>

<template>
  <div class="param-card flex flex-col gap-3 rounded-[12px] border border-line bg-bg-soft p-3.5">
    <div class="flex items-center justify-between gap-2">
      <span class="text-[11.5px] font-semibold uppercase tracking-[.06em] text-ink-muted">
        {{ t('dashboard.pieceTypes.action_form.parameter_n', { n: index + 1 }) }}
      </span>
      <button type="button" class="param-remove"
        :aria-label="t('dashboard.pieceTypes.action_form.remove_parameter')"
        @click="emit('remove')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.action_form.parameter_display_name') }}</label>
        <input v-model="displayName" type="text" maxlength="160" class="field-input"
          :placeholder="t('dashboard.pieceTypes.action_form.parameter_display_name_placeholder')">
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.action_form.parameter_name') }}</label>
        <input :value="name" type="text" maxlength="80"
          class="field-input field-input-mono" :class="{ 'field-input-error': nameInvalid }"
          :placeholder="t('dashboard.pieceTypes.action_form.parameter_name_placeholder')"
          @input="onNameInput">
        <p v-if="nameInvalid" class="field-error">{{ t('dashboard.pieceTypes.errors.name_pattern') }}</p>
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <label class="field-label">{{ t('dashboard.pieceTypes.action_form.parameter_type') }}</label>
      <DashboardAttributeTypeSelect
        :model-value="type"
        :options="ATTRIBUTE_TYPES"
        @update:model-value="onTypeChange"
      />
    </div>

    <label class="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink">
      <input v-model="required" type="checkbox" class="h-4 w-4 accent-[var(--c-ink)]">
      <span>{{ t('dashboard.pieceTypes.action_form.parameter_required') }}</span>
    </label>

    <!-- Binding: static (fixed for all pieces of the type) vs dynamic (set per clip in the timeline) -->
    <div class="flex flex-col gap-2">
      <label class="field-label">{{ t('dashboard.pieceTypes.action_form.parameter_binding') }}</label>
      <div class="binding-toggle" role="radiogroup">
        <button type="button" class="binding-option" :class="{ 'binding-option-active': !dynamic }"
          role="radio" :aria-checked="!dynamic" @click="setBinding(false)">
          {{ t('dashboard.pieceTypes.action_form.binding_static') }}
        </button>
        <button type="button" class="binding-option" :class="{ 'binding-option-active': dynamic }"
          role="radio" :aria-checked="dynamic" @click="setBinding(true)">
          {{ t('dashboard.pieceTypes.action_form.binding_dynamic') }}
        </button>
      </div>
      <p class="field-help">
        {{ dynamic
          ? t('dashboard.pieceTypes.action_form.binding_dynamic_hint')
          : t('dashboard.pieceTypes.action_form.binding_static_hint') }}
      </p>
    </div>

    <!-- Duration: this numeric parameter's value (seconds) is the clip length on the timeline -->
    <div v-if="canBeDuration" class="flex flex-col gap-1">
      <label class="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink">
        <input v-model="isDuration" type="checkbox" class="h-4 w-4 accent-[var(--c-ink)]">
        <span>{{ t('dashboard.pieceTypes.action_form.parameter_is_duration') }}</span>
      </label>
      <p v-if="isDuration" class="field-help">{{ t('dashboard.pieceTypes.action_form.is_duration_hint') }}</p>
    </div>

    <!-- Static value: the fixed value applied to every piece of this type -->
    <div v-if="!dynamic" class="rounded-[10px] border border-line bg-bg-card p-3">
      <DashboardPieceAttributeField
        :attribute="staticFieldAttribute"
        :model-value="staticValue"
        @update:model-value="staticValue = $event" />
      <p v-if="staticValueMissing" class="field-error mt-1.5">
        {{ t('dashboard.pieceTypes.action_form.static_value_required') }}
      </p>
    </div>

    <div v-if="showValidators" class="flex flex-col gap-3 rounded-[10px] border border-line bg-bg-card p-3">
      <h4 class="text-[11px] font-semibold uppercase tracking-[.06em] text-ink-muted">
        {{ t('dashboard.pieceTypes.attribute_form.validators_title') }}
      </h4>

      <div v-if="isVisible('minLength')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.minLength') }}</label>
        <input type="number" min="0" :value="validators.minLength ?? ''" class="field-input"
          @input="onNumberInput('minLength', ($event.target as HTMLInputElement).value)">
      </div>

      <div v-if="isVisible('maxLength')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.maxLength') }}</label>
        <input type="number" min="0" :value="validators.maxLength ?? ''" class="field-input"
          @input="onNumberInput('maxLength', ($event.target as HTMLInputElement).value)">
      </div>

      <div v-if="isVisible('regex')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.regex') }}</label>
        <input type="text" :value="validators.regex ?? ''" class="field-input field-input-mono"
          @input="onTextInput('regex', ($event.target as HTMLInputElement).value)">
      </div>

      <div v-if="isVisible('min')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.min') }}</label>
        <input type="number" step="any" :value="validators.min ?? ''" class="field-input"
          @input="onNumberInput('min', ($event.target as HTMLInputElement).value)">
      </div>

      <div v-if="isVisible('max')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.max') }}</label>
        <input type="number" step="any" :value="validators.max ?? ''" class="field-input"
          @input="onNumberInput('max', ($event.target as HTMLInputElement).value)">
      </div>

      <div v-if="isVisible('decimals')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.decimals') }}</label>
        <input type="number" min="0" max="10" :value="validators.decimals ?? ''" class="field-input"
          @input="onNumberInput('decimals', ($event.target as HTMLInputElement).value)">
      </div>

      <div v-if="isVisible('currency')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.currency') }}</label>
        <input type="text" maxlength="3" :value="validators.currency ?? ''" placeholder="EUR"
          class="field-input field-input-mono"
          @input="onTextInput('currency', ($event.target as HTMLInputElement).value.toUpperCase())">
      </div>

      <div v-if="isVisible('minDate')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.minDate') }}</label>
        <input :type="type === 'DATETIME' ? 'datetime-local' : 'date'"
          :value="validators.minDate ?? ''" class="field-input"
          @input="onTextInput('minDate', ($event.target as HTMLInputElement).value)">
      </div>

      <div v-if="isVisible('maxDate')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.maxDate') }}</label>
        <input :type="type === 'DATETIME' ? 'datetime-local' : 'date'"
          :value="validators.maxDate ?? ''" class="field-input"
          @input="onTextInput('maxDate', ($event.target as HTMLInputElement).value)">
      </div>

      <label v-if="isVisible('allowFuture')" class="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
        <input type="checkbox" class="h-4 w-4 accent-[var(--c-ink)]"
          :checked="validators.allowFuture ?? true"
          @change="onBoolInput('allowFuture', ($event.target as HTMLInputElement).checked)">
        <span>{{ t('dashboard.pieceTypes.attribute_form.validators.allowFuture') }}</span>
      </label>

      <label v-if="isVisible('allowPast')" class="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
        <input type="checkbox" class="h-4 w-4 accent-[var(--c-ink)]"
          :checked="validators.allowPast ?? true"
          @change="onBoolInput('allowPast', ($event.target as HTMLInputElement).checked)">
        <span>{{ t('dashboard.pieceTypes.attribute_form.validators.allowPast') }}</span>
      </label>

      <div v-if="isVisible('options')" class="flex flex-col gap-2">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.options') }}</label>
        <ul v-if="optionsList.length" class="flex flex-wrap gap-1.5">
          <li v-for="opt in optionsList" :key="opt">
            <span class="option-chip">
              <span class="truncate max-w-[180px]">{{ opt }}</span>
              <button type="button" class="option-chip-remove"
                :aria-label="`${t('common.close')} ${opt}`"
                @click="removeOption(opt)">×</button>
            </span>
          </li>
        </ul>
        <div class="flex items-center gap-2">
          <input v-model="newOption" type="text"
            :placeholder="t('dashboard.pieceTypes.attribute_form.validators.options_placeholder')"
            class="field-input flex-1" @keydown="onOptionKey">
          <button type="button" class="dialog-btn" @click="addOption">
            {{ t('dashboard.pieceTypes.attribute_form.validators.options_add') }}
          </button>
        </div>
        <p v-if="optionError" class="field-error">{{ optionError }}</p>
        <p v-else-if="optionsRequired && optionsList.length === 0" class="field-help">
          {{ t('dashboard.pieceTypes.errors.options_required') }}
        </p>
      </div>

      <div v-if="isVisible('minItems')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.minItems') }}</label>
        <input type="number" min="0" :value="validators.minItems ?? ''" class="field-input"
          @input="onNumberInput('minItems', ($event.target as HTMLInputElement).value)">
      </div>

      <div v-if="isVisible('maxItems')" class="flex flex-col gap-1.5">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.maxItems') }}</label>
        <input type="number" min="0" :value="validators.maxItems ?? ''" class="field-input"
          @input="onNumberInput('maxItems', ($event.target as HTMLInputElement).value)">
      </div>

      <div v-if="isVisible('eligibleRoles')" class="flex flex-col gap-2">
        <label class="field-label">{{ t('dashboard.pieceTypes.attribute_form.validators.eligibleRoles') }}</label>
        <div class="flex flex-wrap gap-2">
          <label v-for="role in ORG_ROLES" :key="role"
            class="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-bg-card px-3 py-1.5 text-[13px]">
            <input type="checkbox" class="h-4 w-4 accent-[var(--c-ink)]"
              :checked="eligibleRolesList.includes(role)"
              @change="toggleEligibleRole(role, ($event.target as HTMLInputElement).checked)">
            <DashboardRoleChip :role="role" />
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field-label { font-size: 12.5px; font-weight: 500; letter-spacing: -0.005em; color: var(--c-ink-soft); }
.field-help { font-size: 11.5px; color: var(--c-ink-muted); }
.field-error { font-size: 11.5px; color: var(--c-danger); }
.field-input {
  height: 38px;
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-field, var(--c-bg-card));
  padding: 0 12px;
  font-size: 14px;
  color: var(--c-ink);
  outline: none;
  transition: border-color .15s, background .15s, box-shadow .15s;
}
.field-input::placeholder { color: var(--c-ink-muted); }
.field-input:hover:not(:disabled) { border-color: var(--c-line-strong); }
.field-input:focus { border-color: var(--c-accent); background: var(--c-bg-field-focus, var(--c-bg-card)); }
.field-input-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; }
.field-input-error { border-color: var(--c-danger); }

.binding-toggle {
  display: inline-flex;
  align-self: flex-start;
  border: 1px solid var(--c-line);
  border-radius: 9px;
  background: var(--c-bg-card);
  padding: 2px;
  gap: 2px;
}
.binding-option {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--c-ink-soft);
  font-size: 13px;
  font-weight: 500;
  padding: 5px 14px;
  border-radius: 7px;
  cursor: pointer;
  transition: background .12s, color .12s;
}
.binding-option:hover:not(.binding-option-active) { color: var(--c-ink); }
.binding-option-active {
  background: var(--c-ink);
  color: var(--c-bg-card);
}

.param-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink-muted);
  transition: background .12s, color .12s, border-color .12s;
}
.param-remove:hover { color: var(--c-danger); border-color: color-mix(in oklab, var(--c-danger) 35%, transparent); background: var(--c-danger-soft); }

.dialog-btn {
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
.dialog-btn:hover:not(:disabled) { background: var(--c-bg-soft); }

.option-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 10px;
  border-radius: 999px;
  background: var(--c-bg-card);
  border: 1px solid var(--c-line);
  color: var(--c-ink);
  font-size: 12.5px;
}
.option-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  color: var(--c-ink-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.option-chip-remove:hover { background: var(--c-bg-soft); color: var(--c-ink); }
</style>
