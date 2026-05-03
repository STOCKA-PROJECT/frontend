<script setup lang="ts">
withDefaults(defineProps<{
  id: string
  label: string
  modelValue: string
  type?: string
  placeholder?: string
  autocomplete?: string
  required?: boolean
  disabled?: boolean
  hint?: string
  hintTone?: 'muted' | 'ok' | 'danger'
  prefix?: string
  maxlength?: number
  spellcheck?: boolean
}>(), {
  type: 'text',
  hintTone: 'muted',
  spellcheck: true
})

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div :class="$slots['right-link'] ? 'flex items-baseline justify-between' : ''">
      <label :for="id" class="text-[12.5px] font-medium tracking-[-0.005em] text-ink-soft">
        {{ label }}
      </label>
      <slot name="right-link" />
    </div>

    <div
      v-if="prefix"
      class="field-prefix flex items-center overflow-hidden rounded-[10px] border border-line bg-field transition-[border-color,background,box-shadow] duration-150 hover:border-line-strong focus-within:border-accent focus-within:bg-field-focus"
    >
      <span class="select-none px-[10px] pl-[14px] text-[14.5px] tabular-nums text-ink-muted">
        {{ prefix }}
      </span>
      <input
        :id="id"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :required="required"
        :disabled="disabled"
        :maxlength="maxlength"
        :spellcheck="spellcheck"
        class="h-11 flex-1 bg-transparent pr-3.5 text-[16px] text-ink outline-none placeholder:text-ink-muted disabled:opacity-50 sm:text-[14.5px]"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <input
      v-else
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      :disabled="disabled"
      :maxlength="maxlength"
      :spellcheck="spellcheck"
      class="h-11 w-full rounded-[10px] border border-line bg-field px-3.5 text-[16px] text-ink outline-none transition-[border-color,background,box-shadow] duration-150 placeholder:text-ink-muted hover:border-line-strong focus:border-accent focus:bg-field-focus disabled:opacity-50 sm:text-[14.5px]"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >

    <span
      v-if="hint"
      class="mt-0.5 text-[11.5px]"
      :class="{
        'text-ink-muted': hintTone === 'muted',
        'text-accent-ink': hintTone === 'ok',
        'text-danger': hintTone === 'danger'
      }"
    >
      <span v-if="hintTone === 'ok'" aria-hidden="true" class="font-semibold">✓ </span>{{ hint }}
    </span>
  </div>
</template>

<style scoped>
.field-prefix:focus-within {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c-accent) 18%, transparent);
}
input:focus {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c-accent) 18%, transparent);
}
.field-prefix:focus-within input { box-shadow: none; }
</style>
