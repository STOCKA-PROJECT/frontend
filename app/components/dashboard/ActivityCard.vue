<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-5 py-12 text-center">
    <div class="flex h-12 w-12 items-center justify-center rounded-full bg-bg-soft text-ink-muted">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </div>
    <p class="max-w-[260px] text-[13.5px] text-ink-soft">
      <span class="block font-medium text-ink">{{ t('dashboard.activity.soon_title') }}</span>
      {{ t('dashboard.activity.soon_body') }}
    </p>
  </div>
</template>
