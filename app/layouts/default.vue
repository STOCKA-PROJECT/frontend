<script setup lang="ts">
const { t } = useI18n()
useReveal()
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a href="#main" class="skip-link">{{ t('common.skip_to_content') }}</a>
    <TheNav />
    <main id="main" class="flex-1">
      <slot />
    </main>
    <TheFooter />
  </div>
</template>
