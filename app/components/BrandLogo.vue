<script setup lang="ts">
const props = withDefaults(defineProps<{ to?: string; size?: number; ariaLabel?: string }>(), {
  to: '/',
  size: 24,
  ariaLabel: 'Stocka — Inicio'
})

const localePath = useLocalePath()
const href = computed(() => localePath(props.to))
</script>

<template>
  <NuxtLink
    :to="href"
    :aria-label="ariaLabel"
    class="brand inline-flex items-center gap-2.5 text-base font-semibold tracking-tightish text-inherit"
  >
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      class="text-ink"
    >
      <rect x="2" y="2" width="36" height="36" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.25" />
      <rect x="8" y="8" width="24" height="24" rx="4" stroke="currentColor" stroke-width="1.5" opacity="0.55" />
      <rect x="14" y="14" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
    <span>Stocka</span>
  </NuxtLink>
</template>

<style scoped>
.brand svg rect {
  transition: opacity .25s, transform .5s cubic-bezier(.2, .7, .2, 1);
  transform-origin: center;
}
.brand:hover svg rect:nth-child(1) { transform: rotate(8deg); opacity: .5; }
.brand:hover svg rect:nth-child(2) { transform: rotate(-4deg); opacity: .85; }
</style>
