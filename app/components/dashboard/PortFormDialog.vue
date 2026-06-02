<script setup lang="ts">
import type {
  ActionParameterDto,
  CreatePortDto,
  PortResponseDto,
  UpdatePortDto
} from '~/types/api'
import { NAME_PATTERN } from '~/utils/attributeValidators'

const props = withDefaults(defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  pieceTypes: { id: number; name: string }[]
  initial?: PortResponseDto | null
  loading?: boolean
  errorMsg?: string | null
}>(), {
  loading: false,
  errorMsg: null,
  initial: null
})

const emit = defineEmits<{
  submit: [payload: CreatePortDto | UpdatePortDto]
  close: []
}>()

const { t } = useI18n()

type ParamDraft = { uid: number, value: ActionParameterDto }

const name = ref('')
const pieceTypeId = ref<number | null>(null)
const pin = ref<number | null>(null)
const params = ref<ParamDraft[]>([])

let uidCounter = 0
const nameInput = ref<HTMLInputElement | null>(null)

function newParamDraft(value?: ActionParameterDto): ParamDraft {
  return {
    uid: uidCounter++,
    value: value ?? { name: '', displayName: '', type: 'INTEGER', required: true }
  }
}

function resetState() {
  if (props.mode === 'edit' && props.initial) {
    name.value = props.initial.name
    pieceTypeId.value = props.initial.pieceTypeId
    pin.value = props.initial.pin
    params.value = props.initial.parameters.map(p => newParamDraft({ ...p }))
  } else {
    name.value = ''
    pieceTypeId.value = null
    pin.value = null
    params.value = []
  }
}

watch(() => props.open, (open) => {
  if (open) {
    resetState()
    nextTick(() => nameInput.value?.focus())
  }
})

onMounted(() => {
  if (props.open) {
    resetState()
    nextTick(() => nameInput.value?.focus())
  }
})

function onPinInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  pin.value = raw === '' ? null : Number(raw)
}

function addParameter() {
  params.value = [...params.value, newParamDraft()]
}

function removeParameter(uid: number) {
  params.value = params.value.filter(d => d.uid !== uid)
}

function onParamUpdate(uid: number, value: ActionParameterDto) {
  params.value = params.value.map(d => (d.uid === uid ? { ...d, value } : d))
}

const pinValid = computed(() =>
  pin.value !== null && Number.isInteger(pin.value) && pin.value >= 0
)

const paramsValid = computed(() => {
  const seen = new Set<string>()
  for (const d of params.value) {
    const p = d.value
    if (!NAME_PATTERN.test(p.name)) return false
    if (seen.has(p.name)) return false
    seen.add(p.name)
    if ((p.type === 'SELECT' || p.type === 'MULTI_SELECT') && !(p.validators?.options?.length)) return false
    if (p.type === 'MEMBER' && !(p.validators?.eligibleRoles?.length)) return false
  }
  return true
})

const canSubmit = computed(() => {
  if (props.loading) return false
  if (!name.value.trim()) return false
  if (pieceTypeId.value === null) return false
  if (!pinValid.value) return false
  return paramsValid.value
})

const title = computed(() => props.mode === 'edit'
  ? t('dashboard.ports.form.edit_title', { name: props.initial?.name ?? '' })
  : t('dashboard.ports.form.new_title'))

const submitLabel = computed(() => props.mode === 'edit'
  ? t('dashboard.ports.form.save')
  : t('dashboard.ports.form.create'))

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function buildParameters(): ActionParameterDto[] {
  return params.value.map((d, i) => ({ ...d.value, position: i }))
}

function submit() {
  if (!canSubmit.value) return
  const payload: CreatePortDto = {
    name: name.value.trim(),
    pieceTypeId: pieceTypeId.value as number,
    pin: pin.value as number,
    parameters: buildParameters()
  }
  // Both create and edit send the full set of fields; on edit the backend treats them as the new
  // values (and replaces the parameter list), so no diffing is required here.
  emit('submit', payload)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation"
      @click="onBackdropClick" @keydown="onKey">
      <div role="dialog" aria-modal="true" :aria-label="title"
        class="dialog-card flex max-h-[calc(100vh-24px)] w-full max-w-[600px] flex-col rounded-[14px] border border-line bg-bg-card shadow-card">
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
              <label for="port-name" class="field-label">
                {{ t('dashboard.ports.form.field_name') }}
              </label>
              <input id="port-name" ref="nameInput" v-model="name" type="text" required maxlength="160"
                :placeholder="t('dashboard.ports.form.field_name_placeholder')"
                class="field-input">
            </div>

            <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label for="port-type" class="field-label">
                  {{ t('dashboard.ports.form.field_type') }}
                </label>
                <select id="port-type" v-model="pieceTypeId" class="field-input" :disabled="!pieceTypes.length">
                  <option :value="null" disabled>{{ t('dashboard.ports.form.field_type_placeholder') }}</option>
                  <option v-for="pt in pieceTypes" :key="pt.id" :value="pt.id">{{ pt.name }}</option>
                </select>
                <p v-if="!pieceTypes.length" class="field-help">
                  {{ t('dashboard.ports.form.field_type_empty') }}
                </p>
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="port-pin" class="field-label">
                  {{ t('dashboard.ports.form.field_pin') }}
                </label>
                <input id="port-pin" :value="pin ?? ''" type="number" min="0" step="1" required
                  :placeholder="t('dashboard.ports.form.field_pin_placeholder')"
                  class="field-input" @input="onPinInput">
                <p class="field-help">{{ t('dashboard.ports.form.field_pin_help') }}</p>
              </div>
            </div>

            <div class="mt-1 flex flex-col gap-3">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-[11.5px] font-semibold uppercase tracking-[.06em] text-ink-muted">
                  {{ t('dashboard.ports.form.parameters_title', { n: params.length }) }}
                </h3>
                <button type="button" class="dialog-btn" @click="addParameter">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>{{ t('dashboard.ports.form.add_parameter') }}</span>
                </button>
              </div>

              <p v-if="!params.length" class="rounded-[10px] border border-dashed border-line bg-bg-soft px-4 py-6 text-center text-[13px] text-ink-muted">
                {{ t('dashboard.ports.form.no_parameters') }}
              </p>

              <DashboardPieceTypeActionParameterEditor
                v-for="(draft, index) in params"
                :key="draft.uid"
                :model-value="draft.value"
                :index="index"
                @update:model-value="(value) => onParamUpdate(draft.uid, value)"
                @remove="removeParameter(draft.uid)"
              />
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

.field-label { font-size: 12.5px; font-weight: 500; letter-spacing: -0.005em; color: var(--c-ink-soft); }
.field-help { font-size: 11.5px; color: var(--c-ink-muted); }
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

.dialog-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
.dialog-btn-primary:hover:not(:disabled) { background: color-mix(in oklab, var(--c-ink) 90%, transparent); }
</style>
