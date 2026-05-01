<script setup lang="ts">
import type { OrganizationRole } from '~/types/api'

withDefaults(defineProps<{
  modelValue: OrganizationRole
  availableRoles: OrganizationRole[]
  id?: string
  disabled?: boolean
}>(), {
  disabled: false
})

defineEmits<{
  'update:modelValue': [value: OrganizationRole]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="role-select-wrap">
    <select
      :id="id"
      :value="modelValue"
      :disabled="disabled"
      class="role-select"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value as OrganizationRole)"
    >
      <option v-for="r in availableRoles" :key="r" :value="r">
        {{ t(`dashboard.org.roles.${r}`) }}
      </option>
    </select>
    <span aria-hidden="true" class="role-select-caret">
      <DashboardIcon name="caret" :size="14" />
    </span>
  </div>
</template>

<style scoped>
.role-select-wrap {
  position: relative;
  display: block;
  width: 100%;
}
.role-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 44px;
  padding: 0 38px 0 14px;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-field);
  color: var(--c-ink);
  font-size: 14.5px;
  outline: none;
  transition: border-color .15s, background .15s, box-shadow .15s;
  cursor: pointer;
}
.role-select:hover:not(:disabled) { border-color: var(--c-line-strong); }
.role-select:focus {
  border-color: var(--c-accent);
  background: var(--c-field-focus);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c-accent) 18%, transparent);
}
.role-select:disabled { opacity: .5; cursor: not-allowed; }
.role-select-caret {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--c-ink-muted);
}
</style>
