<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  back?: { label: string; to: string }
}>()
</script>

<template>
  <div class="auth-screen flex w-full max-w-[420px] flex-col">
    <NuxtLink
      v-if="back"
      :to="back.to"
      class="back -ml-2 mb-7 inline-flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-[13px] text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
      </svg>
      {{ back.label }}
    </NuxtLink>

    <div v-if="$slots.icon" class="mb-5">
      <slot name="icon" />
    </div>

    <header class="mb-8 text-left">
      <h1 class="text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
        {{ title }}
      </h1>
      <p v-if="subtitle || $slots.subtitle" class="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </header>

    <slot />

    <footer v-if="$slots.foot" class="mt-6 text-center text-[13.5px] text-ink-soft">
      <slot name="foot" />
    </footer>
  </div>
</template>

<style scoped>
.auth-screen {
  animation: auth-fade .35s ease both;
}
@keyframes auth-fade {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .auth-screen { animation-duration: .001s; }
}
</style>
