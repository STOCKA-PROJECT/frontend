<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <section class="pb-24 max-md:pb-[72px]" :aria-label="t('cta.label')">
    <div class="wrap">
      <div
        class="cta-card reveal rounded-[20px] bg-ink px-12 py-16 text-center text-bg-card max-md:px-7 max-md:py-12"
      >
        <h2 class="h-display mb-3 !text-bg-card">
          {{ t('cta.title') }}
        </h2>
        <p class="mx-auto mb-7 max-w-[520px] text-base leading-relaxed text-bg-card/75">
          {{ t('cta.sub') }}
        </p>
        <div class="flex flex-wrap justify-center gap-2.5">
          <NuxtLink class="btn btn-lg cta-btn-primary" :to="localePath('/registro')">{{ t('cta.primary') }}</NuxtLink>
          <NuxtLink class="btn btn-lg cta-btn-ghost" :to="localePath('/login')">{{ t('cta.secondary') }}</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cta-card {
  background-image:
    radial-gradient(circle at 20% 30%, color-mix(in oklab, var(--c-accent) 30%, transparent) 0%, transparent 55%),
    radial-gradient(circle at 85% 75%, color-mix(in oklab, var(--c-accent) 18%, transparent) 0%, transparent 50%);
}

.cta-btn-primary {
  background: var(--c-bg-card);
  color: var(--c-ink);
}
.cta-btn-primary:hover { background: #fff; }

.cta-btn-ghost {
  background: transparent;
  color: var(--c-bg-card);
}
.cta-btn-ghost:hover { background: color-mix(in oklab, var(--c-bg-card) 12%, transparent); }
</style>
