<script setup lang="ts">
import QRCode from 'qrcode'

const props = defineProps<{
  open: boolean
  pieceId: number
  pieceName: string
  serialNumber?: string | null
  orgSlug: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const toast = useToastStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const compositeCanvasRef = ref<HTMLCanvasElement | null>(null)
const shareUrl = ref('')
const canCopyImage = ref(false)

const subtitle = computed(() => {
  return props.serialNumber
    ? `${props.pieceName} · #${props.serialNumber}`
    : props.pieceName
})

onMounted(() => {
  canCopyImage.value = typeof window !== 'undefined' && 'ClipboardItem' in window
})

watch(() => props.open, async (open) => {
  if (!open) return
  shareUrl.value = `${window.location.origin}/dashboard/${props.orgSlug}/articulos/${props.pieceId}`
  await nextTick()
  if (canvasRef.value) {
    await QRCode.toCanvas(canvasRef.value, shareUrl.value, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M'
    })
  }
  await renderCompositeCanvas()
})

async function renderCompositeCanvas() {
  const canvas = compositeCanvasRef.value
  if (!canvas) return
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  const width = 360
  const height = props.serialNumber ? 440 : 410
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#0f172a'
  ctx.font = '600 18px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  const nameText = truncateForCanvas(ctx, props.pieceName, width - 32)
  ctx.fillText(nameText, width / 2, 36)

  if (props.serialNumber) {
    ctx.fillStyle = '#64748b'
    ctx.font = '500 13px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    ctx.fillText(`#${props.serialNumber}`, width / 2, 60)
  }

  const qrSize = 288
  const qrY = props.serialNumber ? 80 : 60
  const tmp = document.createElement('canvas')
  await QRCode.toCanvas(tmp, shareUrl.value, {
    width: qrSize,
    margin: 2,
    errorCorrectionLevel: 'M'
  })
  ctx.drawImage(tmp, (width - qrSize) / 2, qrY, qrSize, qrSize)
}

function truncateForCanvas(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  const ellipsis = '…'
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo) + ellipsis
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function copyImage() {
  const canvas = compositeCanvasRef.value
  if (!canvas) return
  if (!('ClipboardItem' in window)) {
    toast.push({ type: 'info', description: t('dashboard.pieces.qr.image_copy_unsupported') })
    return
  }
  canvas.toBlob(async (blob) => {
    if (!blob) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.push({ type: 'success', description: t('dashboard.pieces.qr.image_copied') })
    } catch {
      toast.push({ type: 'info', description: t('dashboard.pieces.qr.image_copy_unsupported') })
    }
  }, 'image/png')
}

function downloadImage() {
  const canvas = compositeCanvasRef.value
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const slug = slugify(props.pieceName) || 'articulo'
    a.download = `qr-${slug}-${props.pieceId}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    toast.push({ type: 'success', description: t('dashboard.pieces.qr.link_copied') })
  } catch {
    toast.push({ type: 'error', description: t('dashboard.pieces.qr.copy_error') })
  }
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function selectInput(e: FocusEvent) {
  const target = e.target as HTMLInputElement | null
  target?.select()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="dialog-backdrop"
      role="presentation"
      @click="onBackdropClick"
      @keydown="onKey"
    >
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="t('dashboard.pieces.qr.title')"
        class="flex w-full max-w-[420px] max-h-[calc(100vh-24px)] flex-col rounded-[14px] border border-line bg-bg-card shadow-card"
      >
        <div class="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">
            {{ t('dashboard.pieces.qr.title') }}
          </h2>
          <p class="mt-1 truncate text-[13px] text-ink-soft">
            {{ subtitle }}
          </p>

          <div class="qr-frame mt-4">
            <canvas
              ref="canvasRef"
              :aria-label="t('dashboard.pieces.qr.aria_canvas', { name: pieceName })"
            />
          </div>
          <canvas ref="compositeCanvasRef" class="composite-canvas" />

          <label class="mt-4 block text-[12.5px] font-medium text-ink-soft">
            {{ t('dashboard.pieces.qr.link_label') }}
          </label>
          <div class="mt-1 flex items-stretch gap-2">
            <input
              type="text"
              readonly
              :value="shareUrl"
              class="link-input"
              @focus="selectInput"
            >
            <button type="button" class="dialog-btn link-copy" @click="copyLink">
              {{ t('dashboard.pieces.qr.copy_link') }}
            </button>
          </div>
        </div>

        <footer class="flex-shrink-0 border-t border-line px-5 py-4 sm:px-6">
          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" class="dialog-btn" @click="emit('close')">
              {{ t('common.close') }}
            </button>
            <button v-if="canCopyImage" type="button" class="dialog-btn" @click="copyImage">
              {{ t('dashboard.pieces.qr.copy_image') }}
            </button>
            <button type="button" class="dialog-btn dialog-btn-primary" @click="downloadImage">
              {{ t('dashboard.pieces.qr.download') }}
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
.qr-frame {
  display: flex;
  justify-content: center;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: #ffffff;
}
.qr-frame canvas {
  display: block;
  width: 256px;
  height: 256px;
  max-width: 100%;
}
.composite-canvas { display: none; }
.link-input {
  flex: 1 1 0;
  min-width: 0;
  height: 38px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-soft);
  color: var(--c-ink);
  font-size: 12.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.link-input:focus {
  outline: none;
  border-color: var(--c-ink);
}
.link-copy {
  height: 38px;
  padding: 0 14px;
  font-size: 12.5px;
}
</style>
