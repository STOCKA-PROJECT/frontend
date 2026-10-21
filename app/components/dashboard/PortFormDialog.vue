<script setup lang="ts">
import type {
  ActionParameterDto,
  CreatePortDto,
  PortResponseDto,
  UpdatePortDto
} from '~/types/api'
import { pinModeOf, type OutputKind } from '~/types/contract'
import { ACTION_NAME_PATTERN } from '~/utils/attributeValidators'

// Create/edit a port. The kind drives the rest of the form: which piece types can be chosen (those
// of the same kind; none for infrastructure kinds), whether a GPIO pin is needed, and which config
// keys the catalog requires. Relays, sensors and motors choose their connection: GPIOs of the Pi
// (the port pin, or a motor's pinForward + pinReverse) or channels of a gpio_expander port
// (expander + channel, or a motor's channelForward + channelReverse). Legacy typed parameters stay
// available under "Avançat".

const props = withDefaults(defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  pieceTypes: { id: number, name: string, kind?: OutputKind | null }[]
  /** Names of the organization's led_strip ports (segments reference them). */
  strips: string[]
  /** Names of the organization's gpio_expander ports (relays, sensors and motors on an expander reference them). */
  expanders?: string[]
  /** Names of the organization's sensor ports (motor limit switches reference them). */
  sensors?: string[]
  initial?: PortResponseDto | null
  loading?: boolean
  errorMsg?: string | null
}>(), {
  loading: false,
  errorMsg: null,
  initial: null,
  expanders: () => [],
  sensors: () => []
})

const emit = defineEmits<{
  submit: [payload: CreatePortDto | UpdatePortDto]
  close: []
}>()

const { t } = useI18n()
const contract = useContractStore()

type ParamDraft = { uid: number, value: ActionParameterDto }

const name = ref('')
const kind = ref<OutputKind | null>(null)
const pieceTypeId = ref<number | null>(null)
const pin = ref<number | null>(null)
const config = ref<Record<string, unknown>>({})
/** Relays, sensors and motors: on GPIOs of the Pi or on channels of an expander. */
type Connection = 'gpio' | 'expander'
const connection = ref<Connection>('gpio')

/** Config keys that only exist in one connection mode, and those the mode requires. */
interface ConnectionMode { keys: string[], required: string[] }
type ConnectionShape = Record<Connection, ConnectionMode>
const EXPANDER_CHANNEL: ConnectionMode = { keys: ['expander', 'channel'], required: ['expander', 'channel'] }
const CONNECTION_SHAPES: Partial<Record<OutputKind, ConnectionShape>> = {
  // A relay on an expander takes the polarity of the expander's board.
  relay: { gpio: { keys: ['activeLow'], required: [] }, expander: EXPANDER_CHANNEL },
  // A sensor keeps its own polarity on both connections.
  sensor: { gpio: { keys: [], required: [] }, expander: EXPANDER_CHANNEL },
  motor: {
    gpio: { keys: ['pinForward', 'pinReverse', 'activeLow'], required: ['pinForward', 'pinReverse'] },
    expander: { keys: ['expander', 'channelForward', 'channelReverse'], required: ['expander', 'channelForward', 'channelReverse'] }
  }
}
/** The two outputs of a motor in each connection mode; they must differ. */
const MOTOR_OUTPUTS: Record<Connection, [string, string]> = {
  gpio: ['pinForward', 'pinReverse'],
  expander: ['channelForward', 'channelReverse']
}
const params = ref<ParamDraft[]>([])
const advancedOpen = ref(false)

let uidCounter = 0
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

function newParamDraft(value?: ActionParameterDto): ParamDraft {
  return {
    uid: uidCounter++,
    value: value ?? { name: '', displayName: '', type: 'INTEGER', required: true }
  }
}

function resetState() {
  if (props.mode === 'edit' && props.initial) {
    name.value = props.initial.name
    kind.value = props.initial.kind
    pieceTypeId.value = props.initial.pieceTypeId
    pin.value = props.initial.pin
    config.value = { ...(props.initial.config ?? {}) }
    connection.value = typeof props.initial.config?.expander === 'string' && props.initial.kind !== 'gpio_expander' ? 'expander' : 'gpio'
    params.value = props.initial.parameters.map(p => newParamDraft({ ...p }))
    advancedOpen.value = props.initial.parameters.length > 0
  } else {
    name.value = ''
    kind.value = null
    pieceTypeId.value = null
    pin.value = null
    config.value = {}
    connection.value = 'gpio'
    params.value = []
    advancedOpen.value = false
  }
}

