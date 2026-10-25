<script setup lang="ts">
import type { DeviceResponseDto, UpdateDeviceDto } from '~/types/api'

/**
 * Register a device (the backend mints the token) or edit one: its name, where the editor reaches it on
 * the local network and its PIN, so every computer and phone of the organization finds it configured.
 * In edit mode only the fields that changed are submitted; an emptied address or PIN is removed.
 */
const props = withDefaults(defineProps<{
  open: boolean
  mode: 'register' | 'edit'
  initial?: DeviceResponseDto | null
  loading?: boolean
  errorMsg?: string | null
}>(), {
  initial: null,
  loading: false,
  errorMsg: null
})

const emit = defineEmits<{
  submit: [payload: UpdateDeviceDto]
  close: []
}>()

const { t } = useI18n()

const NAME_MAX_LENGTH = 80
const URL_MAX_LENGTH = 255
const PIN_PATTERN = /^\d{6}$/

const name = ref('')
const localUrl = ref('')
const pin = ref('')
const pinVisible = ref(false)
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')
const inputId = useId()
const urlId = useId()
const pinId = useId()

const initialUrl = computed(() => props.initial?.localUrl ?? '')
const initialPin = computed(() => props.initial?.pin ?? '')

watch(() => props.open, (open) => {
  if (!open) return
  const editing = props.mode === 'edit' && props.initial
  name.value = editing ? props.initial!.name : ''
  localUrl.value = editing ? initialUrl.value : ''
  pin.value = editing ? initialPin.value : ''
  pinVisible.value = false
  nextTick(() => nameInput.value?.focus())
}, { immediate: true })

const title = computed(() => props.mode === 'edit'
  ? t('dashboard.devices.form.rename_title', { name: props.initial?.name ?? '' })
  : t('dashboard.devices.form.register_title'))

const submitLabel = computed(() => props.mode === 'edit'
  ? t('dashboard.devices.form.save')
  : t('dashboard.devices.form.register'))

const trimmedName = computed(() => name.value.trim())
const trimmedUrl = computed(() => localUrl.value.trim())
const trimmedPin = computed(() => pin.value.trim())
const pinInvalid = computed(() => trimmedPin.value !== '' && !PIN_PATTERN.test(trimmedPin.value))

/** What goes to the backend: everything on register, only what changed on edit. */
const payload = computed<UpdateDeviceDto>(() => {
  if (props.mode === 'register') {
    return {
      name: trimmedName.value,
      ...(trimmedUrl.value ? { localUrl: trimmedUrl.value } : {}),
      ...(trimmedPin.value ? { pin: trimmedPin.value } : {})
    }
  }
  const out: UpdateDeviceDto = {}
  if (trimmedName.value !== props.initial?.name) out.name = trimmedName.value
  if (trimmedUrl.value !== initialUrl.value) out.localUrl = trimmedUrl.value
  // A SPECTATOR never gets here (no edit button); a hidden PIN would read as empty otherwise.
  if (trimmedPin.value !== initialPin.value) out.pin = trimmedPin.value
  return out
})

const canSubmit = computed(() => {
  if (props.loading || trimmedName.value.length === 0 || pinInvalid.value) return false
  // Saving an unchanged device is a no-op; keep the button disabled.
  return props.mode !== 'edit' || Object.keys(payload.value).length > 0
})

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', payload.value)
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

            <div class="flex flex-col gap-1">
              <label :for="urlId" class="field-label">{{ t('dashboard.devices.form.field_url') }}</label>
              <input
                :id="urlId"
                v-model="localUrl"
                type="text"
                inputmode="url"
                autocapitalize="off"
                autocomplete="off"
                spellcheck="false"
                :maxlength="URL_MAX_LENGTH"
                :placeholder="t('dashboard.devices.form.field_url_placeholder')"
                :disabled="loading"
                class="field-input field-mono"
              >
              <p class="field-help">{{ t('dashboard.devices.form.field_url_help') }}</p>
            </div>

            <div class="flex flex-col gap-1">
              <label :for="pinId" class="field-label">{{ t('dashboard.devices.form.field_pin') }}</label>
              <div class="flex items-center gap-2">
                <input
                  :id="pinId"
                  v-model="pin"
                  :type="pinVisible ? 'text' : 'password'"
                  inputmode="numeric"
                  autocomplete="off"
                  maxlength="6"
                  :placeholder="t('dashboard.devices.form.field_pin_placeholder')"
                  :disabled="loading"
                  :aria-invalid="pinInvalid"
                  class="field-input field-mono !w-32"
                >
                <button
                  type="button"
                  class="dialog-btn"
                  :disabled="loading || !pin"
                  :aria-pressed="pinVisible"
                  @click="pinVisible = !pinVisible"
                >
                  {{ pinVisible ? t('dashboard.devices.form.hide_pin') : t('dashboard.devices.form.show_pin') }}
                </button>
              </div>
              <p v-if="pinInvalid" class="field-error">{{ t('dashboard.devices.form.pin_invalid') }}</p>
              <p class="field-help">{{ t('dashboard.devices.form.field_pin_help') }}</p>
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
.field-mono { font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; }
.field-error { font-size: 12px; line-height: 16px; color: var(--c-danger); }
.field-input[aria-invalid="true"] { border-color: var(--c-danger); }
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
