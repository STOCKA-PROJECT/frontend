<script setup lang="ts">
import type { CatalogParam, OutputKind } from '~/types/contract'

// Renders the kind-specific config of a port from the catalog schema: one input per key, typed by
// the catalog (`int`/`number` → number, `bool` → checkbox, `enum` → select of the catalog values,
// `string` with `ref` → a select of the organization's ports of that kind, other strings → text).
// The parent owns the config object and decides which fields are shown (a relay on an expander hides
// `activeLow`; one on a GPIO hides `expander`/`channel`), which of them are required right now and
// which enum values do not apply (a sensor on an expander has no pull-down). Unset booleans and
// enums show the catalog default, which is what the backend applies.

const props = defineProps<{
  kind: OutputKind
  fields: Array<{ key: string, spec: CatalogParam }>
  /** Names of the organization's ports by kind, for `ref` keys (`led_strip` → strips, `gpio_expander` → expanders, `sensor` → sensors). */
  refOptions: Partial<Record<OutputKind, string[]>>
  /** Keys the parent requires in the current mode even if the catalog marks them optional. */
  requiredKeys?: string[]
  /** Enum values not offered in the current mode, by key. */
  enumExclusions?: Record<string, string[]>
  /** Labels of enum values that come from the catalog itself (a sensor model shows its profile name), by key. */
  enumLabels?: Record<string, Record<string, string>>
  /** Unit shown next to the label, by key (a measured sensor's threshold in cm, °C…). */
  units?: Record<string, string>
  disabled?: boolean
}>()

const config = defineModel<Record<string, unknown>>({ required: true })

const { t, te } = useI18n()

/** Kind-specific label first (`config.relay.channel`), then the shared one (`config.channel`), then the key; plus the unit, if any. */
function label(key: string): string {
  const specific = `dashboard.ports.config.${props.kind}.${key}`
  const shared = `dashboard.ports.config.${key}`
  const text = te(specific) ? t(specific) : te(shared) ? t(shared) : key
  const unit = props.units?.[key]
  return unit ? `${text} (${unit})` : text
}

function isRequired(key: string, spec: CatalogParam): boolean {
  return spec.required === true || (props.requiredKeys ?? []).includes(key)
}

function help(key: string, spec: CatalogParam): string {
  const parts: string[] = []
  if (spec.min !== undefined && spec.max !== undefined) parts.push(`${spec.min}–${spec.max}`)
  else if (spec.min !== undefined) parts.push(`≥ ${spec.min}`)
  if (spec.default !== undefined) parts.push(t('dashboard.ports.form.config_default', { value: String(spec.default) }))
  const specific = `dashboard.ports.config_help.${props.kind}.${key}`
  const shared = `dashboard.ports.config_help.${key}`
  if (te(specific)) parts.unshift(t(specific))
  else if (te(shared)) parts.unshift(t(shared))
  return parts.join(' · ')
}

/** Explanation of the chosen enum value (`config_values_help.onActive.play`), if there is one. */
function valueHelp(key: string, spec: CatalogParam): string {
  if (spec.type !== 'enum') return ''
  const value = enumValue(key, spec)
  if (!value) return ''
  const k = `dashboard.ports.config_values_help.${key}.${value}`
  return te(k) ? t(k) : ''
}

function enumValues(key: string, spec: CatalogParam): string[] {
  const excluded = props.enumExclusions?.[key] ?? []
  return (spec.values ?? []).filter(v => !excluded.includes(v))
}

/** The stored value, or the catalog default when unset (and still offered). */
function enumValue(key: string, spec: CatalogParam): string {
  const stored = config.value[key]
  if (typeof stored === 'string') return stored
  const fallback = typeof spec.default === 'string' ? spec.default : ''
  return enumValues(key, spec).includes(fallback) ? fallback : ''
}

function boolValue(key: string, spec: CatalogParam): boolean {
  const stored = config.value[key]
  return typeof stored === 'boolean' ? stored : spec.default === true
}

function setValue(key: string, value: unknown) {
  const next = { ...config.value }
  if (value === '' || value === null || value === undefined) delete next[key]
  else next[key] = value
  config.value = next
}

function onNumberInput(key: string, e: Event) {
  const raw = (e.target as HTMLInputElement).value
  setValue(key, raw === '' ? undefined : Number(raw))
}

function refKind(spec: CatalogParam): OutputKind | null {
  return spec.type === 'string' && spec.ref ? spec.ref : null
}

