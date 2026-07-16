<script setup lang="ts">
import type {
  ContactResponseDto,
  MemberResponseDto,
  OrganizationRole,
  PieceOwnerKind
} from '~/types/api'

/**
 * Selector unificado del propietario de un artículo: miembros de la
 * organización y contactos externos en un único listbox agrupado. El
 * `modelValue` lleva el tipo y el id juntos porque el propietario es un solo
 * campo con dos directorios posibles. `MemberSelect` queda intacto para los
 * atributos de tipo MEMBER, que siguen siendo solo-miembros.
 */
export interface OwnerRef {
  kind: PieceOwnerKind
  id: number
}

interface OwnerOption {
  kind: PieceOwnerKind
  id: number
  label: string
  sub: string
  member?: MemberResponseDto
}

const props = withDefaults(defineProps<{
  modelValue: OwnerRef | null
  members: MemberResponseDto[]
  contacts: ContactResponseDto[]
  eligibleRoles?: OrganizationRole[]
  placeholder?: string
  disabled?: boolean
  inputId?: string
  canCreateContact?: boolean
}>(), {
  eligibleRoles: undefined,
  placeholder: '',
  disabled: false,
  inputId: undefined,
  canCreateContact: false
})

const emit = defineEmits<{
  'update:modelValue': [value: OwnerRef | null]
  'create-contact': [query: string]
}>()

const { t } = useI18n()

const open = ref(false)
const search = ref('')
const activeIndex = ref(-1)
const rootEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLUListElement | null>(null)
const searchInputEl = ref<HTMLInputElement | null>(null)
const listboxId = useId()

const eligibleMembers = computed<MemberResponseDto[]>(() => {
  if (!props.eligibleRoles || props.eligibleRoles.length === 0) return props.members
  const allow = new Set(props.eligibleRoles)
  return props.members.filter(m => allow.has(m.role))
})

const memberOptions = computed<OwnerOption[]>(() =>
  eligibleMembers.value.map(m => ({
    kind: 'USER' as const,
    id: m.userId,
    label: `${m.name} ${m.lastName}`.trim(),
    sub: m.email,
    member: m
  }))
)

const contactOptions = computed<OwnerOption[]>(() =>
  props.contacts.map(c => ({
    kind: 'CONTACT' as const,
    id: c.id,
    label: `${c.name} ${c.lastName ?? ''}`.trim(),
    sub: c.email ?? c.phone ?? ''
  }))
)

function matches(option: OwnerOption, q: string): boolean {
  return option.label.toLowerCase().includes(q) || option.sub.toLowerCase().includes(q)
}

const visibleMembers = computed<OwnerOption[]>(() => {
  const q = search.value.trim().toLowerCase()
  return q ? memberOptions.value.filter(o => matches(o, q)) : memberOptions.value
})

const visibleContacts = computed<OwnerOption[]>(() => {
  const q = search.value.trim().toLowerCase()
  return q ? contactOptions.value.filter(o => matches(o, q)) : contactOptions.value
})

/** Lista plana en el orden visual (miembros y después contactos) para el teclado. */
const visible = computed<OwnerOption[]>(() => [...visibleMembers.value, ...visibleContacts.value])

const selected = computed<OwnerOption | null>(() => {
  const v = props.modelValue
  if (!v) return null
  const pool = v.kind === 'USER' ? memberOptions.value : contactOptions.value
  return pool.find(o => o.id === v.id) ?? null
})

function isSelected(option: OwnerOption): boolean {
  return props.modelValue?.kind === option.kind && props.modelValue?.id === option.id
}

function flatIndexOf(option: OwnerOption): number {
  return visible.value.findIndex(o => o.kind === option.kind && o.id === option.id)
}

function openDropdown() {
  if (props.disabled) return
  open.value = true
  search.value = ''
  activeIndex.value = selected.value ? flatIndexOf(selected.value) : -1
  nextTick(() => {
    searchInputEl.value?.focus()
  })
}

function closeDropdown() {
  open.value = false
}

function toggle() {
  if (open.value) closeDropdown()
  else openDropdown()
}

function pick(option: OwnerOption) {
  emit('update:modelValue', { kind: option.kind, id: option.id })
  closeDropdown()
}

