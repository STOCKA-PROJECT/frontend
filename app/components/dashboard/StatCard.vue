<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  iconName?: string
  loading?: boolean
}>()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5 rounded-[12px] border border-line bg-bg-card px-[18px] pb-4 pt-[18px] transition-[border-color] duration-150 hover:border-line-strong">
    <div class="flex items-center justify-between gap-2 text-[12.5px] font-medium text-ink-soft">
      <span class="truncate">{{ label }}</span>
      <DashboardIcon v-if="iconName" :name="iconName" :size="14" />
    </div>
    <div class="min-h-[34px] truncate text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] tabular-nums text-ink">
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
