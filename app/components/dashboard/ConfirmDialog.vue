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
        class="w-[420px] max-w-[calc(100vw-32px)] rounded-[14px] border border-line bg-bg-card p-6 shadow-card">
        <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">{{ title }}</h2>
        <p class="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">
          {{ message }}
        </p>
        <div class="mt-5 flex items-center justify-end gap-2">
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
  padding: 16px;
}
.dialog-btn {
  height: 36px;
  padding: 0 14px;
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
