<script setup lang="ts">
const { t } = useI18n()

interface Item {
  title: string
  meta: string
  owner: string
  status: 'active' | 'review'
  thumbStyle?: string
}

const items: Item[] = [
  {
    title: 'Portátil Dell Latitude',
    meta: 'Sala 2 · Arm. B-03',
    owner: 'L. Méndez',
    status: 'active'
  },
  {
    title: 'Proyector Epson EB-L200',
    meta: 'Sala reuniones · Est. A',
    owner: 'Dpto. Marketing',
    status: 'review',
    thumbStyle: 'background:linear-gradient(135deg,#ead9c9,#d8c9bd)'
  },
  {
    title: 'Cámara Sony A7 III',
    meta: 'Almacén · Cajón 4',
    owner: 'J. Torres',
    status: 'active',
    thumbStyle: 'background:linear-gradient(135deg,#d3dde6,#cdd2da)'
  }
]

const stats = computed(() => [
  { label: t('mock.stats.items'), value: '1 284' },
  { label: t('mock.stats.locations'), value: '12' },
  { label: t('mock.stats.owners'), value: '8' }
])
</script>

<template>
  <div
    class="mock overflow-hidden rounded-2xl border border-line bg-bg-card shadow-elevated
           [transform:perspective(900px)_rotateY(var(--tilt-x))_rotateX(var(--tilt-y))]
           animate-floaty transition-transform duration-[400ms] ease-ease"
    aria-hidden="true"
  >
    <div class="flex items-center gap-3 border-b border-line bg-bg-alt px-4 py-3">
      <div class="flex gap-1.5">
        <span class="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span class="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span class="h-2.5 w-2.5 rounded-full bg-line-strong" />
      </div>
      <div class="flex h-6 flex-1 items-center rounded-md bg-bg px-2.5 font-mono text-[11.5px] text-ink-muted">
        stocka.com / inventario
      </div>
    </div>

    <div class="flex flex-col gap-3.5 p-5">
      <div class="mb-1.5 flex items-center justify-between">
        <h3 class="text-[15px] font-semibold">
          {{ t('mock.header_title') }}
          <span class="ml-1.5 text-[13px] font-normal text-ink-muted">{{ t('mock.header_count') }}</span>
        </h3>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium text-accent-ink">
          <span class="h-[5px] w-[5px] rounded-full bg-accent animate-pulse-dot" />
          {{ t('mock.synced') }}
        </span>
      </div>

      <div class="mb-2 grid grid-cols-3 gap-2.5 max-[520px]:grid-cols-2">
        <div
          v-for="(stat, i) in stats"
          :key="stat.label"
          class="mock-stat relative overflow-hidden rounded-[10px] border border-line bg-bg px-3.5 py-3"
          :class="{ 'max-[520px]:hidden': i === 2 }"
        >
          <div class="mb-1 text-[11px] text-ink-muted">
            {{ stat.label }}
          </div>
          <div class="text-xl font-semibold tracking-tighter">
            {{ stat.value }}
          </div>
        </div>
      </div>

      <div
        v-for="item in items"
        :key="item.title"
        class="mock-row flex items-center gap-3 rounded-lg border border-line bg-bg p-2.5"
      >
        <div
          class="h-8 w-8 shrink-0 rounded-md"
          :style="item.thumbStyle ?? 'background:linear-gradient(135deg,var(--c-accent-soft),var(--c-line-strong))'"
        />
        <div class="min-w-0 flex-1">
          <strong class="block text-[13px] font-medium text-ink">{{ item.title }}</strong>
          <span class="font-mono text-[11.5px] text-ink-muted">{{ item.meta }}</span>
        </div>
        <div class="text-[13px] tabular-nums text-ink-soft">
          {{ item.owner }}
        </div>
        <span
          class="rounded px-2 py-0.5 text-[11px]"
          :class="item.status === 'review' ? 'bg-warn-bg text-warn-ink' : 'bg-bg-alt text-ink-soft'"
        >
          {{ t(`mock.status.${item.status}`) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mock {
  --tilt-x: 0deg;
  --tilt-y: 0deg;
}
.mock.tilting { animation: none; }

.mock-stat::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 2px;
  background: var(--c-accent);
  transform-origin: left;
  transform: scaleX(0);
}
.in-view .mock-stat::after { animation: countBar 1.1s .6s cubic-bezier(.2, .7, .2, 1) both; }
.in-view .mock-stat:nth-child(2)::after { animation-delay: .75s; }
.in-view .mock-stat:nth-child(3)::after { animation-delay: .9s; }

@keyframes countBar {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.in-view .mock-row { animation: revealStagger .6s cubic-bezier(.2, .7, .2, 1) both; }
.in-view .mock-row:nth-child(4) { animation-delay: .3s; }
.in-view .mock-row:nth-child(5) { animation-delay: .42s; }
.in-view .mock-row:nth-child(6) { animation-delay: .54s; }

@keyframes revealStagger {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