function clear() {
  emit('update:modelValue', null)
  closeDropdown()
}

function createContact() {
  emit('create-contact', search.value.trim())
  closeDropdown()
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) return openDropdown()
    if (visible.value.length === 0) return
    activeIndex.value = (activeIndex.value + 1) % visible.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) return openDropdown()
    if (visible.value.length === 0) return
    activeIndex.value = (activeIndex.value - 1 + visible.value.length) % visible.value.length
  } else if (e.key === 'Enter') {
    if (!open.value) return
    e.preventDefault()
    const option = visible.value[activeIndex.value]
    if (option) pick(option)
    else if (props.canCreateContact) createContact()
  } else if (e.key === 'Escape') {
    if (open.value) {
      e.preventDefault()
      closeDropdown()
    }
  }
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
          v-if="selected.member"
          :user-id="selected.member.userId"
          :name="selected.member.name"
          :last-name="selected.member.lastName"
          size="xs"
        />
        <span v-else class="contact-badge">{{ t('dashboard.contacts.badge') }}</span>
        <span class="truncate">{{ selected.label }}</span>
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
          {{ t('dashboard.pieces.form.owner_no_match') }}
        </li>

        <li v-if="visibleMembers.length > 0" class="group-label" aria-hidden="true">
          {{ t('dashboard.pieces.form.owner_group_members') }}
        </li>
        <li
          v-for="option in visibleMembers"
          :key="`u-${option.id}`"
          role="option"
          :aria-selected="isSelected(option)"
          class="option"
          :class="{ 'is-active': flatIndexOf(option) === activeIndex, 'is-selected': isSelected(option) }"
          @mouseenter="activeIndex = flatIndexOf(option)"
          @mousedown.prevent="pick(option)"
        >
          <DashboardMemberAvatar
            :user-id="option.member!.userId"
            :name="option.member!.name"
            :last-name="option.member!.lastName"
            size="sm"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate">{{ option.label }}</span>
            <span class="truncate text-[11px] text-ink-muted">{{ option.sub }}</span>
          </span>
          <DashboardRoleChip :role="option.member!.role" />
        </li>

        <li v-if="visibleContacts.length > 0" class="group-label" aria-hidden="true">
          {{ t('dashboard.pieces.form.owner_group_contacts') }}
        </li>
        <li
          v-for="option in visibleContacts"
          :key="`c-${option.id}`"
          role="option"
          :aria-selected="isSelected(option)"
          class="option"
          :class="{ 'is-active': flatIndexOf(option) === activeIndex, 'is-selected': isSelected(option) }"
          @mouseenter="activeIndex = flatIndexOf(option)"
          @mousedown.prevent="pick(option)"
        >
          <span class="contact-avatar" aria-hidden="true">
            {{ option.label.charAt(0).toUpperCase() }}
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate">{{ option.label }}</span>
            <span class="truncate text-[11px] text-ink-muted">{{ option.sub || '—' }}</span>
          </span>
          <span class="contact-badge">{{ t('dashboard.contacts.badge') }}</span>
        </li>

        <li
          v-if="canCreateContact"
          role="option"
          :aria-selected="false"
          class="create-row"
          @mousedown.prevent="createContact"
        >
          <DashboardIcon name="plus" :size="13" />
          <span>
            {{ search.trim()
              ? t('dashboard.pieces.form.owner_create_contact_named', { name: search.trim() })
              : t('dashboard.pieces.form.owner_create_contact') }}
          </span>
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
.group-label {
  padding: 6px 12px 3px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--c-ink-muted);
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

.contact-avatar {
  display: inline-flex;
  height: 28px;
  width: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px dashed var(--c-line-strong);
  background: var(--c-bg-soft);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--c-ink-soft);
}
.contact-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-soft);
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--c-ink-soft);
  white-space: nowrap;
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

.create-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  font-size: 12.5px;
  color: var(--c-accent-ink, var(--c-ink));
  cursor: pointer;
  border-top: 1px solid var(--c-line);
}
.create-row:hover { background: var(--c-bg-soft); }

.empty {
  padding: 8px 12px;
  font-size: 12.5px;
  color: var(--c-ink-muted);
}
</style>