function refList(spec: CatalogParam): string[] {
  const kind = refKind(spec)
  return kind ? (props.refOptions[kind] ?? []) : []
}

function refPlaceholder(spec: CatalogParam): string {
  return t(`dashboard.ports.form.ref_placeholder.${refKind(spec) ?? 'led_strip'}`)
}

function refNone(spec: CatalogParam): string {
  return t(`dashboard.ports.form.ref_none.${refKind(spec) ?? 'led_strip'}`)
}

function refEmpty(spec: CatalogParam): string {
  return t(`dashboard.ports.form.ref_empty.${refKind(spec) ?? 'led_strip'}`)
}

function enumLabel(key: string, value: string): string {
  const fromCatalog = props.enumLabels?.[key]?.[value]
  if (fromCatalog) return fromCatalog
  const k = `dashboard.ports.config_values.${key}.${value}`
  return te(k) ? t(k) : value
}

const inputId = (key: string) => `port-config-${props.kind}-${key}`
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div v-for="{ key, spec } in fields" :key="key" class="flex flex-col gap-1" :class="{ 'sm:col-span-2': refKind(spec) !== null }">
      <label :for="inputId(key)" class="cfg-label">
        {{ label(key) }}<span v-if="isRequired(key, spec)" class="text-danger" aria-hidden="true"> *</span>
      </label>

      <select v-if="refKind(spec) !== null" :id="inputId(key)" class="cfg-input" :disabled="disabled"
        :value="(config[key] as string | undefined) ?? ''"
        @change="setValue(key, ($event.target as HTMLSelectElement).value)">
        <option v-if="isRequired(key, spec)" value="" disabled>{{ refPlaceholder(spec) }}</option>
        <option v-else value="">{{ refNone(spec) }}</option>
        <option v-for="name in refList(spec)" :key="name" :value="name">{{ name }}</option>
      </select>

      <select v-else-if="spec.type === 'enum'" :id="inputId(key)" class="cfg-input" :disabled="disabled"
        :value="enumValue(key, spec)"
        @change="setValue(key, ($event.target as HTMLSelectElement).value)">
        <option value="" disabled>{{ t('dashboard.ports.form.enum_placeholder') }}</option>
        <option v-for="value in enumValues(key, spec)" :key="value" :value="value">{{ enumLabel(key, value) }}</option>
      </select>

      <label v-else-if="spec.type === 'bool'" class="flex h-8 items-center gap-2 text-[14px] text-ink">
        <input :id="inputId(key)" type="checkbox" class="h-4 w-4 accent-[var(--c-accent)]" :disabled="disabled"
          :checked="boolValue(key, spec)" @change="setValue(key, ($event.target as HTMLInputElement).checked)">
        <span>{{ t('dashboard.ports.form.config_enabled') }}</span>
      </label>

      <input v-else-if="spec.type === 'int' || spec.type === 'number'" :id="inputId(key)" type="number"
        class="cfg-input cfg-input-code" :disabled="disabled"
        :min="spec.min" :max="spec.max" :step="spec.type === 'int' ? 1 : 'any'"
        :value="(config[key] as number | undefined) ?? ''"
        @input="onNumberInput(key, $event)">

      <input v-else :id="inputId(key)" type="text" class="cfg-input" :disabled="disabled"
        :value="(config[key] as string | undefined) ?? ''"
        @input="setValue(key, ($event.target as HTMLInputElement).value)">

      <p v-if="refKind(spec) !== null && !refList(spec).length" class="cfg-help" :class="{ 'text-danger': isRequired(key, spec) }">
        {{ refEmpty(spec) }}
      </p>
      <p v-else-if="help(key, spec)" class="cfg-help">{{ help(key, spec) }}</p>
      <p v-if="valueHelp(key, spec)" class="cfg-help cfg-value-help">{{ valueHelp(key, spec) }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Brandbook: stk-field. */
.cfg-label { font-size: 12px; line-height: 16px; font-weight: 600; color: var(--c-ink-soft); }
.cfg-help { font-size: 12px; line-height: 16px; color: var(--c-ink-muted); }
.cfg-input {
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
.cfg-input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 2px var(--c-bg-card), 0 0 0 4px var(--c-accent); }
.cfg-input:disabled { border-color: transparent; background: var(--c-bg-alt); color: var(--c-ink-muted); }
.cfg-value-help { color: var(--c-ink-soft); }
.cfg-input-code { font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; }
</style>