watch(() => props.open, (open) => {
  if (open) {
    resetState()
    contract.load().catch(() => { /* surfaced through contract.error */ })
    nextTick(() => nameInput.value?.focus())
  }
}, { immediate: true })

// ----- kind-driven shape -----
const kindSpec = computed(() => contract.kind(kind.value))
// Infrastructure kinds (strips, expanders, sensors) may exist without a piece type; the others require one.
const pieceTypeOptional = computed(() => kindSpec.value?.infrastructure === true)
const pinMode = computed(() => pinModeOf(kindSpec.value))
const connectionShape = computed<ConnectionShape | null>(() => (kind.value && CONNECTION_SHAPES[kind.value]) || null)
/** Relays, sensors and motors show the connection selector. */
const hasConnectionChoice = computed(() => connectionShape.value !== null)
const otherConnection = computed<Connection>(() => connection.value === 'gpio' ? 'expander' : 'gpio')
const hasPin = computed(() => pinMode.value === 'required' || (pinMode.value === 'optional' && connection.value === 'gpio'))
/** Config keys hidden in the current connection mode (those that only belong to the other one). */
const hiddenKeys = computed<string[]>(() => {
  const shape = connectionShape.value
  if (!shape) return []
  const own = shape[connection.value].keys
  return shape[otherConnection.value].keys.filter(key => !own.includes(key))
})
const configFields = computed(() => contract.configFieldsOf(kind.value).filter(f => !hiddenKeys.value.includes(f.key)))
/** Keys the current mode requires beyond the catalog (the expander and its channels, or a motor's two GPIOs). */
const requiredKeys = computed<string[]>(() => connectionShape.value?.[connection.value].required ?? [])
const refOptions = computed(() => ({ led_strip: props.strips, gpio_expander: props.expanders, sensor: props.sensors }))
/** An expander has no pull-down resistors: a sensor on one only offers `up` or `none`. */
const enumExclusions = computed<Record<string, string[]>>(() =>
  kind.value === 'sensor' && connection.value === 'expander' ? { pull: ['down'] } : {})

function onConnectionChange(next: Connection) {
  if (next === connection.value) return
  const shape = connectionShape.value
  connection.value = next
  const nextConfig = { ...config.value }
  const keep = shape?.[next].keys ?? []
  for (const key of shape?.[otherConnection.value].keys ?? []) {
    if (!keep.includes(key)) delete nextConfig[key]
  }
  if (next === 'expander' && kind.value === 'sensor' && nextConfig.pull === 'down') delete nextConfig.pull
  config.value = nextConfig
  if (next === 'expander') pin.value = null
}

/** Kind-specific text for the connection selector (`connection_help.relay`, …). */
function connectionText(group: 'connection_help' | 'connection_no_expanders'): string {
  return t(`dashboard.ports.form.${group}.${kind.value ?? 'relay'}`)
}
const board = computed(() => contract.catalog?.boards[DEFAULT_BOARD_ID] ?? null)
const DEFAULT_BOARD_ID = 'rpi4b'

const pieceTypeOptions = computed(() =>
  props.pieceTypes.filter(pt => pt.kind === kind.value))
const showPieceType = computed(() =>
  kindSpec.value !== null && (!pieceTypeOptional.value || pieceTypeOptions.value.length > 0))

function onKindChange(next: OutputKind | null) {
  if (next === kind.value) return
  kind.value = next
  pieceTypeId.value = null
  pin.value = null
  config.value = {}
  connection.value = 'gpio'
}

function onPinInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  pin.value = raw === '' ? null : Number(raw)
}

// ----- legacy parameters -----
function addParameter() {
  params.value = [...params.value, newParamDraft()]
}

function removeParameter(uid: number) {
  params.value = params.value.filter(d => d.uid !== uid)
}

function onParamUpdate(uid: number, value: ActionParameterDto) {
  params.value = params.value.map(d => (d.uid === uid ? { ...d, value } : d))
}

