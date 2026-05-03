<script setup lang="ts">
const toast = useToastStore()

function iconFor(type: 'error' | 'success' | 'info'): string {
  if (type === 'error') return '!'
  if (type === 'success') return '✓'
  return 'i'
}
</script>

<template>
  <Teleport to="body">
    <div class="toaster" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div
          v-for="item in toast.items"
          :key="item.id"
          class="toast"
          :class="`toast--${item.type}`"
          :role="item.type === 'error' ? 'alert' : 'status'"
        >
          <span class="toast__icon" aria-hidden="true">{{ iconFor(item.type) }}</span>
          <div class="toast__body">
            <p v-if="item.title" class="toast__title">{{ item.title }}</p>
            <p class="toast__description">{{ item.description }}</p>
          </div>
          <button
            type="button"
            class="toast__close"
            :aria-label="$t('common.close')"
            @click="toast.dismiss(item.id)"
          >
            ×
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toaster {
  position: fixed;
  inset: auto 0.75rem max(0.75rem, env(safe-area-inset-bottom)) 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 9999;
  pointer-events: none;
  max-width: calc(100vw - 1.5rem);
}
@media (min-width: 640px) {
  .toaster {
    inset: auto 1rem max(1rem, env(safe-area-inset-bottom)) auto;
    max-width: min(380px, calc(100vw - 2rem));
  }
}

.toast {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: 0.625rem;
  padding: 0.75rem 0.875rem;
  border-radius: 0.625rem;
  border: 1px solid var(--color-line, #e5e7eb);
  background: var(--color-surface, #ffffff);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
  font-size: 13px;
}

.toast--error {
  border-color: rgba(220, 38, 38, 0.3);
  background: rgba(254, 226, 226, 0.5);
  color: rgb(127, 29, 29);
}

.toast--success {
  border-color: rgba(22, 163, 74, 0.3);
  background: rgba(220, 252, 231, 0.6);
  color: rgb(20, 83, 45);
}

.toast--info {
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(219, 234, 254, 0.5);
  color: rgb(30, 58, 138);
}

.toast__icon {
  width: 1.25rem;
  height: 1.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: currentColor;
  color: var(--color-surface, #ffffff);
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
  margin-top: 1px;
}

.toast__body { min-width: 0; }
.toast__title { margin: 0; font-weight: 600; line-height: 1.3; }
.toast__description { margin: 0; line-height: 1.4; }
.toast__title + .toast__description { margin-top: 0.125rem; }

.toast__close {
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  color: inherit;
  opacity: 0.65;
  padding: 0 0.125rem;
}
.toast__close:hover { opacity: 1; }

.toast-enter-active, .toast-leave-active {
  transition: transform 180ms ease, opacity 180ms ease;
}
.toast-enter-from { transform: translateY(8px); opacity: 0; }
.toast-leave-to { transform: translateY(8px); opacity: 0; }
</style>
