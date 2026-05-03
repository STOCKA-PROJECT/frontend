<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  tone?: 'default' | 'danger'
}>(), {
  loading: false,
  tone: 'default'
})

const emit = defineEmits<{
  confirm: []
  close: []
}>()

const { t } = useI18n()

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation"
      @click="onBackdropClick" @keydown="onKey">
      <div role="alertdialog" aria-modal="true" :aria-label="title"
        class="flex w-[420px] max-h-[calc(100vh-24px)] max-w-[calc(100vw-24px)] flex-col rounded-[14px] border border-line bg-bg-card shadow-card">
        <div class="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">{{ title }}</h2>
          <p class="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">
            {{ message }}
          </p>
        </div>
        <footer class="flex-shrink-0 border-t border-line px-5 py-4 sm:px-6">
          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" class="dialog-btn" :disabled="loading" @click="emit('close')">
              {{ cancelLabel ?? t('common.close') }}
            </button>
            <button type="button" class="dialog-btn"
              :class="tone === 'danger' ? 'dialog-btn-danger' : 'dialog-btn-primary'"
              :disabled="loading" :aria-busy="loading"
              @click="emit('confirm')">
              {{ confirmLabel ?? t('common.confirm') }}
            </button>
          </div>
        </footer>
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
.dialog-btn-danger {
  background: var(--c-danger);
  color: #fff;
  border-color: var(--c-danger);
}
.dialog-btn-danger:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-danger) 92%, transparent);
}
</style>
