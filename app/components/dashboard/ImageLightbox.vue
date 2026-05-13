<script setup lang="ts">
// Reusable image lightbox shared between the pieces listing, the piece
// detail header and the attachments gallery. Renders a single image inside
// a Teleport-ed dialog with focus management, body scroll lock and Escape
// support. Browser-only side effects are guarded with `import.meta.client`.

const open = defineModel<boolean>('open', { default: false })

defineProps<{
  url: string | null
  name?: string
}>()

const { t } = useI18n()

const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
const previousActiveElement = shallowRef<HTMLElement | null>(null)

function close() {
  open.value = false
}

function onOverlayClick() {
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

watch(open, async (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    previousActiveElement.value = (document.activeElement as HTMLElement | null) ?? null
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    closeButton.value?.focus()
  } else {
    document.body.style.overflow = ''
    document.removeEventListener('keydown', onKeydown)
    previousActiveElement.value?.focus?.()
    previousActiveElement.value = null
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="name ?? ''"
      @click.self="onOverlayClick"
    >
      <img
        v-if="url"
        :src="url"
        :alt="name ?? ''"
        class="lightbox-image"
      >
      <button
        ref="closeButton"
        type="button"
        class="lightbox-close"
        :aria-label="t('common.close')"
        @click.stop="close"
      >
        <DashboardIcon name="x" :size="18" />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--c-ink) 70%, transparent);
  padding: 32px;
}
.lightbox-image {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-shadow: 0 18px 36px -8px rgba(0,0,0,.4);
}
.lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.2);
  background: rgba(0,0,0,.45);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lightbox-close:hover { background: rgba(0,0,0,.7); }
.lightbox-close:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
</style>
