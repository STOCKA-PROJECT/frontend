<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import type { ContactResponseDto, CreateContactDto } from '~/types/api'

const props = withDefaults(defineProps<{
  open: boolean
  loading?: boolean
  errorMsg?: string | null
  /** Contacto a editar; sin él, el diálogo crea uno nuevo. */
  contact?: ContactResponseDto | null
  /** Prefijado del nombre al crear desde la búsqueda del selector de propietario. */
  initialName?: string
}>(), {
  loading: false,
  errorMsg: null,
  contact: null,
  initialName: ''
})

const emit = defineEmits<{
  submit: [payload: CreateContactDto]
  close: []
}>()

const { t } = useI18n()

const name = ref('')
const lastName = ref('')
const email = ref('')
const phone = ref('')
const notes = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

const isEdit = computed(() => props.contact != null)
const title = computed(() => isEdit.value
  ? t('dashboard.contacts.edit_dialog_title')
  : t('dashboard.contacts.add_dialog_title'))

function resetFields() {
  name.value = props.contact?.name ?? props.initialName
  lastName.value = props.contact?.lastName ?? ''
  email.value = props.contact?.email ?? ''
  phone.value = props.contact?.phone ?? ''
  notes.value = props.contact?.notes ?? ''
}

watch(() => props.open, (open) => {
  if (open) {
    resetFields()
    nextTick(() => nameInput.value?.focus())
  }
})

onMounted(() => {
  if (props.open) {
    resetFields()
    nextTick(() => nameInput.value?.focus())
  }
})

const emailLooksValid = computed(() => {
  const trimmed = email.value.trim()
  if (!trimmed) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
})

const canSubmit = computed(() => name.value.trim().length > 0 && emailLooksValid.value)

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function submit() {
  if (!canSubmit.value || props.loading) return
  // En edición el backend interpreta cadena vacía como "limpiar el campo",
  // así que enviamos los opcionales siempre (trim incluido).
  emit('submit', {
    name: name.value.trim(),
    lastName: lastName.value.trim(),
    email: email.value.trim(),
    phone: phone.value.trim(),
    notes: notes.value.trim()
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation"
      @click="onBackdropClick" @keydown="onKey">
      <div role="dialog" aria-modal="true" :aria-label="title"
        class="flex w-full max-w-[460px] max-h-[calc(100vh-24px)] flex-col rounded-[14px] border border-line bg-bg-card shadow-card">
        <header class="flex-shrink-0 border-b border-line px-5 py-4 sm:px-6">
          <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">
            {{ title }}
          </h2>
          <p class="mt-1 text-[12.5px] text-ink-muted">
            {{ t('dashboard.contacts.dialog_subtitle') }}
          </p>
        </header>

        <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="submit">
          <div class="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <div v-if="errorMsg" role="alert"
              class="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {{ errorMsg }}
            </div>

            <div class="flex flex-col gap-3.5">
              <div class="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <div class="flex flex-col gap-1.5">
                  <label for="contact-name" class="field-label">
                    {{ t('dashboard.contacts.field_name') }} <span class="text-danger">*</span>
                  </label>
                  <input id="contact-name" ref="nameInput" v-model="name" type="text"
                    maxlength="100" required class="field-input">
                </div>
                <div class="flex flex-col gap-1.5">
                  <label for="contact-last-name" class="field-label">
                    {{ t('dashboard.contacts.field_last_name') }}
                  </label>
                  <input id="contact-last-name" v-model="lastName" type="text"
                    maxlength="100" class="field-input">
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="contact-email" class="field-label">
                  {{ t('dashboard.contacts.field_email') }}
                </label>
                <input id="contact-email" v-model="email" type="email" maxlength="255"
                  :placeholder="t('dashboard.contacts.email_placeholder')" class="field-input">
                <span v-if="!emailLooksValid" class="text-[12px] text-danger">
                  {{ t('dashboard.contacts.email_invalid') }}
                </span>
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="contact-phone" class="field-label">
                  {{ t('dashboard.contacts.field_phone') }}
                </label>
                <input id="contact-phone" v-model="phone" type="tel" maxlength="40" class="field-input">
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="contact-notes" class="field-label">
                  {{ t('dashboard.contacts.field_notes') }}
                </label>
                <textarea id="contact-notes" v-model="notes" rows="3" class="field-input field-textarea" />
              </div>
            </div>
          </div>

          <footer class="flex-shrink-0 border-t border-line px-5 py-4 sm:px-6">
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" class="dialog-btn" :disabled="loading" @click="emit('close')">
                {{ t('common.cancel') }}
              </button>
              <button type="submit" class="dialog-btn dialog-btn-primary"
                :disabled="!canSubmit || loading" :aria-busy="loading">
                {{ loading
                  ? t('common.saving')
                  : (isEdit ? t('common.save') : t('dashboard.contacts.add')) }}
              </button>
            </div>
          </footer>
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
.field-label {
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: var(--c-ink-soft);
}
.field-input {
  height: 44px;
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-field);
  padding: 0 14px;
  font-size: 14.5px;
  color: var(--c-ink);
  outline: none;
  transition: border-color .15s, background .15s, box-shadow .15s;
}
.field-input::placeholder { color: var(--c-ink-muted); }
.field-input:hover { border-color: var(--c-line-strong); }
.field-input:focus {
  border-color: var(--c-accent);
  background: var(--c-field-focus, var(--c-bg-card));
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c-accent) 18%, transparent);
}
.field-textarea {
  height: auto;
  min-height: 76px;
  padding: 10px 14px;
  resize: vertical;
}
.dialog-btn {
  height: 40px;
  padding: 0 16px;
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
</style>
