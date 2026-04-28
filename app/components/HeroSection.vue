<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

const { t } = useI18n()
const localePath = useLocalePath()

const heroRef = useTemplateRef<HTMLElement>('heroRef')
const mockComp = useTemplateRef<ComponentPublicInstance>('mockComp')

let cleanup: (() => void) | null = null

onMounted(() => {
  const hero = heroRef.value
  const mock = mockComp.value?.$el as HTMLElement | undefined
  if (!hero || !mock) return

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const touch = matchMedia('(hover: none)').matches
  if (reduce || touch) return

  let raf = 0
  let tx = 0
  let ty = 0
  const apply = () => {
    raf = 0
    mock.style.setProperty('--tilt-x', tx + 'deg')
    mock.style.setProperty('--tilt-y', ty + 'deg')
  }
  const onMove = (e: MouseEvent) => {
    const r = hero.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    tx = px * 6
    ty = py * -6
    mock.classList.add('tilting')
    if (!raf) raf = requestAnimationFrame(apply)
  }
  const onLeave = () => {
    tx = 0
    ty = 0
    mock.classList.remove('tilting')
    if (!raf) raf = requestAnimationFrame(apply)
  }
  hero.addEventListener('mousemove', onMove)
  hero.addEventListener('mouseleave', onLeave)
  cleanup = () => {
    hero.removeEventListener('mousemove', onMove)
    hero.removeEventListener('mouseleave', onLeave)
    if (raf) cancelAnimationFrame(raf)
  }
})

onBeforeUnmount(() => { cleanup?.() })
</script>

<template>
  <section ref="heroRef" class="relative overflow-hidden pt-20 pb-16 max-md:pt-14 max-md:pb-10">
    <div class="wrap">
      <div class="grid items-center gap-[72px] lg:grid-cols-[1.05fr_1fr] max-lg:gap-12">
        <div>
          <EyebrowBadge class="reveal mb-5">
            {{ t('hero.eyebrow') }}
          </EyebrowBadge>
          <h1
            class="reveal d1 mb-5 font-semibold leading-[1.02] tracking-tighter3"
            style="font-size: clamp(40px, 5.6vw, 64px);"
          >
            {{ t('hero.title_a') }}
            <em class="not-italic font-semibold text-accent-ink">{{ t('hero.title_b') }}</em>
            {{ t('hero.title_c') }}
          </h1>
          <p class="reveal d2 mb-8 max-w-[520px] text-[17px] leading-relaxed text-ink-soft max-md:text-base">
            {{ t('hero.sub') }}
          </p>
          <div class="reveal d3 mb-6 flex flex-wrap items-center gap-2.5">
            <NuxtLink class="btn btn-primary btn-lg" :to="localePath('/registro')">
              {{ t('hero.cta_primary') }}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </NuxtLink>
            <a class="btn btn-outline btn-lg" href="#how">{{ t('hero.cta_secondary') }}</a>
          </div>
          <ul class="reveal d4 flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
            <li class="font-medium text-ink-soft">{{ t('hero.trial') }}</li>
            <li aria-hidden="true" class="h-[3px] w-[3px] rounded-full bg-ink-muted" />
            <li>{{ t('hero.no_card') }}</li>
            <li aria-hidden="true" class="h-[3px] w-[3px] rounded-full bg-ink-muted" />
            <li>{{ t('hero.cancel') }}</li>
          </ul>
        </div>

        <div class="reveal-right block">
          <MockDashboard ref="mockComp" />
        </div>
      </div>
    </div>
  </section>
</template>