// ----- validation -----
const pinValid = computed(() => {
  if (!hasPin.value) return true
  if (pin.value === null || !Number.isInteger(pin.value)) return false
  const b = board.value
  if (!b) return pin.value >= 0
  return pin.value >= b.gpios.min && pin.value <= b.gpios.max && !(String(pin.value) in b.reserved)
})

const pinHint = computed(() => {
  const b = board.value
  if (!hasPin.value || !b || pin.value === null) return ''
  const key = String(pin.value)
  if (key in b.reserved) return t('dashboard.ports.form.pin_reserved', { reason: b.reserved[key] })
  if (kind.value === 'led_strip') {
    const ws = b.ws281x[key]
    if (!ws) return t('dashboard.ports.form.pin_not_ws281x')
    return t('dashboard.ports.form.pin_ws281x_channel', { channel: ws.channel, via: ws.via })
  }
  if (key in b.warnings) return b.warnings[key]!
  return ''
})

/** A motor's two outputs (pins or channels) must differ. */
const motorOutputsDistinct = computed(() => {
  if (kind.value !== 'motor') return true
  const [a, b] = MOTOR_OUTPUTS[connection.value]
  const first = config.value[a]
  const second = config.value[b]
  return first === undefined || second === undefined || first !== second
})

const configValid = computed(() => {
  if (!motorOutputsDistinct.value) return false
  for (const { key, spec } of configFields.value) {
    const value = config.value[key]
    if (value === undefined || value === '') {
      if (spec.required || requiredKeys.value.includes(key)) return false
      continue
    }
    if ((spec.type === 'int' || spec.type === 'number') && typeof value !== 'number') return false
    if (spec.type === 'int' && !Number.isInteger(value)) return false
    if (typeof value === 'number' && spec.min !== undefined && value < spec.min) return false
    if (typeof value === 'number' && spec.max !== undefined && value > spec.max) return false
  }
  return true
})

const paramsValid = computed(() => {
  const seen = new Set<string>()
  for (const d of params.value) {
    const p = d.value
    if (!ACTION_NAME_PATTERN.test(p.name)) return false
    if (seen.has(p.name)) return false
    seen.add(p.name)
    if ((p.type === 'SELECT' || p.type === 'MULTI_SELECT') && !(p.validators?.options?.length)) return false
    if (p.type === 'MEMBER' && !(p.validators?.eligibleRoles?.length)) return false
    // Port parameters are always static, so a required one needs a fixed value (matches the backend).
    if (p.required && (p.staticValue == null || p.staticValue === '')) return false
  }
  return true
})

const canSubmit = computed(() => {
  if (props.loading || !kindSpec.value) return false
  if (!name.value.trim()) return false
  if (!pieceTypeOptional.value && pieceTypeId.value === null) return false
  return pinValid.value && configValid.value && paramsValid.value
})

const title = computed(() => props.mode === 'edit'
  ? t('dashboard.ports.form.edit_title', { name: props.initial?.name ?? '' })
  : t('dashboard.ports.form.new_title'))

const submitLabel = computed(() => props.mode === 'edit'
  ? t('dashboard.ports.form.save')
  : t('dashboard.ports.form.create'))

