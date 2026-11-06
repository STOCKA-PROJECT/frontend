<script setup lang="ts">
import type { FixtureProfile, HeadPosition } from '~/types/contract'
import { HEAD_POSITION_KEYS, sameHeadPositionName } from '~/types/contract'

/**
 * The named positions of a moving head port (`config.positions`): one row per position with its
 * name and the values it applies (pan, tilt, zoom, intensity, white, colour), each optional. The
 * ranges come from the port's profile. Positions are usually saved from the device page after
 * moving the head with the sliders; here they can be renamed, trimmed or typed by hand.
 */
const props = defineProps<{
  profile: FixtureProfile | null
  disabled?: boolean
}>()

const positions = defineModel<HeadPosition[]>({ required: true })

const { t } = useI18n()

type NumericKey = 'pan' | 'tilt' | 'zoom' | 'intensity' | 'white'
const NUMERIC_KEYS: NumericKey[] = ['pan', 'tilt', 'zoom', 'intensity', 'white']

/** Bounds of each numeric value: the profile for pan/tilt/zoom, the `set` action for the rest. */
const bounds = computed<Record<NumericKey, { min: number, max: number, step: number }>>(() => ({
  pan: { min: 0, max: props.profile?.pan.max ?? 540, step: 0.5 },
  tilt: { min: 0, max: props.profile?.tilt.max ?? 270, step: 0.5 },
  zoom: { min: props.profile?.zoom.min ?? 0, max: props.profile?.zoom.max ?? 100, step: 0.5 },
  intensity: { min: 0, max: 100, step: 1 },
  white: { min: 0, max: 255, step: 1 }
}))

function update(index: number, change: Partial<HeadPosition>, drop: Array<keyof HeadPosition> = []) {
  const next = positions.value.map((p, i) => {
    if (i !== index) return p
    const merged: HeadPosition = { ...p, ...change }
    for (const key of drop) delete merged[key]
    return merged
  })
  positions.value = next
}

function setNumber(index: number, key: NumericKey, raw: string) {
  if (raw.trim() === '') update(index, {}, [key])
  else update(index, { [key]: Number(raw) })
}

function toHex(rgb: [number, number, number] | undefined): string {
  return rgb ? '#' + rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('') : '#ffffff'
}

function fromHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : [255, 255, 255]
}

function setColor(index: number, hex: string) {
  update(index, { color: fromHex(hex) })
}

function toggleColor(index: number, on: boolean) {
  if (on) update(index, { color: positions.value[index]?.color ?? [255, 255, 255] })
  else update(index, {}, ['color'])
}

function add() {
  const base = t('dashboard.ports.positions.default_name')
  let name = base
  for (let n = 2; positions.value.some(p => sameHeadPositionName(p.name, name)); n++) name = `${base} ${n}`
  positions.value = [...positions.value, { name, pan: Math.round((bounds.value.pan.max / 2) * 2) / 2, tilt: Math.round((bounds.value.tilt.max / 2) * 2) / 2 }]
}

function remove(index: number) {
  positions.value = positions.value.filter((_, i) => i !== index)
}

