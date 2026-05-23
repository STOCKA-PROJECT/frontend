<script setup lang="ts">
import type { MemberResponseDto, OrganizationRole } from '~/types/api'

const props = withDefaults(defineProps<{
  modelValue: number | null
  members: MemberResponseDto[]
  eligibleRoles?: OrganizationRole[]
  placeholder?: string
  disabled?: boolean
  inputId?: string
}>(), {
  eligibleRoles: undefined,
  placeholder: '',
  disabled: false,
  inputId: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()

const open = ref(false)
const search = ref('')
const activeIndex = ref(-1)
const rootEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLUListElement | null>(null)
const searchInputEl = ref<HTMLInputElement | null>(null)
const listboxId = useId()

const eligible = computed<MemberResponseDto[]>(() => {
  if (!props.eligibleRoles || props.eligibleRoles.length === 0) return props.members
  const allow = new Set(props.eligibleRoles)
  return props.members.filter(m => allow.has(m.role))
})

const visible = computed<MemberResponseDto[]>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return eligible.value
  return eligible.value.filter(m =>
    m.name.toLowerCase().includes(q)
    || m.lastName.toLowerCase().includes(q)
    || m.email.toLowerCase().includes(q)
  )
})

const selected = computed<MemberResponseDto | null>(() =>
  props.members.find(m => m.userId === props.modelValue) ?? null
)

function openDropdown() {
  if (props.disabled) return
  open.value = true
  search.value = ''
  activeIndex.value = visible.value.findIndex(m => m.userId === props.modelValue)
  nextTick(() => {
    searchInputEl.value?.focus()
    scrollActiveIntoView()
  })
}

function closeDropdown() {
  open.value = false
}

function toggle() {
  open.value ? closeDropdown() : openDropdown()
}

function pick(member: MemberResponseDto) {
  emit('update:modelValue', member.userId)
  closeDropdown()
}

function clear() {
  emit('update:modelValue', null)
  closeDropdown()
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
    const member = visible.value[activeIndex.value]
    if (member) pick(member)
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
      @click="toggle"
      @keydown="onKeydown"
    >
      <span v-if="selected" class="flex min-w-0 items-center gap-2">
        <DashboardMemberAvatar
          :user-id="selected.userId"
          :name="selected.name"
          :last-name="selected.lastName"
          size="xs"
        />
        <span class="truncate">{{ selected.name }} {{ selected.lastName }}</span>
      </span>
      <span v-else class="truncate text-ink-muted">{{ placeholder || t('dashboard.members.no_selection') }}</span>
      <DashboardIcon name="caret" :size="14" class="opacity-70" />
    </button>

    <div v-if="open" class="dropdown">
      <div class="search-row">
        <input
          ref="searchInputEl"
          v-model="search"
          type="text"
          class="search-input"
          :placeholder="t('dashboard.members.search_placeholder')"
          @keydown="onKeydown"
        >
      </div>

      <ul :id="listboxId" ref="listEl" role="listbox" class="list">
        <li v-if="modelValue != null"
          role="option"
          :aria-selected="false"
          class="clear-row"
          @mousedown.prevent="clear"
        >
          <DashboardIcon name="x" :size="13" />
          <span>{{ t('dashboard.members.clear_selection') }}</span>
        </li>

        <li v-if="visible.length === 0" class="empty">
          {{ t('dashboard.members.no_members_match') }}
        </li>

        <li
          v-for="(member, i) in visible"
          :key="member.userId"
          role="option"
          :aria-selected="member.userId === modelValue"
          class="option"
          :class="{ 'is-active': i === activeIndex, 'is-selected': member.userId === modelValue }"
          @mouseenter="activeIndex = i"
          @mousedown.prevent="pick(member)"
        >
          <DashboardMemberAvatar
            :user-id="member.userId"
            :name="member.name"
            :last-name="member.lastName"
            size="sm"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate">{{ member.name }} {{ member.lastName }}</span>
            <span class="truncate text-[11px] text-ink-muted">{{ member.email }}</span>
          </span>
          <DashboardRoleChip :role="member.role" />
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

.dropdown {
  position: absolute;
  z-index: 20;
  margin-top: 4px;
  width: 100%;
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
  background: var(--c-bg-field, var(--c-bg-soft));
  color: var(--c-ink);
  font-size: 13px;
  outline: none;
}
.search-input:focus { border-color: var(--c-accent); }

.list {
  max-height: 16rem;
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
