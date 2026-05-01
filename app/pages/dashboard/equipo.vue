<script setup lang="ts">
import { FetchError } from 'ofetch'
import type {
  CreateInvitationDto,
  InvitationResponseDto,
  MemberResponseDto,
  OrganizationRole
} from '~/types/api'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const localePath = useLocalePath()

const orgs = useOrganizationsStore()
const team = useTeamStore()
const auth = useAuthStore()

if (orgs.list.length === 0) {
  await orgs.fetchList()
}
if (!orgs.current) {
  await navigateTo(localePath('/dashboard'))
}

useSeoMeta({
  title: () => t('dashboard.team.page_title'),
  robots: 'noindex, nofollow'
})

const orgId = computed(() => orgs.current?.id ?? 0)
const role = computed<OrganizationRole>(() => orgs.current?.currentUserRole ?? 'SPECTATOR')
const currentUserId = computed(() => auth.user?.id ?? -1)

const members = computed(() => team.getMembers(orgId.value) ?? [])
const invitations = computed(() => team.getInvitations(orgId.value) ?? [])
const canSeeInvitations = computed(() => role.value === 'OWNER' || role.value === 'MANAGER')
const ownerCount = computed(() => members.value.filter(m => m.role === 'OWNER').length)
const isCurrentUserLastOwner = computed(() => {
  const me = members.value.find(m => m.userId === currentUserId.value)
  return !!me && me.role === 'OWNER' && ownerCount.value <= 1
})

const pageError = ref<string | null>(null)

async function loadAll() {
  if (!orgId.value) return
  pageError.value = null
  const tasks: Promise<unknown>[] = [team.fetchMembers(orgId.value)]
  if (canSeeInvitations.value) tasks.push(team.fetchInvitations(orgId.value))
  try {
    await Promise.all(tasks)
  } catch (e) {
    pageError.value = e instanceof FetchError && e.data?.message
      ? String(e.data.message)
      : t('dashboard.team.errors.load_members')
  }
}

watch(() => orgs.current?.id, () => {
  if (orgs.current) loadAll()
}, { immediate: true })

// Invite dialog
const inviteOpen = ref(false)
const inviteLoading = ref(false)
const inviteError = ref<string | null>(null)

function openInvite() {
  inviteError.value = null
  inviteOpen.value = true
}

function closeInvite() {
  if (inviteLoading.value) return
  inviteOpen.value = false
}

async function submitInvite(payload: CreateInvitationDto) {
  if (!orgId.value) return
  inviteLoading.value = true
  inviteError.value = null
  try {
    await team.invite(orgId.value, payload)
    inviteOpen.value = false
  } catch (e) {
    inviteError.value = errorMessage(e, t('dashboard.team.errors.invite'))
  } finally {
    inviteLoading.value = false
  }
}

// Change role confirm
const changeRoleTarget = ref<{ member: MemberResponseDto; newRole: OrganizationRole } | null>(null)
const changeRoleLoading = ref(false)

function askChangeRole(member: MemberResponseDto, newRole: OrganizationRole) {
  changeRoleTarget.value = { member, newRole }
}

const changeRoleMessage = computed(() => {
  const target = changeRoleTarget.value
  if (!target) return ''
  return t('dashboard.team.confirm_change_role_message', {
    name: `${target.member.name} ${target.member.lastName}`.trim(),
    newRole: t(`dashboard.org.roles.${target.newRole}`)
  })
})

async function confirmChangeRole() {
  if (!changeRoleTarget.value || !orgId.value) return
  const { member, newRole } = changeRoleTarget.value
  changeRoleLoading.value = true
  pageError.value = null
  try {
    await team.updateRole(orgId.value, member.id, newRole)
    changeRoleTarget.value = null
  } catch (e) {
    pageError.value = errorMessage(e, t('dashboard.team.errors.update_role'))
    changeRoleTarget.value = null
  } finally {
    changeRoleLoading.value = false
  }
}

// Remove member confirm
const removeTarget = ref<MemberResponseDto | null>(null)
const removeLoading = ref(false)

const removeMessage = computed(() => removeTarget.value
  ? t('dashboard.team.confirm_remove_message', {
      name: `${removeTarget.value.name} ${removeTarget.value.lastName}`.trim()
    })
  : '')

async function confirmRemove() {
  if (!removeTarget.value || !orgId.value) return
  removeLoading.value = true
  pageError.value = null
  try {
    await team.removeMember(orgId.value, removeTarget.value.id)
    removeTarget.value = null
  } catch (e) {
    pageError.value = errorMessage(e, t('dashboard.team.errors.remove'))
    removeTarget.value = null
  } finally {
    removeLoading.value = false
  }
}

// Cancel invitation confirm
const cancelInviteTarget = ref<InvitationResponseDto | null>(null)
const cancelInviteLoading = ref(false)

const cancelInviteMessage = computed(() => cancelInviteTarget.value
  ? t('dashboard.team.confirm_cancel_invitation_message', { email: cancelInviteTarget.value.email })
  : '')

