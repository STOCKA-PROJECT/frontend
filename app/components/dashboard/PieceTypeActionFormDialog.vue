<script setup lang="ts">
import type {
  ActionParameterDto,
  CreatePieceTypeActionDto,
  PieceTypeActionResponseDto,
  UpdatePieceTypeActionDto
} from '~/types/api'
import { attributeTypeFor, durationParamOf, type CatalogAction, type OutputKind } from '~/types/contract'
import { ACTION_NAME_PATTERN, slugifyName } from '~/utils/attributeValidators'

// Create/edit an action of a piece type. When the type has an output kind, the technical name is
// chosen from the catalog of that kind and the parameters are pre-filled from the catalog action;
// the backend validates the same rules. Inventory-only types keep the free-form behaviour.

const props = withDefaults(defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  typeName: string
  /** Output kind of the owning piece type; null for inventory-only types. */
  kind?: OutputKind | null
  initial?: PieceTypeActionResponseDto | null
  loading?: boolean
  errorMsg?: string | null
}>(), {
  kind: null,
  loading: false,
  errorMsg: null,
  initial: null
})

const emit = defineEmits<{
  submit: [payload: CreatePieceTypeActionDto | UpdatePieceTypeActionDto]
  close: []
}>()

const { t, te } = useI18n()
const contract = useContractStore()

type ParamDraft = { uid: number, value: ActionParameterDto }

const displayName = ref('')
const name = ref('')
const nameTouched = ref(false)
const description = ref('')
const params = ref<ParamDraft[]>([])

let uidCounter = 0
const displayNameInput = useTemplateRef<HTMLInputElement>('displayNameInput')

const hasKind = computed(() => props.kind !== null)
const catalogActions = computed(() => contract.actionsOf(props.kind))
const catalogAction = computed<CatalogAction | null>(() => contract.action(props.kind, name.value))

function newParamDraft(value?: ActionParameterDto): ParamDraft {
  return {
    uid: uidCounter++,
    value: value ?? { name: '', displayName: '', type: 'TEXT', required: true, dynamic: false }
  }
}

function resetState() {
  if (props.mode === 'edit' && props.initial) {
    displayName.value = props.initial.displayName
    name.value = props.initial.name
    description.value = props.initial.description ?? ''
    params.value = props.initial.parameters.map(p => newParamDraft({ ...p }))
  } else {
    displayName.value = ''
    name.value = ''
    description.value = ''
    params.value = []
  }
  nameTouched.value = props.mode === 'edit'
}

watch(() => props.open, (open) => {
  if (open) {
    resetState()
    if (hasKind.value) contract.load().catch(() => { /* surfaced through contract.error */ })
    nextTick(() => displayNameInput.value?.focus())
  }
}, { immediate: true })

watch(displayName, (next) => {
  if (props.mode !== 'create' || hasKind.value) return
  if (nameTouched.value) return
  name.value = slugifyName(next)
})

function onNameInput(e: Event) {
  nameTouched.value = true
  name.value = (e.target as HTMLInputElement).value
}

/** Human label for a catalog action or parameter, falling back to the technical name. */
function catalogLabel(scope: 'catalogActions' | 'catalogParams', key: string): string {
  const k = `dashboard.pieceTypes.${scope}.${key}`
  return te(k) ? t(k) : key
}

/** Builds the parameter drafts a catalog action needs: every common parameter, typed and bound dynamically. */
function paramsFromCatalog(action: CatalogAction): ParamDraft[] {
  const duration = durationParamOf(action)
  return Object.entries(action.params).map(([pname, spec]) => newParamDraft({
    name: pname,
    displayName: catalogLabel('catalogParams', pname),
    type: attributeTypeFor(spec.type),
    required: spec.required === true,
    dynamic: true,
    ...(pname === duration ? { isDuration: true } : {}),
    ...(spec.type === 'enum' ? { validators: { options: [...(spec.values ?? [])] } } : {})
  }))
}

