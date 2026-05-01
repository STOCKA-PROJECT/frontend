<script setup lang="ts">
const props = withDefaults(defineProps<{
  page: number          // 0-based
  totalPages: number
  size: number
  totalElements?: number
  sizeOptions?: number[]
  disabled?: boolean
}>(), {
  totalElements: 0,
  sizeOptions: () => [10, 20, 50, 100],
  disabled: false
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:size': [size: number]
}>()

const { t } = useI18n()

const isFirst = computed(() => props.page <= 0)
const isLast = computed(() => props.page >= props.totalPages - 1)
const pageDisplay = computed(() => Math.min(props.page + 1, Math.max(props.totalPages, 1)))
const totalDisplay = computed(() => Math.max(props.totalPages, 1))

function goPrev() {
  if (!isFirst.value && !props.disabled) emit('update:page', props.page - 1)
}
function goNext() {
  if (!isLast.value && !props.disabled) emit('update:page', props.page + 1)
}
function changeSize(e: Event) {
  const size = Number((e.target as HTMLSelectElement).value)
  if (Number.isFinite(size)) emit('update:size', size)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px] text-ink-soft">
    <div class="flex items-center gap-2">
      <label for="page-size-select" class="text-[12.5px] text-ink-muted">
        {{ t('dashboard.pagination.size') }}
      </label>
      <select
        id="page-size-select"
        :value="size"
        :disabled="disabled"
        class="page-size"
        @change="changeSize"
      >
        <option v-for="opt in sizeOptions" :key="opt" :value="opt">{{ opt }}</option>
      </select>
      <span v-if="totalElements > 0" class="ml-2 text-[12.5px] text-ink-muted">
        {{ t('dashboard.pagination.total', { n: totalElements }) }}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="page-btn"
        :disabled="isFirst || disabled"
        @click="goPrev"
      >
        ← {{ t('dashboard.pagination.prev') }}
      </button>
      <span class="px-1 text-[12.5px] tabular-nums">
        {{ t('dashboard.pagination.page_of', { current: pageDisplay, total: totalDisplay }) }}
      </span>
      <button
        type="button"
        class="page-btn"
        :disabled="isLast || disabled"
        @click="goNext"
      >
        {{ t('dashboard.pagination.next') }} →
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-size {
  height: 30px;
  padding: 0 28px 0 10px;
  border: 1px solid var(--c-line);
  border-radius: 8px;
  background: var(--c-field);
  color: var(--c-ink);
  font-size: 13px;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--c-ink-muted) 50%),
                    linear-gradient(135deg, var(--c-ink-muted) 50%, transparent 50%);
  background-position: calc(100% - 14px) 13px, calc(100% - 9px) 13px;
  background-size: 5px 5px;
  background-repeat: no-repeat;
}
.page-size:focus { outline: 2px solid var(--c-accent); outline-offset: 1px; }
.page-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--c-line);
  border-radius: 8px;
  background: var(--c-bg-card);
  color: var(--c-ink);
  font-size: 12.5px;
  transition: background .12s, border-color .12s;
}
.page-btn:hover:not(:disabled) { background: var(--c-bg-soft); }
.page-btn:disabled { opacity: .45; cursor: not-allowed; }
</style>
