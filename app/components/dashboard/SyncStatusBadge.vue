<script setup lang="ts">
const { t } = useI18n()
const { isDesktop, pending, failed, syncing, online, syncNow } = useDesktopSyncStatus()

// Severity drives the dot colour: conflicts first, then offline, then in-flight, then idle.
const state = computed<'failed' | 'offline' | 'syncing' | 'pending' | 'idle'>(() => {
  if (failed.value > 0) return 'failed'
  if (!online.value) return 'offline'
  if (syncing.value) return 'syncing'
  if (pending.value > 0) return 'pending'
  return 'idle'
})

const label = computed(() => {
  switch (state.value) {
    case 'failed': return t('dashboard.sync.failed', { count: failed.value })
    case 'offline': return t('dashboard.sync.offline')
    case 'syncing': return t('dashboard.sync.syncing')
    case 'pending': return t('dashboard.sync.pending', { count: pending.value })
    default: return t('dashboard.sync.idle')
  }
})
</script>

<template>
  <button
    v-if="isDesktop"
    type="button"
    class="sync-badge"
    :data-state="state"
    :aria-label="`${t('dashboard.sync.title')}: ${label}`"
    :title="t('dashboard.sync.sync_now')"
    :disabled="syncing"
    @click="syncNow"
  >
    <span class="sync-dot" :class="{ 'sync-dot--spin': state === 'syncing' }" aria-hidden="true" />
    <span class="sync-label">{{ label }}</span>
  </button>
</template>

<style scoped>
:where(.sync-badge) {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--c-line);
  border-radius: 9px;
  background: var(--c-field);
  color: var(--c-ink-soft);
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
}

.sync-badge:hover:not(:disabled) {
  border-color: var(--c-line-strong);
  color: var(--c-ink);
}

.sync-badge:disabled {
  cursor: default;
}

.sync-badge:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--c-ink-muted);
  flex-shrink: 0;
}

.sync-badge[data-state="idle"] .sync-dot { background: #16a34a; }
.sync-badge[data-state="pending"] .sync-dot { background: #d97706; }
.sync-badge[data-state="syncing"] .sync-dot { background: var(--c-accent); }
.sync-badge[data-state="offline"] .sync-dot { background: var(--c-ink-muted); }
.sync-badge[data-state="failed"] .sync-dot { background: #dc2626; }

.sync-dot--spin {
  animation: sync-pulse 1s ease-in-out infinite;
}

@keyframes sync-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .35; }
}

.sync-label {
  white-space: nowrap;
}

@media (max-width: 640px) {
  .sync-label { display: none; }
}
</style>
