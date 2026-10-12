<script setup lang="ts">
import type { OutputKind } from '~/types/contract'

// Create or edit a piece type: its name and, optionally, the output kind it drives. With a kind, the
// type's actions must come from the catalog of that kind and its ports must be of the same kind.

const props = withDefaults(defineProps<{
  open: boolean
  mode: 'create' | 'rename'
  initialName?: string
  initialKind?: OutputKind | null
  loading?: boolean
  errorMsg?: string | null
}>(), {
  loading: false,
  errorMsg: null,
  initialName: '',
  initialKind: null
})

const emit = defineEmits<{
  submit: [payload: { name: string, kind: OutputKind | null }]
  close: []
}>()

const { t } = useI18n()
const contract = useContractStore()

const name = ref(props.initialName)
const kind = ref<OutputKind | null>(props.initialKind)
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

watch(() => props.open, (open) => {
  if (open) {
    name.value = props.initialName
    kind.value = props.initialKind
    contract.load().catch(() => { /* the select just stays empty; the error shows below */ })
    nextTick(() => nameInput.value?.focus())
  }
}, { immediate: true })

const title = computed(() => props.mode === 'rename'
  ? t('dashboard.pieceTypes.form.edit_title')
  : t('dashboard.pieceTypes.form.new_title'))

const submitLabel = computed(() => props.mode === 'rename'
  ? t('dashboard.pieceTypes.form.save')
  : t('dashboard.pieceTypes.form.create'))

/** Clearing an existing kind is not supported by the backend; the option disappears once set. */
const canClearKind = computed(() => props.mode === 'create' || props.initialKind === null)

function kindLabel(k: OutputKind): string {
  return t(`dashboard.kinds.${k}`)
}

function onKindChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  kind.value = value ? (value as OutputKind) : null
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed || props.loading) return
  emit('submit', { name: trimmed, kind: kind.value })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation"
      @click="onBackdropClick" @keydown="onKey">
      <div role="dialog" aria-modal="true" :aria-label="title"
        class="dialog-card flex w-full max-w-[460px] max-h-[calc(100vh-24px)] flex-col">
        <header class="dialog-header">
          <h2 class="dialog-title">{{ title }}</h2>
        </header>

        <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="submit">
          <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <div v-if="errorMsg" role="alert" class="alert-danger">{{ errorMsg }}</div>

            <div class="flex flex-col gap-1">
              <label for="pt-name" class="field-label">{{ t('dashboard.pieceTypes.form.field_name') }}</label>
              <input id="pt-name" ref="nameInput" v-model="name" type="text" required maxlength="120"
                :placeholder="t('dashboard.pieceTypes.form.field_name_placeholder')" class="field-input">
            </div>

            <div class="flex flex-col gap-1">
              <label for="pt-kind" class="field-label">{{ t('dashboard.pieceTypes.form.field_kind') }}</label>
              <select id="pt-kind" class="field-input" :value="kind ?? ''" :disabled="contract.loading" @change="onKindChange">
                <option v-if="canClearKind" value="">{{ t('dashboard.pieceTypes.form.field_kind_none') }}</option>
                <option v-for="k in contract.pieceKinds" :key="k" :value="k">{{ kindLabel(k) }}</option>
              </select>
              <p class="field-help">
                {{ mode === 'rename' && initialKind ? t('dashboard.pieceTypes.form.field_kind_change_help') : t('dashboard.pieceTypes.form.field_kind_help') }}
              </p>
              <p v-if="contract.error" class="field-help text-danger">{{ t('dashboard.ports.form.catalog_error') }}</p>
            </div>
          </div>

          <footer class="flex items-center justify-end gap-2 border-t border-line-strong px-6 py-3">
            <button type="button" class="dialog-btn" :disabled="loading" @click="emit('close')">
              {{ t('common.close') }}
            </button>
            <button type="submit" class="dialog-btn dialog-btn-primary"
              :disabled="!name.trim() || loading" :aria-busy="loading">
              {{ submitLabel }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Brandbook: diàleg amb radius-lg, camps control-md i un únic botó primari en brand. */
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
.dialog-header { padding: 12px 24px; border-bottom: 1px solid var(--c-line-strong); }
.dialog-title {
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
.dialog-btn {
  display: inline-flex;
  align-items: center;
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
