<script setup lang="ts">
defineProps<{
  title: string
  pill?: string | number
  linkLabel?: string
  linkTo?: string
}>()
</script>

<template>
  <section class="overflow-hidden rounded-[14px] border border-line bg-bg-card">
    <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
      <h3 class="flex items-center gap-2.5 text-[14.5px] font-semibold tracking-[-0.005em] text-ink">
        {{ title }}
        <span
          v-if="pill !== undefined"
          class="rounded-full bg-bg-soft px-2 py-px text-[11.5px] tabular-nums text-ink-soft"
        >{{ pill }}</span>
      </h3>
      <NuxtLink
        v-if="linkLabel && linkTo"
        :to="linkTo"
        class="text-[13px] text-ink-soft transition-colors hover:text-ink"
      >
        {{ linkLabel }}
      </NuxtLink>
    </header>
    <slot />
  </section>
</template>
