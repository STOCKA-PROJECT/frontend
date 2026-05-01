<script setup lang="ts">
import type { OrganizationRole } from '~/types/api'

defineProps<{
  role: OrganizationRole
}>()

const { t } = useI18n()
</script>

<template>
  <span class="role-chip" :class="`role-chip--${role.toLowerCase()}`">
    {{ t(`dashboard.org.roles.${role}`) }}
  </span>
</template>

<style scoped>
.role-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 9px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
  white-space: nowrap;
  border: 1px solid transparent;
}
.role-chip--owner {
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
}
.role-chip--manager {
  background: var(--c-bg-card);
  color: var(--c-ink);
  border-color: var(--c-line-strong);
}
.role-chip--user {
  background: var(--c-bg-soft);
  color: var(--c-ink);
}
.role-chip--spectator {
  background: var(--c-bg-soft);
  color: var(--c-ink-muted);
}
</style>