async function confirmCancelInvitation() {
  if (!cancelInviteTarget.value || !orgId.value) return
  cancelInviteLoading.value = true
  pageError.value = null
  try {
    await team.cancelInvitation(orgId.value, cancelInviteTarget.value.id)
    cancelInviteTarget.value = null
  } catch (e) {
    pageError.value = errorMessage(e, t('dashboard.team.errors.cancel_invitation'))
    cancelInviteTarget.value = null
  } finally {
    cancelInviteLoading.value = false
  }
}

// Leave org confirm
const leaveOpen = ref(false)
const leaveLoading = ref(false)

const leaveMessage = computed(() => orgs.current
  ? t('dashboard.team.confirm_leave_message', { name: orgs.current.name })
  : '')

function askLeave() {
  if (isCurrentUserLastOwner.value) return
  leaveOpen.value = true
}

async function confirmLeave() {
  if (!orgId.value) return
  leaveLoading.value = true
  pageError.value = null
  try {
    await team.leaveOrg(orgId.value)
    team.reset()
    await orgs.fetchList()
    leaveOpen.value = false
    await navigateTo(localePath('/dashboard'))
  } catch (e) {
    pageError.value = errorMessage(e, t('dashboard.team.errors.leave'))
    leaveOpen.value = false
  } finally {
    leaveLoading.value = false
  }
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof FetchError && e.data && typeof e.data === 'object' && 'message' in e.data) {
    const msg = (e.data as { message?: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}
</script>

<template>
  <div class="flex flex-col gap-6 px-8 pb-16 pt-7 max-md:px-4">
    <div>
      <h1 class="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
        {{ t('dashboard.team.page_title') }}
      </h1>
      <p class="mt-1 max-w-[640px] text-[14px] leading-relaxed text-ink-soft">
        {{ t('dashboard.team.page_subtitle') }}
      </p>
    </div>

    <div v-if="pageError" role="alert"
      class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ pageError }}
    </div>

    <div class="flex max-w-[760px] flex-col gap-5">
      <DashboardTeamMembersCard
        :members="members"
        :loading="team.loadingMembers"
        :current-user-role="role"
        :current-user-id="currentUserId"
        @change-role="askChangeRole"
        @remove="(m) => removeTarget = m"
      />

      <DashboardTeamInvitationsCard
        v-if="canSeeInvitations"
        :invitations="invitations"
        :loading="team.loadingInvitations"
        :current-user-role="role"
        @invite="openInvite"
        @cancel="(inv) => cancelInviteTarget = inv"
      />

      <div class="mt-2 flex justify-end">
        <button
          type="button"
          class="leave-btn"
          :disabled="isCurrentUserLastOwner"
          :title="isCurrentUserLastOwner ? t('dashboard.team.leave_org_disabled_last_owner') : ''"
          @click="askLeave"
        >
          <DashboardIcon name="log-out" :size="14" />
          <span>{{ t('dashboard.team.leave_org') }}</span>
        </button>
      </div>
    </div>

    <DashboardInviteMemberDialog
      :open="inviteOpen"
      :loading="inviteLoading"
      :error-msg="inviteError"
      :current-user-role="role"
      @submit="submitInvite"
      @close="closeInvite"
    />

    <DashboardConfirmDialog
      :open="!!changeRoleTarget"
      :title="t('dashboard.team.confirm_change_role_title')"
      :message="changeRoleMessage"
      :loading="changeRoleLoading"
      :confirm-label="t('common.confirm')"
      :cancel-label="t('dashboard.team.cancel')"
      @confirm="confirmChangeRole"
      @close="changeRoleTarget = null"
    />

    <DashboardConfirmDialog
      :open="!!removeTarget"
      tone="danger"
      :title="t('dashboard.team.confirm_remove_title')"
      :message="removeMessage"
      :loading="removeLoading"
      :confirm-label="t('dashboard.team.remove_member')"
      :cancel-label="t('dashboard.team.cancel')"
      @confirm="confirmRemove"
      @close="removeTarget = null"
    />

    <DashboardConfirmDialog
      :open="!!cancelInviteTarget"
      tone="danger"
      :title="t('dashboard.team.confirm_cancel_invitation_title')"
      :message="cancelInviteMessage"
      :loading="cancelInviteLoading"
      :confirm-label="t('dashboard.team.cancel_invitation')"
      :cancel-label="t('dashboard.team.cancel')"
      @confirm="confirmCancelInvitation"
      @close="cancelInviteTarget = null"
    />

    <DashboardConfirmDialog
      :open="leaveOpen"
      tone="danger"
      :title="t('dashboard.team.confirm_leave_title')"
      :message="leaveMessage"
      :loading="leaveLoading"
      :confirm-label="t('dashboard.team.leave_org')"
      :cancel-label="t('dashboard.team.cancel')"
      @confirm="confirmLeave"
      @close="leaveOpen = false"
    />
  </div>
</template>

<style scoped>
.leave-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: transparent;
  color: var(--c-ink-soft);
  transition: background .15s, border-color .15s, color .15s;
}
.leave-btn:hover:not(:disabled) {
  background: var(--c-danger-soft);
  border-color: color-mix(in oklab, var(--c-danger) 35%, var(--c-line));
  color: var(--c-danger);
}
.leave-btn:disabled { opacity: .55; cursor: not-allowed; }
</style>
