<script setup lang="ts">
export interface MultiSelectOption {
  value: string | number
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: Array<string | number>
  options: MultiSelectOption[]
  placeholder?: string
  disabled?: boolean
  inputId?: string
  searchable?: boolean
}>(), {
  placeholder: '',
  disabled: false,
  inputId: undefined,
  searchable: true
})

const emit = defineEmits<{
  'update:modelValue': [value: Array<string | number>]
}>()

const { t } = useI18n()

const open = shallowRef(false)
const search = shallowRef('')
const activeIndex = shallowRef(-1)
const rootEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLUListElement | null>(null)
const searchInputEl = ref<HTMLInputElement | null>(null)
const listboxId = useId()

const selectedSet = computed(() => new Set(props.modelValue))

const visible = computed<MultiSelectOption[]>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(o => o.label.toLowerCase().includes(q))
})

const triggerLabel = computed(() => {
  if (props.modelValue.length === 0) return ''
  const labels = props.options
    .filter(o => selectedSet.value.has(o.value))
    .map(o => o.label)
  if (labels.length <= 2) return labels.join(', ')
  return t('dashboard.pieces.filters.selected_count', { n: labels.length })
})

function openDropdown() {
  if (props.disabled) return
  open.value = true
  search.value = ''
  activeIndex.value = visible.value.length > 0 ? 0 : -1
  nextTick(() => {
    if (props.searchable) searchInputEl.value?.focus()
  })
}

function closeDropdown() {
  open.value = false
}

function toggleDropdown() {
  if (open.value) closeDropdown()
  else openDropdown()
}

function toggleOption(option: MultiSelectOption) {
  const next = props.modelValue.filter(v => v !== option.value)
  if (next.length === props.modelValue.length) next.push(option.value)
  emit('update:modelValue', next)
}

function clearAll() {
  emit('update:modelValue', [])
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) return openDropdown()
    if (visible.value.length === 0) return
    activeIndex.value = (activeIndex.value + 1) % visible.value.length
    scrollActiveIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) return openDropdown()
    if (visible.value.length === 0) return
    activeIndex.value = (activeIndex.value - 1 + visible.value.length) % visible.value.length
    scrollActiveIntoView()
  } else if (e.key === 'Enter') {
    if (!open.value) return
    e.preventDefault()
    const option = visible.value[activeIndex.value]
    if (option) toggleOption(option)
  } else if (e.key === 'Escape') {
    if (open.value) {
      e.preventDefault()
      closeDropdown()
    }
  }
}

function scrollActiveIntoView() {
  const list = listEl.value
  if (!list || activeIndex.value < 0) return
  const item = list.children.item(activeIndex.value)
  if (item instanceof HTMLElement) item.scrollIntoView({ block: 'nearest' })
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    closeDropdown()
  }
}

watch(search, () => {
  activeIndex.value = visible.value.length === 0 ? -1 : 0
})

onMounted(() => document.addEventListener('mousedown', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentClick))
</script>

<template>
  <div ref="rootEl" class="relative">
    <button
      :id="inputId"
      type="button"
      class="trigger"
      :disabled="disabled"
      :aria-haspopup="'listbox'"
      :aria-expanded="open"
      :aria-controls="listboxId"
      @click="toggleDropdown"
      @keydown="onKeydown"
    >
      <span v-if="modelValue.length > 0" class="flex min-w-0 items-center gap-1.5">
        <span class="count-badge">{{ modelValue.length }}</span>
        <span class="truncate">{{ triggerLabel }}</span>
      </span>
      <span v-else class="truncate text-ink-muted">{{ placeholder }}</span>
      <DashboardIcon name="caret" :size="14" class="opacity-70" />
    </button>

    <div v-if="open" class="dropdown">
      <div v-if="searchable" class="search-row">
        <input
          ref="searchInputEl"
          v-model="search"
          type="text"
          class="search-input"
          :placeholder="t('dashboard.pieces.filters.search_options')"
          @keydown="onKeydown"
        >
      </div>

      <ul :id="listboxId" ref="listEl" role="listbox" aria-multiselectable="true" class="list">
        <li
          v-if="modelValue.length > 0"
          role="option"
          :aria-selected="false"
          class="clear-row"
          @mousedown.prevent="clearAll"
        >
          <DashboardIcon name="x" :size="13" />
          <span>{{ t('dashboard.pieces.filters.clear_selection') }}</span>
        </li>

        <li v-if="visible.length === 0" class="empty">
          {{ t('dashboard.pieces.filters.no_options') }}
        </li>

        <li
          v-for="(option, i) in visible"
          :key="option.value"
          role="option"
          :aria-selected="selectedSet.has(option.value)"
          class="option"
          :class="{ 'is-active': i === activeIndex, 'is-selected': selectedSet.has(option.value) }"
          @mouseenter="activeIndex = i"
          @mousedown.prevent="toggleOption(option)"
        >
          <span class="checkbox" :class="{ checked: selectedSet.has(option.value) }" aria-hidden="true">
            <svg v-if="selectedSet.has(option.value)" viewBox="0 0 12 12" width="10" height="10">
              <path d="M2 6.5 4.7 9 10 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="truncate">{{ option.label }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.trigger {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 38px;
  padding: 0 12px;
  border-radius: 9px;
  border: 1px solid var(--c-line);
  background: var(--c-field);
  color: var(--c-ink);
  font-size: 13.5px;
  text-align: left;
  outline: none;
  transition: border-color .15s, background .15s;
}
.trigger:hover:not(:disabled) { border-color: var(--c-line-strong); }
.trigger:focus { border-color: var(--c-accent); }
.trigger:disabled { opacity: .6; cursor: not-allowed; }

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--c-accent-soft);
  color: var(--c-accent-ink, var(--c-accent));
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.dropdown {
  position: absolute;
  z-index: 20;
  margin-top: 4px;
  width: 100%;
  min-width: 200px;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  box-shadow: 0 12px 28px -10px color-mix(in oklab, var(--c-ink) 30%, transparent);
}
.search-row {
  border-bottom: 1px solid var(--c-line);
  padding: 8px;
}
.search-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--c-line);
  background: var(--c-field);
  color: var(--c-ink);
  font-size: 13px;
  outline: none;
}
.search-input:focus { border-color: var(--c-accent); }

.list {
  max-height: 14rem;
  overflow-y: auto;
  padding: 4px 0;
}
.option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--c-ink);
}
.option.is-active { background: var(--c-bg-soft); }
.option.is-selected { font-weight: 600; }

.checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--c-line-strong);
  background: var(--c-bg-card);
  color: var(--c-bg-card);
  transition: background .1s, border-color .1s;
}
.checkbox.checked {
  background: var(--c-accent);
  border-color: var(--c-accent);
}

.clear-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 12.5px;
  color: var(--c-ink-muted);
  cursor: pointer;
  border-bottom: 1px solid var(--c-line);
}
.clear-row:hover { background: var(--c-bg-soft); }

.empty {
  padding: 8px 12px;
  font-size: 12.5px;
  color: var(--c-ink-muted);
}
</style>
