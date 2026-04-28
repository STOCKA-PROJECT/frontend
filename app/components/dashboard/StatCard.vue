<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  iconName?: string
  loading?: boolean
}>()
</script>

<template>
  <div class="flex flex-col gap-1.5 rounded-[12px] border border-line bg-bg-card px-[18px] pb-4 pt-[18px] transition-[border-color] duration-150 hover:border-line-strong">
    <div class="flex items-center justify-between text-[12.5px] font-medium text-ink-soft">
      <span>{{ label }}</span>
      <DashboardIcon v-if="iconName" :name="iconName" :size="14" />
    </div>
    <div class="text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] tabular-nums text-ink min-h-[34px]">
      <template v-if="loading">
        <span class="inline-block h-7 w-12 animate-pulse rounded bg-bg-soft" />
      </template>
      <template v-else>
        {{ value }}
      </template>
    </div>
    <div class="flex items-center gap-1.5 text-[12px] text-ink-muted">
      <slot name="meta" />
    </div>
  </div>
</template>
