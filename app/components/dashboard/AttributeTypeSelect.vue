<script setup lang="ts">
import type { AttributeType } from '~/types/api'

const props = withDefaults(defineProps<{
  modelValue: AttributeType
  options: AttributeType[]
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{
  'update:modelValue': [value: AttributeType]
}>()

const { t } = useI18n()

const open = ref(false)
const activeIndex = ref(0)
const rootEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLUListElement | null>(null)
const listboxId = useId()

const label = (type: AttributeType) => t(`dashboard.pieceTypes.types.${type}`)

const selectedIndex = computed(() =>
  props.options.findIndex(opt => opt === props.modelValue)
)

function openDropdown() {
  if (props.disabled) return
  open.value = true
  activeIndex.value = Math.max(0, selectedIndex.value)
  nextTick(() => scrollActiveIntoView())
}

function closeDropdown() {
  open.value = false
}

function toggle() {
  open.value ? closeDropdown() : openDropdown()
}

function pick(index: number) {
  const value = props.options[index]
  if (value === undefined) return
  emit('update:modelValue', value)
  closeDropdown()
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) return openDropdown()
    activeIndex.value = (activeIndex.value + 1) % props.options.length
    scrollActiveIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) return openDropdown()
    activeIndex.value = (activeIndex.value - 1 + props.options.length) % props.options.length
    scrollActiveIntoView()
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (!open.value) return openDropdown()
    pick(activeIndex.value)
  } else if (e.key === 'Escape') {
    if (open.value) {
      e.preventDefault()
      closeDropdown()
    }
  } else if (e.key === 'Home') {
    if (open.value) { e.preventDefault(); activeIndex.value = 0; scrollActiveIntoView() }
  } else if (e.key === 'End') {
    if (open.value) { e.preventDefault(); activeIndex.value = props.options.length - 1; scrollActiveIntoView() }
  }
}

function scrollActiveIntoView() {
  const list = listEl.value
  if (!list) return
  const item = list.children.item(activeIndex.value)
  if (item instanceof HTMLElement) item.scrollIntoView({ block: 'nearest' })
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => document.addEventListener('mousedown', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentClick))
</script>

<template>
  <div ref="rootEl" class="relative">
    <button
      type="button"
      class="trigger"
      :disabled="disabled"
      :aria-haspopup="'listbox'"
      :aria-expanded="open"
      :aria-controls="listboxId"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="flex items-center gap-2 truncate">
        <DashboardAttributeTypeIcon :type="modelValue" :size="14" class="opacity-80" />
        <span class="truncate">{{ label(modelValue) }}</span>
      </span>
      <DashboardIcon name="caret" :size="14" class="opacity-70" />
    </button>

    <ul
      v-if="open"
      :id="listboxId"
      ref="listEl"
      role="listbox"
      class="listbox"
    >
      <li
        v-for="(opt, i) in options"
        :id="`${listboxId}-opt-${i}`"
        :key="opt"
        role="option"
        :aria-selected="opt === modelValue"
        class="option"
        :class="{ 'is-active': i === activeIndex, 'is-selected': opt === modelValue }"
        @mouseenter="activeIndex = i"
        @mousedown.prevent="pick(i)"
      >
        <DashboardAttributeTypeIcon :type="opt" :size="14" class="opacity-80" />
        <span class="flex-1 truncate">{{ label(opt) }}</span>
        <DashboardIcon v-if="opt === modelValue" name="check" :size="13" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.trigger {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-field, var(--c-bg-soft));
  color: var(--c-ink);
  font-size: 14px;
  text-align: left;
  outline: none;
  transition: border-color .15s, background .15s;
}
.trigger:hover:not(:disabled) { border-color: var(--c-line-strong); }
.trigger:focus { border-color: var(--c-accent); }
.trigger:disabled { opacity: .6; cursor: not-allowed; }

.listbox {
  position: absolute;
  z-index: 20;
  margin-top: 4px;
  max-height: 16rem;
  width: 100%;
  overflow-y: auto;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  padding: 4px 0;
  box-shadow: 0 12px 28px -10px color-mix(in oklab, var(--c-ink) 30%, transparent);
}
.option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 13.5px;
  cursor: pointer;
  color: var(--c-ink);
}
.option.is-active { background: var(--c-bg-soft); }
.option.is-selected { font-weight: 600; }
</style>
