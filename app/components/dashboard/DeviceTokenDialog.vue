<script setup lang="ts">
import type { DeviceCreatedDto } from '~/types/api'

/**
 * Shows the heartbeat URL and token right after registering a device or rotating its token.
 * The backend returns the token only here, so the dialog does not close on a backdrop click:
 * only the «Fet» button or Escape dismiss it, and the board drops the token when it closes.
 */
const props = defineProps<{
  open: boolean
  mode: 'register' | 'rotate'
  result: DeviceCreatedDto | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const COPIED_FEEDBACK_MS = 2000

type Field = 'url' | 'token'

const copied = shallowRef<Field | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const cardRef = useTemplateRef<HTMLElement>('card')
const titleId = useId()
const urlLabelId = useId()
const tokenLabelId = useId()

const title = computed(() => t(props.mode === 'rotate'
  ? 'dashboard.devices.token.rotate_title'
  : 'dashboard.devices.token.register_title'))

const intro = computed(() => t(
  props.mode === 'rotate' ? 'dashboard.devices.token.rotate_intro' : 'dashboard.devices.token.register_intro',
  { name: props.result?.device.name ?? '' }
))

const copiedAnnouncement = computed(() => copied.value === null
  ? ''
  : t(copied.value === 'url' ? 'dashboard.devices.token.copied_url' : 'dashboard.devices.token.copied_token'))

watch(() => props.open, (open) => {
  if (!open) return
  copied.value = null
  // Focus the dialog itself so the title is announced before the user tabs to the copy buttons.
  nextTick(() => cardRef.value?.focus())
}, { immediate: true })

async function copy(field: Field) {
  const text = field === 'url' ? props.result?.heartbeatUrl : props.result?.heartbeatToken
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = field
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = null }, COPIED_FEEDBACK_MS)
  } catch {
    // Clipboard unavailable (plain http, permission denied): the value stays selectable by click.
    copied.value = null
  }
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && result" class="dialog-backdrop" role="presentation" @keydown="onKey">
      <div
        ref="card"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        class="dialog-card flex max-h-[calc(100vh-24px)] w-full max-w-[560px] flex-col"
      >
        <h2 :id="titleId" class="dialog-title">{{ title }}</h2>

        <div class="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          <p class="text-[14px] leading-5 text-ink-soft">{{ intro }}</p>

          <div class="flex flex-col gap-1">
            <span :id="urlLabelId" class="field-label">{{ t('dashboard.devices.token.url_label') }}</span>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <code class="value select-all" :aria-labelledby="urlLabelId">{{ result.heartbeatUrl }}</code>
              <button type="button" class="dialog-btn shrink-0" :aria-label="t('dashboard.devices.token.copy_url_aria')" @click="copy('url')">
                <DashboardIcon :name="copied === 'url' ? 'check' : 'copy'" :size="14" />
                {{ copied === 'url' ? t('dashboard.devices.token.copied') : t('dashboard.devices.token.copy') }}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <span :id="tokenLabelId" class="field-label">{{ t('dashboard.devices.token.token_label') }}</span>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <code class="value select-all" :aria-labelledby="tokenLabelId">{{ result.heartbeatToken }}</code>
              <button type="button" class="dialog-btn shrink-0" :aria-label="t('dashboard.devices.token.copy_token_aria')" @click="copy('token')">
                <DashboardIcon :name="copied === 'token' ? 'check' : 'copy'" :size="14" />
                {{ copied === 'token' ? t('dashboard.devices.token.copied') : t('dashboard.devices.token.copy') }}
              </button>
            </div>
          </div>

          <p class="alert-warn" role="note">{{ t('dashboard.devices.token.once_warning') }}</p>
          <p class="text-[13px] leading-[18px] text-ink-soft">{{ t('dashboard.devices.token.instructions') }}</p>

          <span class="sr-only" role="status" aria-live="polite">{{ copiedAnnouncement }}</span>
        </div>

        <div class="flex items-center justify-end border-t border-line-strong px-6 py-3">
          <button type="button" class="dialog-btn dialog-btn-primary" @click="emit('close')">
            {{ t('dashboard.devices.token.done') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Brandbook: diàleg sobre surface-panel amb radius-lg; valors a copiar en mono sobre surface-sunken. */
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
  outline: none;
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
.field-label { font-size: 12px; line-height: 16px; font-weight: 600; color: var(--c-ink-soft); }
.value {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  border-radius: 6px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-alt);
  padding: 6px 8px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 18px;
  color: var(--c-ink);
  word-break: break-all;
}
.alert-warn {
  border-radius: 6px;
  background: var(--c-warn-soft);
  padding: 8px 12px;
  font-size: 13px;
  line-height: 18px;
  color: var(--c-warn-ink);
}
.dialog-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
.dialog-btn-primary { border-color: var(--c-accent); background: var(--c-accent); color: var(--c-on-accent, #fff); }
.dialog-btn-primary:hover:not(:disabled) { border-color: var(--c-accent-ink); background: var(--c-accent-ink); }
</style>
