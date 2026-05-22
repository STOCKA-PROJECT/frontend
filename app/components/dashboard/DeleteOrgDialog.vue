<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  orgName: string
  orgSlug: string
  loading?: boolean
  errorMsg?: string | null
}>(), {
  loading: false,
  errorMsg: null
})

const emit = defineEmits<{
  confirm: []
  close: []
}>()

const { t } = useI18n()

const typed = ref('')

watch(() => props.open, (open) => {
  if (open) {
    typed.value = ''
  }
})

const matches = computed(() => typed.value.trim() === props.orgSlug)
const canConfirm = computed(() => matches.value && !props.loading)

function onBackdropClick(e: MouseEvent) {
  if (props.loading) return
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (props.loading) return
  if (e.key === 'Escape') emit('close')
}

function submit() {
  if (!canConfirm.value) return
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation"
      @click="onBackdropClick" @keydown="onKey">
      <div role="alertdialog" aria-modal="true"
        :aria-label="t('dashboard.org_settings.delete.title')"
        class="flex w-full max-w-[460px] max-h-[calc(100vh-24px)] flex-col rounded-[14px] border border-line bg-bg-card shadow-card">
        <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="submit">
          <div class="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">
              {{ t('dashboard.org_settings.delete.title') }}
            </h2>
            <p class="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
              <i18n-t keypath="dashboard.org_settings.delete.message" tag="span">
                <template #name>
                  <strong class="font-semibold text-ink">{{ orgName }}</strong>
                </template>
              </i18n-t>
            </p>
            <p class="mt-3 text-[13px] leading-relaxed text-ink-soft">
              <i18n-t keypath="dashboard.org_settings.delete.confirm_hint" tag="span">
                <template #slug>
                  <code class="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-[12.5px] text-ink">{{ orgSlug }}</code>
                </template>
              </i18n-t>
            </p>

            <label for="delete-org-confirm"
              class="mt-4 block text-[12.5px] font-medium tracking-[-0.005em] text-ink-soft">
              {{ t('dashboard.org_settings.delete.input_label') }}
            </label>
            <input id="delete-org-confirm" v-model="typed" type="text"
              autocomplete="off" spellcheck="false"
              :placeholder="orgSlug"
              :disabled="loading"
              class="mt-1.5 h-11 w-full rounded-[10px] border border-line bg-field px-3.5 text-[15px] text-ink outline-none transition-[border-color,background,box-shadow] duration-150 placeholder:text-ink-muted hover:border-line-strong focus:border-danger focus:bg-field-focus disabled:opacity-50 sm:text-[14px]">

            <p v-if="errorMsg" role="alert"
              class="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {{ errorMsg }}
            </p>
          </div>

          <footer class="flex-shrink-0 border-t border-line px-5 py-4 sm:px-6">
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" class="dialog-btn"
                :disabled="loading" @click="emit('close')">
                {{ t('common.cancel') }}
              </button>
              <button type="submit" class="dialog-btn dialog-btn-danger"
                :disabled="!canConfirm" :aria-busy="loading">
                {{ t('dashboard.org_settings.delete.confirm') }}
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
input:focus {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c-danger) 18%, transparent);
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
.dialog-btn-danger {
  background: var(--c-danger);
  color: #fff;
  border-color: var(--c-danger);
}
.dialog-btn-danger:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-danger) 92%, transparent);
}
</style>
