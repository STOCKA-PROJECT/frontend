<script setup lang="ts">
import type {
  ActionParameterDto,
  CreatePortDto,
  PortResponseDto,
  UpdatePortDto
} from '~/types/api'
import { pinModeOf, type CatalogParam, type OutputKind, type SensorWiring } from '~/types/contract'
import { ACTION_NAME_PATTERN } from '~/utils/attributeValidators'

// Create/edit a port. The kind drives the rest of the form: which piece types can be chosen (those
// of the same kind; none for infrastructure kinds), whether a GPIO pin is needed, and which config
// keys the catalog requires. Relays, sensors and motors choose their connection: GPIOs of the Pi
// (the port pin, or a motor's pinForward + pinReverse) or channels of a gpio_expander port
// (expander + channel, or a motor's channelForward + channelReverse). A sensor may instead measure a
// value: a model of `profiles.sensor` with its own wiring (I2C, 1-Wire on the port pin, or TRIG/ECHO)
// and a threshold in the unit of its quantity. Legacy typed parameters stay available under "Avançat".

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
/** Relays, sensors and motors: on GPIOs of the Pi or on channels of an expander; a sensor may also measure a value. */
type Connection = 'gpio' | 'expander' | 'measured'
const connection = ref<Connection>('gpio')

/** Config keys that only exist in one connection mode, and those the mode requires. */
interface ConnectionMode { keys: string[], required: string[] }
type ConnectionShape = Partial<Record<Connection, ConnectionMode>>
const EXPANDER_CHANNEL: ConnectionMode = { keys: ['expander', 'channel'], required: ['expander', 'channel'] }
/** Keys of a measured sensor; `source` is set by the form, the wiring keys depend on the model. */
const MEASURED_KEYS = ['source', 'model', 'quantity', 'bus', 'address', 'pinTrig', 'pinEcho', 'deviceId', 'threshold', 'activeWhen', 'hysteresis', 'pollMs']
const SENSOR_WIRING_KEYS: Record<SensorWiring, string[]> = { i2c: ['bus', 'address'], onewire: ['deviceId'], trig_echo: ['pinTrig', 'pinEcho'] }
const ALL_WIRING_KEYS = Object.values(SENSOR_WIRING_KEYS).flat()
const CONNECTION_SHAPES: Partial<Record<OutputKind, ConnectionShape>> = {
  // A relay on an expander takes the polarity of the expander's board.
  relay: { gpio: { keys: ['activeLow'], required: [] }, expander: EXPANDER_CHANNEL },
  // A digital sensor keeps its own polarity on both connections; a measured one has no polarity nor pull.
  sensor: {
    gpio: { keys: ['activeLow', 'pull'], required: [] },
    expander: { keys: ['expander', 'channel', 'activeLow', 'pull'], required: ['expander', 'channel'] },
    measured: { keys: MEASURED_KEYS, required: ['model', 'threshold', 'activeWhen'] }
  },
  motor: {
    gpio: { keys: ['pinForward', 'pinReverse', 'activeLow'], required: ['pinForward', 'pinReverse'] },
    expander: { keys: ['expander', 'channelForward', 'channelReverse'], required: ['expander', 'channelForward', 'channelReverse'] }
  }
}
/** Pairs of config outputs that must differ: a motor's two outputs, a TRIG/ECHO sensor's two GPIOs. */
const DISTINCT_OUTPUTS: Partial<Record<Connection, [string, string]>> = {
  gpio: ['pinForward', 'pinReverse'],
  expander: ['channelForward', 'channelReverse'],
  measured: ['pinTrig', 'pinEcho']
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
    connection.value = props.initial.kind === 'sensor' && props.initial.config?.source === 'measured'
      ? 'measured'
      : typeof props.initial.config?.expander === 'string' && props.initial.kind !== 'gpio_expander' ? 'expander' : 'gpio'
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
/** Connection modes the kind offers, in selector order. */
const connections = computed<Connection[]>(() => (['gpio', 'expander', 'measured'] as Connection[]).filter(c => connectionShape.value?.[c]))
/** Keys that belong to some connection mode other than the current one, and not to the current one. */
function keysOutside(mode: Connection): string[] {
  const shape = connectionShape.value
  if (!shape) return []
  const own = shape[mode]?.keys ?? []
  return connections.value.filter(c => c !== mode).flatMap(c => shape[c]?.keys ?? []).filter(key => !own.includes(key))
}
/** The model of a measured sensor, once chosen. */
const sensorProfile = computed(() => connection.value === 'measured' ? contract.sensorProfile(config.value.model) : null)
/** Quantities of the chosen model; the selector only appears when there is more than one. */
const sensorQuantities = computed(() => Object.keys(sensorProfile.value?.quantities ?? {}))
/** The quantity the threshold is about: the chosen one, or the only one of the model. */
const sensorQuantity = computed(() => {
  const chosen = config.value.quantity
  if (typeof chosen === 'string' && sensorQuantities.value.includes(chosen)) return sensorProfile.value!.quantities[chosen]!
  return sensorQuantities.value.length === 1 ? sensorProfile.value!.quantities[sensorQuantities.value[0]!]! : null
})
const hasPin = computed(() => pinMode.value === 'required'
  || (pinMode.value === 'optional' && connection.value === 'gpio')
  || (connection.value === 'measured' && sensorProfile.value?.wiring === 'onewire'))
/** Config keys hidden in the current connection mode: those of other modes, `source` and, for a measured sensor, what its model does not use. */
const hiddenKeys = computed<string[]>(() => {
  const hidden = keysOutside(connection.value)
  if (kind.value === 'sensor') hidden.push('source')
  if (connection.value === 'measured') {
    const wiring = sensorProfile.value?.wiring
    hidden.push(...ALL_WIRING_KEYS.filter(key => !wiring || !SENSOR_WIRING_KEYS[wiring].includes(key)))
    if (sensorQuantities.value.length < 2) hidden.push('quantity')
  }
  return hidden
})
/** The catalog spec narrowed by the model: threshold range of the quantity, its I2C addresses, its default period. */
function narrowSpec(key: string, spec: CatalogParam): CatalogParam {
  const profile = sensorProfile.value
  if (!profile) return spec
  if (key === 'threshold' && sensorQuantity.value) return { ...spec, min: sensorQuantity.value.min, max: sensorQuantity.value.max }
  if (key === 'address' && profile.addresses?.length) {
    return { ...spec, min: Math.min(...profile.addresses), max: Math.max(...profile.addresses), default: profile.addresses[0] }
  }
  if (key === 'pollMs') return { ...spec, default: profile.pollMs }
  return spec
}
const configFields = computed(() => contract.configFieldsOf(kind.value)
  .filter(f => !hiddenKeys.value.includes(f.key))
  .map(f => ({ key: f.key, spec: narrowSpec(f.key, f.spec) })))
/** Keys the current mode requires beyond the catalog (the expander and its channels, a motor's two GPIOs, a measured sensor's model…). */
const requiredKeys = computed<string[]>(() => {
  const required = [...(connectionShape.value?.[connection.value]?.required ?? [])]
  if (connection.value === 'measured') {
    if (sensorQuantities.value.length > 1) required.push('quantity')
    if (sensorProfile.value?.wiring === 'trig_echo') required.push('pinTrig', 'pinEcho')
  }
  return required
})
const refOptions = computed(() => ({ led_strip: props.strips, gpio_expander: props.expanders, sensor: props.sensors }))
/** An expander has no pull-down resistors: a sensor on one only offers `up` or `none`; a model only offers its quantities. */
const enumExclusions = computed<Record<string, string[]>>((): Record<string, string[]> => {
  if (kind.value === 'sensor' && connection.value === 'expander') return { pull: ['down'] }
  if (connection.value === 'measured') {
    const all = kindSpec.value?.config.quantity?.values ?? []
    return { quantity: all.filter(q => !sensorQuantities.value.includes(q)) }
  }
  return {}
})
/** Measured sensors: the model shows its catalog name. */
const enumLabels = computed<Record<string, Record<string, string>>>(() =>
  ({ model: Object.fromEntries(Object.entries(contract.sensorProfiles).map(([id, p]) => [id, p.name])) }))
/** Measured sensors: threshold and hysteresis are in the unit of the quantity. */
const units = computed<Record<string, string>>((): Record<string, string> =>
  sensorQuantity.value ? { threshold: sensorQuantity.value.unit, hysteresis: sensorQuantity.value.unit } : {})

function onConnectionChange(next: Connection) {
  if (next === connection.value) return
  connection.value = next
  const nextConfig = { ...config.value }
  for (const key of keysOutside(next)) delete nextConfig[key]
  if (next === 'expander' && kind.value === 'sensor' && nextConfig.pull === 'down') delete nextConfig.pull
  if (next === 'measured') nextConfig.source = 'measured'
  else delete nextConfig.source
  config.value = nextConfig
  if (next !== 'gpio') pin.value = null
}

// Changing the model drops the wiring keys and the quantity the new model does not use.
watch(() => config.value.model, () => {
  if (connection.value !== 'measured') return
  const wiring = sensorProfile.value?.wiring
  const nextConfig = { ...config.value }
  let changed = false
  for (const key of ALL_WIRING_KEYS) {
    if (key in nextConfig && (!wiring || !SENSOR_WIRING_KEYS[wiring].includes(key))) {
      delete nextConfig[key]
      changed = true
    }
  }
  if (typeof nextConfig.quantity === 'string' && !sensorQuantities.value.includes(nextConfig.quantity)) {
    delete nextConfig.quantity
    changed = true
  }
  if (changed) config.value = nextConfig
  if (wiring !== 'onewire') pin.value = null
})

/** Kind-specific text for the connection selector (`connection_help.relay`, …; `sensor_measured` for a measured sensor). */
function connectionText(group: 'connection_help' | 'connection_no_expanders'): string {
  const which = kind.value === 'sensor' && connection.value === 'measured' ? 'sensor_measured' : kind.value ?? 'relay'
  return t(`dashboard.ports.form.${group}.${which}`)
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

/** A motor's two outputs (pins or channels), or a TRIG/ECHO sensor's two GPIOs, must differ. */
const outputsDistinct = computed(() => {
  if (kind.value !== 'motor' && !(kind.value === 'sensor' && connection.value === 'measured')) return true
  const pair = DISTINCT_OUTPUTS[connection.value]
  if (!pair) return true
  const first = config.value[pair[0]]
  const second = config.value[pair[1]]
  return first === undefined || second === undefined || first !== second
})

const configValid = computed(() => {
  if (!outputsDistinct.value) return false
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
    // `source` is never a visible field: the connection selector sets it for measured sensors.
    config: Object.fromEntries(Object.entries(config.value).filter(([key]) => visible.has(key) || (key === 'source' && connection.value === 'measured'))),
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
                  <option v-if="connections.includes('measured')" value="measured">{{ t('dashboard.ports.form.connection_measured') }}</option>
                </select>
                <p class="field-help">
                  {{ expanders.length || connection === 'measured' ? connectionText('connection_help') : connectionText('connection_no_expanders') }}
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
              <p v-if="sensorProfile?.notes" class="field-help">{{ sensorProfile.notes }}</p>
              <DashboardPortConfigFields v-model="config" :kind="kind!" :fields="configFields" :ref-options="refOptions"
                :required-keys="requiredKeys" :enum-exclusions="enumExclusions" :enum-labels="enumLabels" :units="units" />
              <p v-if="!outputsDistinct" role="alert" class="field-help text-danger">
                {{ kind === 'motor' ? t('dashboard.ports.form.motor_outputs_distinct') : t('dashboard.ports.form.trig_echo_distinct') }}
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
