<script setup lang="ts">
import type { DeviceResponseDto } from '~/types/api'

/** Register a device (name only; the backend mints the token) or rename an existing one. */
const props = withDefaults(defineProps<{
  open: boolean
  mode: 'register' | 'rename'
  initial?: DeviceResponseDto | null
  loading?: boolean
  errorMsg?: string | null
}>(), {
  initial: null,
  loading: false,
  errorMsg: null
})

const emit = defineEmits<{
  submit: [name: string]
  close: []
}>()

const { t } = useI18n()

const NAME_MAX_LENGTH = 80

const name = ref('')
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')
const inputId = useId()

watch(() => props.open, (open) => {
  if (!open) return
  name.value = props.mode === 'rename' && props.initial ? props.initial.name : ''
  nextTick(() => nameInput.value?.focus())
}, { immediate: true })

const title = computed(() => props.mode === 'rename'
  ? t('dashboard.devices.form.rename_title', { name: props.initial?.name ?? '' })
  : t('dashboard.devices.form.register_title'))

const submitLabel = computed(() => props.mode === 'rename'
  ? t('dashboard.devices.form.save')
  : t('dashboard.devices.form.register'))

const trimmedName = computed(() => name.value.trim())

const canSubmit = computed(() => {
  if (props.loading || trimmedName.value.length === 0) return false
  // Renaming to the same name is a no-op; keep the button disabled.
  return props.mode !== 'rename' || trimmedName.value !== props.initial?.name
})

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', trimmedName.value)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation" @click="onBackdropClick" @keydown="onKey">
      <div role="dialog" aria-modal="true" :aria-label="title" class="dialog-card flex w-full max-w-[440px] flex-col">
        <h2 class="dialog-title">{{ title }}</h2>

        <form class="flex flex-col" novalidate @submit.prevent="submit">
          <div class="flex flex-col gap-4 px-6 py-5">
            <div v-if="errorMsg" role="alert" class="alert-danger">{{ errorMsg }}</div>

            <div class="flex flex-col gap-1">
              <label :for="inputId" class="field-label">{{ t('dashboard.devices.form.field_name') }}</label>
              <input
                :id="inputId"
                ref="nameInput"
                v-model="name"
                type="text"
                required
                :maxlength="NAME_MAX_LENGTH"
                :placeholder="t('dashboard.devices.form.field_name_placeholder')"
                :disabled="loading"
                class="field-input"
              >
              <p class="field-help">{{ t('dashboard.devices.form.field_name_help') }}</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-line-strong px-6 py-3">
            <button type="button" class="dialog-btn" :disabled="loading" @click="emit('close')">
              {{ t('common.cancel') }}
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
/* Brandbook: diàleg sobre surface-panel amb radius-lg, camp control-md, un sol botó primari. */
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
