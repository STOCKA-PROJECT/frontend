<script setup lang="ts">
import { shallowRef } from 'vue'

withDefaults(defineProps<{
  id: string
  label: string
  modelValue: string
  placeholder?: string
  autocomplete?: string
  required?: boolean
  disabled?: boolean
  showStrength?: boolean
}>(), {
  showStrength: false
})

defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const show = shallowRef(false)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div :class="$slots['right-link'] ? 'flex items-baseline justify-between' : ''">
      <label :for="id" class="text-[12.5px] font-medium tracking-[-0.005em] text-ink-soft">
        {{ label }}
      </label>
      <slot name="right-link" />
    </div>

    <div class="relative">
      <input
        :id="id"
        :type="show ? 'text' : 'password'"
        :value="modelValue"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :required="required"
        :disabled="disabled"
        class="h-11 w-full rounded-[10px] border border-line bg-field pl-3.5 pr-12 text-[16px] text-ink outline-none transition-[border-color,background,box-shadow] duration-150 placeholder:text-ink-muted hover:border-line-strong focus:border-accent focus:bg-field-focus disabled:opacity-50 sm:text-[14.5px]"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
      <button
        type="button"
        class="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink-soft"
        :aria-label="show ? t('auth.hide_password') : t('auth.show_password')"
        @click="show = !show"
      >
        <svg v-if="show" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9.88 5.08A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.5 3.2M6.6 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 4.1-.8" />
          <path d="m3 3 18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>

    <AuthPasswordStrength v-if="showStrength && modelValue" :value="modelValue" />
  </div>
</template>

<style scoped>
input:focus {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c-accent) 18%, transparent);
}
</style>
