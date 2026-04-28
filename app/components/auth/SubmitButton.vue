<script setup lang="ts">
withDefaults(defineProps<{
  loading?: boolean
  disabled?: boolean
}>(), {
  loading: false,
  disabled: false
})
</script>

<template>
  <button
    type="submit"
    class="auth-btn relative mt-1 h-[46px] overflow-hidden rounded-[10px] bg-ink px-[18px] text-[14.5px] font-medium tracking-[-0.005em] text-bg-card shadow-soft transition-[transform,background,box-shadow] duration-150 hover:bg-ink/90 hover:shadow-card active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-ink disabled:hover:shadow-soft"
    :class="{ 'is-loading text-transparent': loading }"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <slot />
  </button>
</template>

<style scoped>
.auth-btn.is-loading::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, .25);
  border-top-color: var(--c-bg-card);
  border-radius: 50%;
  margin: -8px 0 0 -8px;
  animation: auth-spin .7s linear infinite;
}
@keyframes auth-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .auth-btn.is-loading::after { animation-duration: .001s; }
}
</style>
