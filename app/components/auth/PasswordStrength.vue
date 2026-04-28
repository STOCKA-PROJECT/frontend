<script setup lang="ts">
const props = defineProps<{ value: string }>()
const { t } = useI18n()

const level = computed(() => scorePassword(props.value))
const label = computed(() => {
  const key = STRENGTH_KEYS[level.value]
  return key ? t(key) : ''
})
</script>

<template>
  <div class="mt-1 flex flex-col gap-1.5" :data-level="level">
    <div class="strength-bars flex gap-1">
      <span v-for="i in 4" :key="i" class="h-1 flex-1 rounded-full bg-line transition-colors duration-200" />
    </div>
    <div class="flex items-baseline justify-between text-xs text-ink-muted">
      <span>{{ t('auth.strength.label') }}</span>
      <em
        class="not-italic font-medium"
        :class="{
          'text-ink-soft': level === 0,
          'text-danger': level === 1,
          'text-warn': level === 2 || level === 3,
          'text-accent-ink': level === 4
        }"
      >{{ label }}</em>
    </div>
  </div>
</template>

<style scoped>
[data-level="1"] .strength-bars span:nth-child(-n+1) { background: var(--c-danger); }
[data-level="2"] .strength-bars span:nth-child(-n+2) { background: var(--c-warn); }
[data-level="3"] .strength-bars span:nth-child(-n+3) { background: var(--c-warn); }
[data-level="4"] .strength-bars span:nth-child(-n+4) { background: var(--c-ok); }
</style>
