<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <section class="py-24 max-md:py-[72px]" :aria-label="t('testimonial.label')">
    <div class="wrap">
      <figure class="mx-auto max-w-[780px] text-center">
        <EyebrowBadge class="mb-6">
          {{ t('testimonial.eyebrow') }}
        </EyebrowBadge>
        <blockquote
          class="mb-6 font-medium leading-snug tracking-tighter2 text-ink"
          style="font-size: clamp(22px, 2.6vw, 30px);"
        >
          {{ t('testimonial.quote') }}
        </blockquote>
        <figcaption class="text-sm text-ink-soft">
          <span class="block font-medium text-ink">{{ t('testimonial.author') }}</span>
          {{ t('testimonial.role') }}
        </figcaption>
      </figure>
    </div>
  </section>
</template>
