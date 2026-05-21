<script setup lang="ts">
import type {
  AttributeType,
  AttributeValidatorsDto,
  CreatePieceTypeAttributeDto,
  OrganizationRole,
  PieceTypeAttributeResponseDto,
  UpdatePieceTypeAttributeDto
} from '~/types/api'

const props = withDefaults(defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  typeName: string
  initial?: PieceTypeAttributeResponseDto | null
  loading?: boolean
  errorMsg?: string | null
}>(), {
  loading: false,
  errorMsg: null,
  initial: null
})

const emit = defineEmits<{
  submit: [payload: CreatePieceTypeAttributeDto | UpdatePieceTypeAttributeDto]
  close: []
}>()

const { t } = useI18n()

const ATTRIBUTE_TYPES: AttributeType[] = [
  'TEXT', 'LONGTEXT', 'INTEGER', 'DECIMAL', 'PRICE',
  'DATE', 'DATETIME', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'URL', 'EMAIL', 'MEMBER'
]

const ORG_ROLES: OrganizationRole[] = ['OWNER', 'MANAGER', 'USER', 'SPECTATOR']

type ValidatorKey = keyof AttributeValidatorsDto

const VALIDATOR_FIELDS: Record<AttributeType, ValidatorKey[]> = {
  TEXT:        ['minLength', 'maxLength', 'regex'],
  LONGTEXT:    ['minLength', 'maxLength'],
  INTEGER:     ['min', 'max'],
  DECIMAL:     ['min', 'max', 'decimals'],
  PRICE:       ['min', 'max', 'decimals', 'currency'],
  DATE:        ['minDate', 'maxDate', 'allowFuture', 'allowPast'],
  DATETIME:    ['minDate', 'maxDate', 'allowFuture', 'allowPast'],
  BOOLEAN:     [],
  SELECT:      ['options'],
  MULTI_SELECT: ['options', 'minItems', 'maxItems'],
  URL:         ['maxLength'],
  EMAIL:       ['maxLength'],
  MEMBER:      ['eligibleRoles']
}

const NAME_PATTERN = /^[a-z][a-z0-9_]{0,79}$/

const displayName = ref('')
const name = ref('')
const nameTouched = ref(false)
const type = ref<AttributeType>('TEXT')
const required = ref(true)
const validators = ref<AttributeValidatorsDto>({})
const newOption = ref('')
const optionError = ref<string | null>(null)

const displayNameInput = ref<HTMLInputElement | null>(null)

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return /^[a-z]/.test(base) ? base : (base ? `a_${base}`.slice(0, 80) : '')
}

function resetState() {
  if (props.mode === 'edit' && props.initial) {
    displayName.value = props.initial.displayName
    name.value = props.initial.name
    type.value = props.initial.type
    required.value = props.initial.required
    validators.value = { ...(props.initial.validators ?? {}) }
  } else {
    displayName.value = ''
    name.value = ''
    type.value = 'TEXT'
    required.value = true
    validators.value = {}
  }
  nameTouched.value = false
  newOption.value = ''
  optionError.value = null
}

watch(() => props.open, (open) => {
  if (open) {
    resetState()
    nextTick(() => displayNameInput.value?.focus())
  }
})

onMounted(() => {
  if (props.open) {
    resetState()
    nextTick(() => displayNameInput.value?.focus())
  }
})

watch(displayName, (next) => {
  if (props.mode !== 'create') return
  if (nameTouched.value) return
  name.value = slugify(next)
})

function onTypeChange(next: AttributeType) {
  if (next === type.value) return
  type.value = next
  validators.value = next === 'MEMBER' ? { eligibleRoles: [...ORG_ROLES] } : {}
  optionError.value = null
  newOption.value = ''
}

const visibleValidators = computed(() => VALIDATOR_FIELDS[type.value])

const title = computed(() => props.mode === 'edit'
  ? t('dashboard.pieceTypes.attribute_form.edit_title', { name: props.initial?.displayName ?? '' })
  : t('dashboard.pieceTypes.attribute_form.new_title', { type: props.typeName }))