function move(index: number, dir: -1 | 1) {
  const target = index + dir
  if (target < 0 || target >= positions.value.length) return
  const next = [...positions.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  positions.value = next
}

/** Why a row cannot be saved, if anything (the backend refuses the same cases). */
function problem(position: HeadPosition, index: number): string | null {
  if (position.name.trim() === '') return t('dashboard.ports.positions.problem_name')
  if (positions.value.some((p, i) => i !== index && sameHeadPositionName(p.name, position.name))) return t('dashboard.ports.positions.problem_duplicate')
  if (!HEAD_POSITION_KEYS.some(key => position[key] !== undefined && position[key] !== null)) return t('dashboard.ports.positions.problem_empty')
  for (const key of NUMERIC_KEYS) {
    const value = position[key]
    if (value === undefined || value === null) continue
    const b = bounds.value[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < b.min || value > b.max) {
      return t('dashboard.ports.positions.problem_range', { field: t(`dashboard.ports.positions.${key}`), min: b.min, max: b.max })
    }
  }
  return null
}

const inputId = (index: number, key: string) => `head-position-${index}-${key}`
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="pos-help">{{ t('dashboard.ports.positions.help') }}</p>

    <ul v-if="positions.length" class="flex flex-col gap-2">
      <li v-for="(position, index) in positions" :key="index" class="pos-row">
        <div class="flex items-center gap-2">
          <label :for="inputId(index, 'name')" class="sr-only">{{ t('dashboard.ports.positions.name') }}</label>
          <input
            :id="inputId(index, 'name')" type="text" class="pos-input flex-1 font-semibold" :disabled="disabled"
            :placeholder="t('dashboard.ports.positions.name')" :value="position.name"
            @input="update(index, { name: ($event.target as HTMLInputElement).value })">
          <div class="flex items-center gap-0.5 text-ink-muted">
            <button type="button" class="pos-icon" :title="t('dashboard.ports.positions.up')" :disabled="disabled || index === 0" @click="move(index, -1)">▲</button>
            <button type="button" class="pos-icon" :title="t('dashboard.ports.positions.down')" :disabled="disabled || index === positions.length - 1" @click="move(index, 1)">▼</button>
            <button type="button" class="pos-icon text-danger" :title="t('dashboard.ports.positions.remove')" :disabled="disabled" @click="remove(index)">✕</button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          <div v-for="key in NUMERIC_KEYS" :key="key" class="flex flex-col gap-0.5">
            <label :for="inputId(index, key)" class="pos-label">{{ t(`dashboard.ports.positions.${key}`) }}</label>
            <input
              :id="inputId(index, key)" type="number" class="pos-input pos-input-code" :disabled="disabled"
              :min="bounds[key].min" :max="bounds[key].max" :step="bounds[key].step"
              :placeholder="t('dashboard.ports.positions.unchanged')"
              :value="position[key] ?? ''"
              @input="setNumber(index, key, ($event.target as HTMLInputElement).value)">
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="pos-label">{{ t('dashboard.ports.positions.color') }}</span>
            <div class="flex h-8 items-center gap-2">
              <input
                type="checkbox" class="h-4 w-4 accent-[var(--c-accent)]" :disabled="disabled"
                :checked="position.color !== undefined" :aria-label="t('dashboard.ports.positions.color_on')"
                @change="toggleColor(index, ($event.target as HTMLInputElement).checked)">
              <input
                type="color" class="pos-swatch" :disabled="disabled || position.color === undefined"
                :value="toHex(position.color)" :aria-label="t('dashboard.ports.positions.color')"
                @input="setColor(index, ($event.target as HTMLInputElement).value)">
            </div>
          </div>
        </div>

        <p v-if="problem(position, index)" role="alert" class="pos-help text-danger">{{ problem(position, index) }}</p>
      </li>
    </ul>
    <p v-else class="pos-help">{{ t('dashboard.ports.positions.empty') }}</p>

    <button type="button" class="pos-add self-start" :disabled="disabled" @click="add">
      + {{ t('dashboard.ports.positions.add') }}
    </button>
  </div>
</template>

<style scoped>
/* Brandbook: stk-field inside a quiet surface per position. */
.pos-help { font-size: 12px; line-height: 16px; color: var(--c-ink-muted); }
.pos-label { font-size: 11.5px; line-height: 14px; font-weight: 600; color: var(--c-ink-soft); }
.pos-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 8px;
  border: 1px solid var(--c-line-strong);
  background: var(--c-bg-alt);
  padding: 10px 12px;
}
.pos-input {
  height: 32px;
  width: 100%;
  min-width: 0;
  border-radius: 6px;
  border: 1px solid var(--c-line-control, var(--c-line-strong));
  background: var(--c-bg-card);
  padding: 0 8px;
  font-size: 14px;
  color: var(--c-ink);
  outline: none;
  transition: border-color .12s, box-shadow .12s;
}
.pos-input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 2px var(--c-bg-card), 0 0 0 4px var(--c-accent); }
.pos-input:disabled { border-color: transparent; color: var(--c-ink-muted); }
.pos-input-code { font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; }
.pos-swatch {
  width: 44px;
  height: 30px;
  padding: 2px;
  border-radius: 6px;
  border: 1px solid var(--c-line-control, var(--c-line-strong));
  background: var(--c-bg-card);
  cursor: pointer;
}
.pos-swatch:disabled { opacity: .4; cursor: default; }
.pos-icon { padding: 0 4px; font-size: 11px; line-height: 24px; }
.pos-icon:disabled { opacity: .3; }
.pos-add {
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--c-line-strong);
  background: var(--c-bg-card);
  padding: 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink);
}
.pos-add:hover:not(:disabled) { background: var(--c-bg-alt); }
.pos-add:disabled { opacity: .5; }
</style>
