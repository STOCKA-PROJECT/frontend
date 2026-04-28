<script setup lang="ts">
defineProps<{
  id: string
  modelValue: boolean
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <label :for="id" class="check relative flex cursor-pointer select-none items-start gap-2.5">
    <input
      :id="id"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="check-input pointer-events-none absolute opacity-0"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    >
    <span
      class="check-box mt-px flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] border border-line-strong bg-field transition-all duration-150"
      aria-hidden="true"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" class="check-mark text-white">
        <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <span class="text-[13px] leading-relaxed text-ink-soft">
      <slot />
    </span>
  </label>
</template>

<style scoped>
.check-mark {
  opacity: 0;
  transform: scale(.7);
  transition: all .15s;
}
.check-input:checked + .check-box {
  background: var(--c-accent);
  border-color: var(--c-accent);
}
.check-input:checked + .check-box .check-mark {
  opacity: 1;
  transform: scale(1);
}
.check-input:focus-visible + .check-box {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c-accent) 25%, transparent);
}
</style>