function onCatalogActionChange(e: Event) {
  const next = (e.target as HTMLSelectElement).value
  if (next === name.value) return
  name.value = next
  nameTouched.value = true
  const action = contract.action(props.kind, next)
  if (!action) return
  if (props.mode === 'create') {
    if (!displayName.value.trim()) displayName.value = catalogLabel('catalogActions', next)
    params.value = paramsFromCatalog(action)
  }
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

const nameInvalid = computed(() => name.value.length > 0 && !ACTION_NAME_PATTERN.test(name.value))
const nameNotInCatalog = computed(() => hasKind.value && name.value.length > 0 && !catalogActions.value.includes(name.value))

/** Parameter names the catalog does not know for the chosen action (reported before the backend does). */
const unknownParams = computed<string[]>(() => {
  const action = catalogAction.value
  if (!action) return []
  const allowed = new Set(Object.keys(action.params))
  for (const anim of Object.values(action.animations ?? {})) Object.keys(anim.params).forEach(k => allowed.add(k))
  return params.value.map(d => d.value.name).filter(n => n && !allowed.has(n))
})

const paramsValid = computed(() => {
  const seen = new Set<string>()
  let durations = 0
  for (const d of params.value) {
    const p = d.value
    if (!ACTION_NAME_PATTERN.test(p.name)) return false
    if (seen.has(p.name)) return false
    seen.add(p.name)
    if ((p.type === 'SELECT' || p.type === 'MULTI_SELECT') && !(p.validators?.options?.length)) return false
    if (p.type === 'MEMBER' && !(p.validators?.eligibleRoles?.length)) return false
    // A required static parameter must carry a fixed value (mirrors the backend rule).
    if (!p.dynamic && p.required && (p.staticValue == null || p.staticValue === '')) return false
    if (p.isDuration) {
      durations++
      // At most one duration parameter, and a static one needs a fixed length.
      if (durations > 1) return false
      if (!p.dynamic && (p.staticValue == null || p.staticValue === '')) return false
    }
  }
  return unknownParams.value.length === 0
})

const canSubmit = computed(() => {
  if (props.loading) return false
  if (!displayName.value.trim()) return false
  if (!ACTION_NAME_PATTERN.test(name.value)) return false
  if (nameNotInCatalog.value) return false
  return paramsValid.value
})

const title = computed(() => props.mode === 'edit'
  ? t('dashboard.pieceTypes.action_form.edit_title', { name: props.initial?.displayName ?? '' })
  : t('dashboard.pieceTypes.action_form.new_title', { type: props.typeName }))

const submitLabel = computed(() => props.mode === 'edit'
  ? t('dashboard.pieceTypes.action_form.save')
  : t('dashboard.pieceTypes.action_form.create'))

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
  const parameters = buildParameters()
  const trimmedDescription = description.value.trim()

  if (props.mode === 'create') {
    const payload: CreatePieceTypeActionDto = {
      name: name.value,
      displayName: displayName.value.trim(),
      parameters,
      ...(trimmedDescription ? { description: trimmedDescription } : {})
    }
    emit('submit', payload)
  } else {
    const payload: UpdatePieceTypeActionDto = {
      displayName: displayName.value.trim(),
      description: trimmedDescription,
      parameters
    }
    if (name.value !== props.initial?.name) payload.name = name.value
    emit('submit', payload)
  }
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

            <p v-if="hasKind" class="catalog-hint">
              {{ t('dashboard.pieceTypes.action_form.catalog_hint', { kind: t(`dashboard.kinds.${kind}`) }) }}
            </p>

            <div class="flex flex-col gap-1">
              <label for="action-name" class="field-label">{{ t('dashboard.pieceTypes.action_form.field_name') }}</label>
              <select v-if="hasKind" id="action-name" class="field-input field-input-code" :value="name"
                :disabled="contract.loading" @change="onCatalogActionChange">
                <option value="" disabled>{{ t('dashboard.pieceTypes.action_form.field_name_catalog_placeholder') }}</option>
                <option v-for="a in catalogActions" :key="a" :value="a">{{ a }} — {{ catalogLabel('catalogActions', a) }}</option>
              </select>
              <input v-else id="action-name" :value="name" type="text" required maxlength="80"
                :placeholder="t('dashboard.pieceTypes.action_form.field_name_placeholder')"
                class="field-input field-input-code" :class="{ 'field-input-error': nameInvalid }"
                @input="onNameInput">
              <p v-if="nameInvalid" class="field-error">{{ t('dashboard.pieceTypes.errors.action_name_pattern') }}</p>
              <p v-else-if="nameNotInCatalog" class="field-error">{{ t('dashboard.pieceTypes.action_form.name_not_in_catalog') }}</p>
              <p v-else-if="hasKind" class="field-help">{{ t('dashboard.pieceTypes.action_form.field_name_catalog_help') }}</p>
              <p v-else class="field-help">
                {{ mode === 'edit'
                  ? t('dashboard.pieceTypes.attribute_form.field_name_edit_help')
                  : t('dashboard.pieceTypes.attribute_form.field_name_help') }}
              </p>
            </div>

            <div class="flex flex-col gap-1">
              <label for="action-display-name" class="field-label">{{ t('dashboard.pieceTypes.action_form.field_display_name') }}</label>
              <input id="action-display-name" ref="displayNameInput" v-model="displayName"
                type="text" required maxlength="160"
                :placeholder="t('dashboard.pieceTypes.action_form.field_display_name_placeholder')"
                class="field-input">
            </div>

            <div class="flex flex-col gap-1">
              <label for="action-description" class="field-label">{{ t('dashboard.pieceTypes.action_form.field_description') }}</label>
              <input id="action-description" v-model="description" type="text" maxlength="255"
                :placeholder="t('dashboard.pieceTypes.action_form.field_description_placeholder')"
                class="field-input">
            </div>

            <div class="mt-1 flex flex-col gap-3">
              <div class="flex items-center justify-between gap-2">
                <h3 class="section-label">
                  {{ t('dashboard.pieceTypes.action_form.parameters_title', { n: params.length }) }}
                </h3>
                <button type="button" class="dialog-btn" @click="addParameter">
                  {{ t('dashboard.pieceTypes.action_form.add_parameter') }}
                </button>
              </div>

              <p v-if="unknownParams.length" class="field-error">
                {{ t('dashboard.pieceTypes.action_form.params_not_in_catalog', { names: unknownParams.join(', ') }) }}
              </p>

              <p v-if="!params.length" class="empty-box">
                {{ t('dashboard.pieceTypes.action_form.no_parameters') }}
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
/* Brandbook: diàleg amb radius-lg, camps control-md, codis en mono, un botó primari. */
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
.catalog-hint {
  border-radius: 6px;
  background: var(--c-accent-soft);
  padding: 8px 12px;
  font-size: 13px;
  line-height: 18px;
  color: var(--c-accent-ink);
}
.section-label {
  font-size: 11px;
  line-height: 14px;
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--c-ink-soft);
}
.empty-box {
  border-radius: 10px;
  border: 1px dashed var(--c-line-strong);
  background: var(--c-bg-soft);
  padding: 20px 16px;
  text-align: center;
  font-size: 13px;
  line-height: 18px;
  color: var(--c-ink-muted);
}
.field-label { font-size: 12px; line-height: 16px; font-weight: 600; color: var(--c-ink-soft); }
.field-help { font-size: 12px; line-height: 16px; color: var(--c-ink-muted); }
.field-error { font-size: 12px; line-height: 16px; color: var(--c-danger); }
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
