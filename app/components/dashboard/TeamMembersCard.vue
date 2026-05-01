<script setup lang="ts">
import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import type { MemberResponseDto, OrganizationRole } from '~/types/api'

const props = defineProps<{
  members: MemberResponseDto[]
  loading?: boolean
  currentUserRole: OrganizationRole
  currentUserId: number
}>()

const emit = defineEmits<{
  'change-role': [member: MemberResponseDto, newRole: OrganizationRole]
  'remove': [member: MemberResponseDto]
}>()

const { t } = useI18n()

const ALL_ROLES: OrganizationRole[] = ['OWNER', 'MANAGER', 'USER', 'SPECTATOR']

const ownerCount = computed(() => props.members.filter(m => m.role === 'OWNER').length)

function isLastOwner(m: MemberResponseDto): boolean {
  return m.role === 'OWNER' && ownerCount.value <= 1
}

function canChangeRole(m: MemberResponseDto): boolean {
  if (props.currentUserRole !== 'OWNER') return false
  if (m.userId === props.currentUserId) return false
  return true
}

function canRemove(m: MemberResponseDto): boolean {
  if (props.currentUserId === m.userId) return false
  if (isLastOwner(m)) return false
  if (props.currentUserRole === 'OWNER') return true
  if (props.currentUserRole === 'MANAGER') {
    return m.role === 'USER' || m.role === 'SPECTATOR'
  }
  return false
}

function initials(m: MemberResponseDto): string {
  const a = (m.name || '').trim().charAt(0)
  const b = (m.lastName || '').trim().charAt(0)
  const out = (a + b).toUpperCase()
  return out || (m.email.charAt(0).toUpperCase() || '?')
}

const openMenuId = ref<number | null>(null)
const rootRef = ref<HTMLElement | null>(null)

function toggleMenu(memberId: number) {
  openMenuId.value = openMenuId.value === memberId ? null : memberId
}

function pickRole(member: MemberResponseDto, newRole: OrganizationRole) {
  openMenuId.value = null
  if (member.role === newRole) return
  if (newRole !== 'OWNER' && isLastOwner(member)) {
    emit('change-role', member, newRole)
    return
  }
  emit('change-role', member, newRole)
}

function onDocClick(e: MouseEvent) {
  if (!rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) openMenuId.value = null
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <section ref="rootRef" class="rounded-[14px] border border-line bg-bg-card shadow-card">
    <header class="flex items-center justify-between px-6 pt-5 pb-3">
      <div>
        <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {{ t('dashboard.team.members_title') }}
        </h2>
        <p class="mt-0.5 text-[12px] text-ink-muted">
          {{ t('dashboard.team.members_count', members.length, { named: { n: members.length } }) }}
        </p>
      </div>
    </header>

    <div v-if="loading && members.length === 0" class="px-6 pb-6 pt-2 text-[13px] text-ink-muted">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="members.length === 0" class="px-6 pb-6 pt-2 text-[13px] text-ink-muted">
      {{ t('dashboard.team.empty_members') }}
    </div>

    <ul v-else class="divide-y divide-line border-t border-line">
      <li v-for="m in members" :key="m.id"
        class="flex items-center gap-3.5 px-6 py-3.5">
        <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[12.5px] font-semibold text-white">
          {{ initials(m) }}
        </div>
        <div class="flex min-w-0 flex-1 flex-col">
          <div class="flex items-center gap-2 text-[13.5px] font-medium tracking-[-0.005em] text-ink">
            <span class="truncate">{{ m.name }} {{ m.lastName }}</span>
            <span v-if="m.userId === currentUserId"
              class="rounded-md border border-line px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
              {{ t('dashboard.team.you') }}
            </span>
          </div>
          <span class="truncate text-[12px] text-ink-muted">{{ m.email }}</span>
        </div>

        <DashboardRoleChip :role="m.role" />

        <div class="relative flex items-center gap-1">
          <button
            v-if="canChangeRole(m)"
            type="button"
            class="action-btn"
            :title="t('dashboard.team.change_role')"
            :aria-label="t('dashboard.team.change_role')"
            :aria-expanded="openMenuId === m.id"
            @click.stop="toggleMenu(m.id)"
          >
            <DashboardIcon name="caret" :size="14" />
          </button>
          <button
            v-if="canRemove(m)"
            type="button"
            class="action-btn action-btn-danger"
            :title="t('dashboard.team.remove_member')"
            :aria-label="t('dashboard.team.remove_member')"
            @click.stop="emit('remove', m)"
          >
            <DashboardIcon name="trash" :size="14" />
          </button>

          <div
            v-if="openMenuId === m.id && canChangeRole(m)"
            role="menu"
            class="role-menu"
          >
            <button
              v-for="r in ALL_ROLES"
              :key="r"
              type="button"
              role="menuitemradio"
              :aria-checked="m.role === r"
              class="role-menu-item"
              :class="{ 'is-active': m.role === r }"
              @click.stop="pickRole(m, r)"
            >
              <span class="flex-1 text-left">{{ t(`dashboard.org.roles.${r}`) }}</span>
              <DashboardIcon v-if="m.role === r" name="check" :size="13" />
            </button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink-soft);
  transition: background .15s, border-color .15s, color .15s;
}
.action-btn:hover {
  background: var(--c-bg-soft);
  border-color: var(--c-line-strong);
  color: var(--c-ink);
}
.action-btn-danger:hover {
  background: var(--c-danger-soft);
  border-color: color-mix(in oklab, var(--c-danger) 35%, var(--c-line));
  color: var(--c-danger);
}
.role-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  min-width: 180px;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.role-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--c-ink);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background .12s;
}
.role-menu-item:hover { background: var(--c-bg-soft); }
.role-menu-item.is-active { background: var(--c-bg-soft); color: var(--c-accent-ink); font-weight: 600; }
</style>
