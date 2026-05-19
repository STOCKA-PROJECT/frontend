<script setup lang="ts">
const props = withDefaults(defineProps<{
  name?: string | null
  lastName?: string | null
  userId?: number | null
  size?: 'xs' | 'sm' | 'md'
}>(), { size: 'sm' })

const SIZES = {
  xs: { box: 'h-5 w-5', text: 'text-[9px]' },
  sm: { box: 'h-7 w-7', text: 'text-[10.5px]' },
  md: { box: 'h-9 w-9', text: 'text-[12.5px]' }
} as const

const label = computed(() => initials(props.name, props.lastName))

const sizeClasses = computed(() => SIZES[props.size])

const palette = computed(() => {
  // Stable HSL pair from the userId so the same user always renders the same color.
  // When no id is provided we fall back to a neutral surface so empty states stay quiet.
  const id = props.userId
  if (id == null) {
    return { background: 'var(--c-bg-soft)', color: 'var(--c-ink-soft)' }
  }
  const hue = Math.abs(id * 137) % 360
  return {
    background: `hsl(${hue}, 70%, 88%)`,
    color: `hsl(${hue}, 55%, 24%)`
  }
})
</script>

<template>
  <span
    class="inline-flex flex-shrink-0 select-none items-center justify-center rounded-full font-semibold"
    :class="[sizeClasses.box, sizeClasses.text]"
    :style="{ backgroundColor: palette.background, color: palette.color }"
    aria-hidden="true"
  >
    {{ label }}
  </span>
</template>
