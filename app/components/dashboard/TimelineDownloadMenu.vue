<script setup lang="ts">
import type { TimelineResponseDto } from '~/types/api'
import type { TimelineDownloadFailure, TimelineDownloadKind } from '~/composables/useTimelineDownload'

/**
 * «Descarrega» menu button of a timeline row: downloads the self-contained bundle
 * (`.belen.zip`) or the bare `show.json`. Follows the WAI-ARIA menu button pattern
 * (arrow keys, Home/End, Escape, click outside); failures are emitted so the board
 * shows them in its alert.
 */
const props = defineProps<{
  orgSlug: string
  timeline: TimelineResponseDto
}>()

const emit = defineEmits<{
  error: [failure: TimelineDownloadFailure]
}>()

const { t } = useI18n()
const { busy, download } = useTimelineDownload(() => props.orgSlug)

const open = shallowRef(false)
const menuId = useId()
const rootRef = useTemplateRef<HTMLElement>('root')
const triggerRef = useTemplateRef<HTMLButtonElement>('trigger')
const menuRef = useTemplateRef<HTMLElement>('menu')

const isBusy = computed(() => busy.value !== null)
const triggerLabel = computed(() => isBusy.value
  ? t('dashboard.timelines.actions.downloading')
  : t('dashboard.timelines.actions.download'))

const items = computed<Array<{ kind: TimelineDownloadKind, label: string, hint: string }>>(() => [
  {
    kind: 'bundle',
    label: t('dashboard.timelines.actions.download_bundle'),
    hint: t('dashboard.timelines.download.bundle_hint')
  },
  {
    kind: 'show',
    label: t('dashboard.timelines.actions.download_show'),
    hint: t('dashboard.timelines.download.show_hint')
  }
])

// ---- open / close ----
function menuItems(): HTMLElement[] {
  return Array.from(menuRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
}

/** Focuses the item at `index`, wrapping around (so `-1` is the last one). */
function focusItem(index: number) {
  const els = menuItems()
  if (els.length === 0) return
  els[((index % els.length) + els.length) % els.length]?.focus()
}

async function openMenu(focusLast = false) {
  if (isBusy.value || open.value) return
  open.value = true
  await nextTick()
  focusItem(focusLast ? -1 : 0)
}

function closeMenu(restoreFocus = false) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) triggerRef.value?.focus()
}

function toggleMenu() {
  if (open.value) closeMenu()
  else void openMenu()
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    void openMenu()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    void openMenu(true)
  }
}

function onMenuKeydown(e: KeyboardEvent) {
  const current = menuItems().indexOf(document.activeElement as HTMLElement)
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); focusItem(current + 1); break
    case 'ArrowUp': e.preventDefault(); focusItem(current - 1); break
    case 'Home': e.preventDefault(); focusItem(0); break
    case 'End': e.preventDefault(); focusItem(-1); break
    case 'Escape': e.preventDefault(); closeMenu(true); break
    case 'Tab': closeMenu(); break
  }
}

/**
 * Closes when focus moves to an element outside the trigger + menu (Tab, Shift+Tab).
 * A `null` relatedTarget is ignored on purpose: Safari and Firefox on macOS do not focus
 * a clicked button, so a click on a menu item blurs the previous item first; closing
 * here would remove the target before its `click` fires. Clicks outside are handled by
 * the document `pointerdown` listener instead.
 */
function onFocusOut(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (!next || rootRef.value?.contains(next)) return
  closeMenu()
}

function onDocumentPointerDown(e: PointerEvent) {
  if (!rootRef.value?.contains(e.target as Node)) closeMenu()
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onDocumentPointerDown)
  else document.removeEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

// ---- download ----
async function pick(kind: TimelineDownloadKind) {
  closeMenu(true)
  const failure = await download(props.timeline, kind)
  if (failure) emit('error', failure)
}
</script>

<template>
  <div ref="root" class="relative" @focusout="onFocusOut">
    <button
      ref="trigger"
      type="button"
      class="trigger"
      :class="{ 'is-busy': isBusy }"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      :aria-disabled="isBusy || undefined"
      :aria-busy="isBusy || undefined"
      @click="toggleMenu"
      @keydown="onTriggerKeydown"
    >
      <DashboardIcon name="download" :size="14" />
      <span>{{ triggerLabel }}</span>
      <DashboardIcon name="caret" :size="12" class="caret" />
    </button>

    <div
      v-show="open"
      :id="menuId"
      ref="menu"
      role="menu"
      class="menu"
      :aria-label="t('dashboard.timelines.download.menu_label', { name: timeline.name })"
      @keydown="onMenuKeydown"
    >
      <button
        v-for="item in items"
        :key="item.kind"
        type="button"
        role="menuitem"
        tabindex="-1"
        class="menu-item"
        @click="pick(item.kind)"
      >
        <span class="menu-item-label">{{ item.label }}</span>
        <span class="menu-item-hint">{{ item.hint }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Same metrics as `.row-btn` in TimelinesBoard.vue so the row reads as one button group. */
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .15s, border-color .15s, color .15s;
}
.trigger:hover { background: var(--c-bg-soft); }
.trigger[aria-expanded="true"] { background: var(--c-bg-soft); border-color: var(--c-line-strong); }
.trigger.is-busy { opacity: .6; cursor: progress; }
.trigger:focus-visible,
.menu-item:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}
.caret { color: var(--c-ink-muted); }

.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 30;
  min-width: 260px;
  max-width: calc(100vw - 24px);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  box-shadow: var(--shadow-md, 0 6px 20px rgba(0, 0, 0, .08));
}
.menu-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--c-ink);
  text-align: left;
  cursor: pointer;
  transition: background .12s;
}
.menu-item:hover { background: var(--c-bg-soft); }
.menu-item-label { font-size: 13px; font-weight: 500; }
.menu-item-hint { font-size: 11.5px; line-height: 1.35; color: var(--c-ink-muted); }
</style>
