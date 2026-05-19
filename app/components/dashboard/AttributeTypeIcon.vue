<script setup lang="ts">
import type { AttributeType } from '~/types/api'

withDefaults(defineProps<{
  type: AttributeType
  size?: number
}>(), { size: 14 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="type === 'TEXT'">
      <path d="M4 7h16" />
      <path d="M4 12h10" />
      <path d="M4 17h7" />
    </template>
    <template v-else-if="type === 'LONGTEXT'">
      <path d="M4 6h16" />
      <path d="M4 10h16" />
      <path d="M4 14h12" />
      <path d="M4 18h9" />
    </template>
    <template v-else-if="type === 'INTEGER'">
      <line x1="5" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="19" y2="15" />
      <line x1="10" y1="4" x2="8" y2="20" />
      <line x1="16" y1="4" x2="14" y2="20" />
    </template>
    <template v-else-if="type === 'DECIMAL'">
      <circle cx="6.5" cy="7.5" r="1.5" />
      <line x1="19" y1="5" x2="6" y2="19" />
      <circle cx="17.5" cy="16.5" r="1.5" />
    </template>
    <template v-else-if="type === 'PRICE'">
      <path d="M20.6 12.6 12.4 20.8a2 2 0 0 1-2.8 0L2.6 13.8a2 2 0 0 1-.6-1.4V4a2 2 0 0 1 2-2h8.4a2 2 0 0 1 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </template>
    <template v-else-if="type === 'DATE'">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="3" y1="11" x2="21" y2="11" />
    </template>
    <template v-else-if="type === 'DATETIME'">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="3" y1="11" x2="21" y2="11" />
      <circle cx="16" cy="16" r="2.5" />
      <path d="M16 14.6V16l1 .9" />
    </template>
    <template v-else-if="type === 'BOOLEAN'">
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <circle cx="16.5" cy="12" r="2.7" />
    </template>
    <template v-else-if="type === 'SELECT'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <polyline points="9 11 12 14 15 11" />
    </template>
    <template v-else-if="type === 'MULTI_SELECT'">
      <rect x="3" y="3.5" width="6" height="6" rx="1" />
      <polyline points="4.5 6.4 5.7 7.6 8 5.2" />
      <line x1="12" y1="6.5" x2="21" y2="6.5" />
      <rect x="3" y="14.5" width="6" height="6" rx="1" />
      <polyline points="4.5 17.4 5.7 18.6 8 16.2" />
      <line x1="12" y1="17.5" x2="21" y2="17.5" />
    </template>
    <template v-else-if="type === 'URL'">
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </template>
    <template v-else-if="type === 'EMAIL'">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </template>
    <template v-else-if="type === 'MEMBER'">
      <circle cx="12" cy="9" r="3.5" />
      <circle cx="12" cy="12" r="9.5" />
      <path d="M5.5 19c1.4-2.6 4-3.8 6.5-3.8s5.1 1.2 6.5 3.8" />
    </template>
  </svg>
</template>