const submitLabel = computed(() => props.mode === 'edit'
  ? t('dashboard.pieceTypes.attribute_form.save')
  : t('dashboard.pieceTypes.attribute_form.create'))

const nameInvalid = computed(() => {
  return name.value.length > 0 && !NAME_PATTERN.test(name.value)
})

const optionsList = computed<string[]>(() => validators.value.options ?? [])

const optionsRequired = computed(() => type.value === 'SELECT' || type.value === 'MULTI_SELECT')

const eligibleRolesList = computed<OrganizationRole[]>(() => validators.value.eligibleRoles ?? [])

const canSubmit = computed(() => {
  if (props.loading) return false
  if (!displayName.value.trim()) return false
  if (!NAME_PATTERN.test(name.value)) return false
  if (optionsRequired.value && optionsList.value.length === 0) return false
  if (type.value === 'MEMBER' && eligibleRolesList.value.length === 0) return false
  return true
})

function toggleEligibleRole(role: OrganizationRole, checked: boolean) {
  const current = new Set(eligibleRolesList.value)
  if (checked) current.add(role)
  else current.delete(role)
  setValidator('eligibleRoles', [...current] as never)
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
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

function cleanValidators(input: AttributeValidatorsDto): AttributeValidatorsDto | undefined {
  const out: AttributeValidatorsDto = {}
  let any = false
  for (const k of Object.keys(input) as ValidatorKey[]) {
    const v = input[k]
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v.trim() === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    ;(out as Record<string, unknown>)[k] = v
    any = true
  }
  return any ? out : undefined
}

function onNameInput(e: Event) {
  nameTouched.value = true
  name.value = (e.target as HTMLInputElement).value
}

function submit() {
  if (!canSubmit.value) return

  const cleaned = cleanValidators(validators.value)

  if (props.mode === 'create') {
    const payload: CreatePieceTypeAttributeDto = {
      name: name.value,
      displayName: displayName.value.trim(),
      type: type.value,
      required: required.value,
      ...(cleaned ? { validators: cleaned } : {})
    }
    emit('submit', payload)
  } else {
    const payload: UpdatePieceTypeAttributeDto = {
      displayName: displayName.value.trim(),
      required: required.value,
      validators: cleaned ?? {}
    }
    if (name.value !== props.initial?.name) payload.name = name.value
    if (type.value !== props.initial?.type) payload.type = type.value
    emit('submit', payload)
  }
}

const showValidators = computed(() => visibleValidators.value.length > 0)

function isVisible(key: ValidatorKey) {
  return visibleValidators.value.includes(key)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation"
      @click="onBackdropClick" @keydown="onKey">
      <div role="dialog" aria-modal="true" :aria-label="title"
        class="dialog-card flex max-h-[calc(100vh-24px)] w-full max-w-[560px] flex-col rounded-[14px] border border-line bg-bg-card shadow-card">
        <h2 class="border-b border-line px-6 py-4 text-[17px] font-semibold tracking-[-0.015em] text-ink">
          {{ title }}
        </h2>

        <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="submit">
          <div class="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-5">
            <div v-if="errorMsg" role="alert"
              class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {{ errorMsg }}
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="attr-display-name" class="field-label">
                {{ t('dashboard.pieceTypes.attribute_form.field_display_name') }}
              </label>
              <input id="attr-display-name" ref="displayNameInput" v-model="displayName"
                type="text" required maxlength="160"
                :placeholder="t('dashboard.pieceTypes.attribute_form.field_display_name_placeholder')"
                class="field-input">
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="attr-name" class="field-label">
                {{ t('dashboard.pieceTypes.attribute_form.field_name') }}
              </label>
              <input id="attr-name" :value="name" type="text" required maxlength="80"
                :placeholder="t('dashboard.pieceTypes.attribute_form.field_name_placeholder')"
                class="field-input field-input-mono" :class="{ 'field-input-error': nameInvalid }"
                @input="onNameInput">
              <p v-if="nameInvalid" class="field-error">
                {{ t('dashboard.pieceTypes.errors.name_pattern') }}
              </p>
              <p v-else class="field-help">
                {{ mode === 'edit'
                  ? t('dashboard.pieceTypes.attribute_form.field_name_edit_help')
                  : t('dashboard.pieceTypes.attribute_form.field_name_help') }}
              </p>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="attr-type" class="field-label">
                {{ t('dashboard.pieceTypes.attribute_form.field_type') }}
              </label>
              <DashboardAttributeTypeSelect
                :model-value="type"
                :options="ATTRIBUTE_TYPES"
                @update:model-value="onTypeChange"
              />
              <p v-if="mode === 'edit'" class="field-help">
                {{ t('dashboard.pieceTypes.attribute_form.field_type_edit_help') }}
              </p>
            </div>

            <label class="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink">
              <input v-model="required" type="checkbox" class="h-4 w-4 accent-[var(--c-ink)]">
              <span>{{ t('dashboard.pieceTypes.attribute_form.field_required') }}</span>
            </label>

            <div v-if="showValidators" class="mt-1 flex flex-col gap-3 rounded-[12px] border border-line bg-bg-soft p-4">
              <h3 class="text-[11.5px] font-semibold uppercase tracking-[.06em] text-ink-muted">
                {{ t('dashboard.pieceTypes.attribute_form.validators_title') }}
              </h3>

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
                <input type="text" maxlength="3" :value="validators.currency ?? ''" class="field-input field-input-mono"
                  placeholder="EUR"
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
                  <label
                    v-for="role in ORG_ROLES"
                    :key="role"
                    class="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-bg-card px-3 py-1.5 text-[13px]"
                  >
                    <input
                      type="checkbox"
                      class="h-4 w-4 accent-[var(--c-ink)]"
                      :checked="eligibleRolesList.includes(role)"
                      @change="toggleEligibleRole(role, ($event.target as HTMLInputElement).checked)"
                    >
                    <DashboardRoleChip :role="role" />
                  </label>
                </div>
                <p v-if="eligibleRolesList.length === 0" class="field-error">
                  {{ t('dashboard.pieceTypes.errors.eligibleRoles_required') }}
                </p>
                <p v-else class="field-help">
                  {{ t('dashboard.pieceTypes.attribute_form.validators.eligibleRoles_help') }}
                </p>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
            <button type="button" class="dialog-btn" :disabled="loading" @click="emit('close')">
              {{ t('common.close') }}
            </button>
            <button type="submit" class="dialog-btn dialog-btn-primary"
              :disabled="!canSubmit" :aria-busy="loading">
              {{ submitLabel }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--c-ink) 30%, transparent);
  backdrop-filter: blur(2px);
  padding: 12px;
}
.dialog-card { box-shadow: 0 18px 40px -12px color-mix(in oklab, var(--c-ink) 35%, transparent); }

.field-label {
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: var(--c-ink-soft);
}
.field-help { font-size: 11.5px; color: var(--c-ink-muted); }
.field-error { font-size: 11.5px; color: var(--c-danger); }
.field-input {
  height: 40px;
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-field, var(--c-bg-soft));
  padding: 0 12px;
  font-size: 14px;
  color: var(--c-ink);
  outline: none;
  transition: border-color .15s, background .15s, box-shadow .15s;
}
.field-input::placeholder { color: var(--c-ink-muted); }
.field-input:hover:not(:disabled) { border-color: var(--c-line-strong); }
.field-input:focus { border-color: var(--c-accent); background: var(--c-bg-field-focus, var(--c-bg-card)); }
.field-input:disabled { opacity: .6; cursor: not-allowed; }
.field-input-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; }
.field-input-error { border-color: var(--c-danger); }

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
.dialog-btn:disabled { opacity: .5; cursor: not-allowed; }
.dialog-btn-primary {
  background: var(--c-ink);
  color: var(--c-bg-card);
  border-color: var(--c-ink);
}
.dialog-btn-primary:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-ink) 90%, transparent);
}

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
