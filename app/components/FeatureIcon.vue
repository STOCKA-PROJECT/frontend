<script setup lang="ts">
export type FeatureIconName =
  | 'item'
  | 'location'
  | 'owner'
  | 'category'
  | 'label'
  | 'history'

withDefaults(defineProps<{ name: FeatureIconName; size?: number }>(), {
  size: 20
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'item'">
      <path d="M3 7v10a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 17V7a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 7Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </template>
    <template v-else-if="name === 'location'">
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      <path d="M12 7v5l3 2" />
    </template>
    <template v-else-if="name === 'owner'">
      <path d="M10.3 3.9a2 2 0 0 1 3.4 0l8 13.2a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </template>
    <template v-else-if="name === 'category'">
      <path d="M3 3h18v4H3z" />
      <path d="M3 10h18v4H3z" />
      <path d="M3 17h18v4H3z" />
    </template>
    <template v-else-if="name === 'label'">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM18 14h3M14 18h3M18 18h3" />
    </template>
    <template v-else-if="name === 'history'">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 4 4 6-6" />
    </template>
  </svg>
</template>
