<script setup lang="ts">
import { createLedAnimation, createLedFill, placeInTarget, type LedAnimator, type Rgb } from '~/utils/ledPreview'

/**
 * Animated strip of LEDs that approximates what the device will show for an LED action: the
 * animation fixed on the action (or a solid fill), on a target of `pixels` LEDs. Purely
 * cosmetic: the device remains the reference. Same engine as the timeline editor.
 */
const props = defineProps<{
  action: 'animate' | 'fill' | 'clear'
  animation?: string | null
  /** Parameters already coerced to catalog values (`[r, g, b]` colours, numbers). */
  params: Record<string, unknown>
  pixels: number
  durationSec?: number | null
  first?: number | null
  last?: number | null
}>()

const { t } = useI18n()
const canvas = ref<HTMLCanvasElement | null>(null)
const playing = ref(true)
const built = ref(0)
let animator: LedAnimator | null = null
let raf = 0
let lastTs = 0

const unsupported = computed(() => props.action === 'animate' && !!props.animation && animator === null && built.value > 0)

function build() {
  const opts = { pixels: props.pixels, durationSec: props.durationSec ?? null, first: props.first ?? null, last: props.last ?? null }
  if (props.action === 'fill') {
    const color = props.params.color
    animator = createLedFill(Array.isArray(color) ? (color as Rgb) : [0, 0, 0], opts)
  } else if (props.action === 'clear') {
    animator = createLedFill([0, 0, 0], opts)
  } else {
    animator = props.animation ? createLedAnimation(props.animation, props.params, opts) : null
  }
  built.value++
  lastTs = 0
  draw(0)
}

function draw(dtSec: number) {
  const el = canvas.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return
  const width = el.clientWidth || 320
  if (el.width !== width) el.width = width
  const height = el.height
  ctx.fillStyle = '#101214'
  ctx.fillRect(0, 0, width, height)
  if (!animator) return
  const frame = placeInTarget(animator.step(dtSec), { pixels: props.pixels, first: props.first ?? null, last: props.last ?? null })
  const slot = width / frame.length
  const gap = slot > 3 ? 1 : 0
  frame.forEach(([r, g, b], i) => {
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(Math.floor(i * slot), 2, Math.max(1, Math.ceil(slot - gap)), height - 4)
  })
}

function tick(ts: number) {
  if (!playing.value) return
  const dt = lastTs ? (ts - lastTs) / 1000 : 0
  lastTs = ts
  draw(dt)
  raf = requestAnimationFrame(tick)
}

function start() {
  cancelAnimationFrame(raf)
  lastTs = 0
  if (playing.value) raf = requestAnimationFrame(tick)
}

function togglePlay() {
  playing.value = !playing.value
  if (playing.value) start()
  else cancelAnimationFrame(raf)
}

watch(() => [props.action, props.animation, props.params, props.pixels, props.durationSec, props.first, props.last], () => {
  build()
  start()
}, { deep: true })

onMounted(() => {
  build()
  start()
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="flex flex-col gap-1.5 rounded-[10px] border border-line bg-bg-card p-3">
    <div class="flex items-center justify-between">
      <span class="section-label">{{ t('dashboard.pieceTypes.action_form.preview_title') }}</span>
      <button type="button" class="text-[12px] text-ink-muted hover:text-ink" @click="togglePlay">
        {{ playing ? t('dashboard.pieceTypes.action_form.preview_pause') : t('dashboard.pieceTypes.action_form.preview_play') }}
      </button>
    </div>
    <canvas ref="canvas" class="h-6 w-full rounded-[4px] border border-line" height="24" />
    <p v-if="unsupported" class="field-help">{{ t('dashboard.pieceTypes.action_form.preview_unsupported') }}</p>
    <p v-else class="field-help">{{ t('dashboard.pieceTypes.action_form.preview_hint', { n: pixels }) }}</p>
  </div>
</template>