function kindLabel(k: OutputKind): string {
  return t(`dashboard.kinds.${k}`)
}

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
  if (!canSubmit.value || !kind.value) return
  const visible = new Set(configFields.value.map(f => f.key))
  const payload: CreatePortDto = {
    name: name.value.trim(),
    kind: kind.value,
    pieceTypeId: pieceTypeId.value,
    pin: hasPin.value ? pin.value : null,
    config: Object.fromEntries(Object.entries(config.value).filter(([key]) => visible.has(key))),
    parameters: buildParameters()
  }
  // Both modes send the full set of fields; the backend keeps the kind immutable and re-validates
  // the config, so no diffing is required here.
  emit('submit', payload)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation"
      @click="onBackdropClick" @keydown="onKey">
      <div role="dialog" aria-modal="true" :aria-label="title"
        class="dialog-card flex max-h-[calc(100vh-24px)] w-full max-w-[640px] flex-col">
        <h2 class="dialog-title">{{ title }}</h2>

        <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="submit">
          <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <div v-if="errorMsg" role="alert" class="alert-danger">{{ errorMsg }}</div>
            <div v-else-if="contract.error" role="alert" class="alert-danger">
              {{ t('dashboard.ports.form.catalog_error') }}
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <label for="port-name" class="field-label">{{ t('dashboard.ports.form.field_name') }}</label>
                <input id="port-name" ref="nameInput" v-model="name" type="text" required maxlength="160"
                  :placeholder="t('dashboard.ports.form.field_name_placeholder')" class="field-input">
                <p class="field-help">{{ t('dashboard.ports.form.field_name_help') }}</p>
              </div>

              <div class="flex flex-col gap-1">
                <label for="port-kind" class="field-label">{{ t('dashboard.ports.form.field_kind') }}</label>
                <select id="port-kind" class="field-input" :disabled="mode === 'edit' || contract.loading"
                  :value="kind ?? ''"
                  @change="onKindChange((($event.target as HTMLSelectElement).value || null) as OutputKind | null)">
                  <option value="" disabled>{{ t('dashboard.ports.form.field_kind_placeholder') }}</option>
                  <option v-for="k in contract.kinds" :key="k" :value="k">{{ kindLabel(k) }}</option>
                </select>
                <p class="field-help">
                  {{ mode === 'edit' ? t('dashboard.ports.form.field_kind_immutable') : t('dashboard.ports.form.field_kind_help') }}
                </p>
              </div>
            </div>

            <div v-if="kindSpec" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div v-if="showPieceType" class="flex flex-col gap-1">
                <label for="port-type" class="field-label">{{ t('dashboard.ports.form.field_type') }}</label>
                <select id="port-type" v-model="pieceTypeId" class="field-input" :disabled="!pieceTypeOptions.length && !pieceTypeOptional">
                  <option v-if="pieceTypeOptional" :value="null">{{ t('dashboard.ports.form.field_type_none') }}</option>
                  <option v-else :value="null" disabled>{{ t('dashboard.ports.form.field_type_placeholder') }}</option>
                  <option v-for="pt in pieceTypeOptions" :key="pt.id" :value="pt.id">{{ pt.name }}</option>
                </select>
                <p v-if="!pieceTypeOptions.length && !pieceTypeOptional" class="field-help text-danger">
                  {{ t('dashboard.ports.form.field_type_empty_for_kind', { kind: kindLabel(kind!) }) }}
                </p>
                <p v-else-if="pieceTypeOptional" class="field-help">{{ t('dashboard.ports.form.infrastructure_help') }}</p>
                <p v-else class="field-help">{{ t('dashboard.ports.form.field_type_help') }}</p>
              </div>
              <p v-else class="field-help self-end pb-2 sm:col-span-1">
                {{ t('dashboard.ports.form.infrastructure_help') }}
              </p>

              <div v-if="hasConnectionChoice" class="flex flex-col gap-1">
                <label for="port-connection" class="field-label">{{ t('dashboard.ports.form.field_connection') }}</label>
                <select id="port-connection" class="field-input" :value="connection"
                  @change="onConnectionChange(($event.target as HTMLSelectElement).value as Connection)">
                  <option value="gpio">{{ t('dashboard.ports.form.connection_gpio') }}</option>
                  <option value="expander" :disabled="!expanders.length && connection !== 'expander'">{{ t('dashboard.ports.form.connection_expander') }}</option>
                </select>
                <p class="field-help">
                  {{ expanders.length ? connectionText('connection_help') : connectionText('connection_no_expanders') }}
                </p>
              </div>

              <div v-if="hasPin" class="flex flex-col gap-1">
                <label for="port-pin" class="field-label">{{ t('dashboard.ports.form.field_pin') }}</label>
                <input id="port-pin" :value="pin ?? ''" type="number" :min="board?.gpios.min ?? 0" :max="board?.gpios.max ?? 27" step="1" required
                  :placeholder="t('dashboard.ports.form.field_pin_placeholder')"
                  class="field-input field-input-code" :class="{ 'field-input-error': pin !== null && !pinValid }"
                  @input="onPinInput">
                <p class="field-help" :class="{ 'text-danger': pin !== null && !pinValid }">
                  {{ pinHint || t('dashboard.ports.form.field_pin_help') }}
                </p>
              </div>
            </div>

            <section v-if="kindSpec && configFields.length" class="flex flex-col gap-3">
              <h3 class="section-label">{{ t('dashboard.ports.form.config_title') }}</h3>
              <DashboardPortConfigFields v-model="config" :kind="kind!" :fields="configFields" :ref-options="refOptions"
                :required-keys="requiredKeys" :enum-exclusions="enumExclusions" />
              <p v-if="!motorOutputsDistinct" role="alert" class="field-help text-danger">
                {{ t('dashboard.ports.form.motor_outputs_distinct') }}
              </p>
            </section>

            <details v-if="kindSpec" class="advanced" :open="advancedOpen" @toggle="advancedOpen = ($event.target as HTMLDetailsElement).open">
              <summary class="section-label cursor-pointer select-none">
                {{ t('dashboard.ports.form.advanced_title', { n: params.length }) }}
              </summary>
              <div class="mt-3 flex flex-col gap-3">
                <p class="field-help">{{ t('dashboard.ports.form.advanced_help') }}</p>
                <DashboardPieceTypeActionParameterEditor
                  v-for="(draft, index) in params"
                  :key="draft.uid"
                  :model-value="draft.value"
                  :index="index"
                  static-only
                  @update:model-value="(value) => onParamUpdate(draft.uid, value)"
                  @remove="removeParameter(draft.uid)"
                />
                <button type="button" class="dialog-btn self-start" @click="addParameter">
                  {{ t('dashboard.ports.form.add_parameter') }}
                </button>
              </div>
            </details>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-line-strong px-6 py-3">
            <button type="button" class="dialog-btn" :disabled="loading" @click="emit('close')">
              {{ t('common.close') }}
            </button>
            <button type="submit" class="dialog-btn dialog-btn-primary" :disabled="!canSubmit" :aria-busy="loading">
              {{ submitLabel }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Brandbook: diàleg sobre surface-panel amb radius-lg, camps control-md, un sol botó primari. */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--c-ink) 30%, transparent);
  padding: 12px;
}
.dialog-card {
  border-radius: 10px;
  border: 1px solid var(--c-line-strong);
  background: var(--c-bg-card);
  box-shadow: var(--shadow-lg);
}
.dialog-title {
  padding: 12px 24px;
  border-bottom: 1px solid var(--c-line-strong);
  font-family: var(--font-display, inherit);
  font-size: 18px;
  line-height: 24px;
  font-weight: 600;
  color: var(--c-ink);
}
.alert-danger {
  border-radius: 6px;
  background: var(--c-danger-soft);
  padding: 8px 12px;
  font-size: 13px;
  line-height: 18px;
  color: var(--c-danger);
}
.section-label {
  font-size: 11px;
  line-height: 14px;
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--c-ink-soft);
}
.field-label { font-size: 12px; line-height: 16px; font-weight: 600; color: var(--c-ink-soft); }
.field-help { font-size: 12px; line-height: 16px; color: var(--c-ink-muted); }
.field-input {
  height: 32px;
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--c-line-control, var(--c-line-strong));
  background: var(--c-bg-card);
  padding: 0 8px;
  font-size: 14px;
  color: var(--c-ink);
  outline: none;
  transition: border-color .12s, box-shadow .12s;
}
.field-input::placeholder { color: var(--c-ink-muted); }
.field-input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 2px var(--c-bg-card), 0 0 0 4px var(--c-accent); }
.field-input:disabled { border-color: transparent; background: var(--c-bg-alt); color: var(--c-ink-muted); }
.field-input-code { font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; }
.field-input-error { border-color: var(--c-danger); }
.advanced { border-top: 1px solid var(--c-line); padding-top: 12px; }
.dialog-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--c-line-control, var(--c-line-strong));
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .12s, border-color .12s;
}
.dialog-btn:hover:not(:disabled) { background: var(--c-bg-soft); }
.dialog-btn:disabled { border-color: transparent; background: var(--c-bg-alt); color: var(--c-ink-muted); cursor: not-allowed; }
.dialog-btn-primary { border-color: var(--c-accent); background: var(--c-accent); color: var(--c-on-accent, #fff); }
.dialog-btn-primary:hover:not(:disabled) { border-color: var(--c-accent-ink); background: var(--c-accent-ink); }
</style>
