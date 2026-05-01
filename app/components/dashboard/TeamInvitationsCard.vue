<script setup lang="ts">
import { computed } from 'vue'
import type { InvitationResponseDto, OrganizationRole } from '~/types/api'

const props = defineProps<{
  invitations: InvitationResponseDto[]
  loading?: boolean
  currentUserRole: OrganizationRole
}>()

const emit = defineEmits<{
  invite: []
  cancel: [invitation: InvitationResponseDto]
}>()

const { t } = useI18n()

const canInvite = computed(() => props.currentUserRole === 'OWNER' || props.currentUserRole === 'MANAGER')

function expiresLabel(expiresAt: string): string {
  const exp = new Date(expiresAt).getTime()
  const now = Date.now()
  const diffMs = exp - now
  if (diffMs <= 0) return t('dashboard.team.expires_past')
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return t('dashboard.team.expires_today')
  return t('dashboard.team.expires_in_days', diffDays, { named: { n: diffDays } })
}
</script>

<template>
  <section class="rounded-[14px] border border-line bg-bg-card shadow-card">
    <header class="flex items-center justify-between px-6 pt-5 pb-3">
      <div>
        <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {{ t('dashboard.team.invitations_title') }}
        </h2>
        <p class="mt-0.5 text-[12px] text-ink-muted">
          {{ t('dashboard.team.invitations_count', invitations.length, { named: { n: invitations.length } }) }}
        </p>
      </div>
      <button
        v-if="canInvite"
        type="button"
        class="invite-btn"
        @click="emit('invite')"
      >
        <DashboardIcon name="plus" :size="14" />
        <span>{{ t('dashboard.team.invite_btn') }}</span>
      </button>
    </header>

    <div v-if="loading && invitations.length === 0" class="px-6 pb-6 pt-2 text-[13px] text-ink-muted">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="invitations.length === 0" class="px-6 pb-6 pt-2 text-[13px] text-ink-muted">
      {{ t('dashboard.team.empty_invitations') }}
    </div>

    <ul v-else class="divide-y divide-line border-t border-line">
      <li v-for="inv in invitations" :key="inv.id"
        class="flex items-center gap-3.5 px-6 py-3.5">
        <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-bg-soft text-ink-soft">
          <DashboardIcon name="mail" :size="16" />
        </div>
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-[13.5px] font-medium tracking-[-0.005em] text-ink">{{ inv.email }}</span>
          <span class="truncate text-[12px] text-ink-muted">{{ expiresLabel(inv.expiresAt) }}</span>
        </div>
        <DashboardRoleChip :role="inv.role" />
        <button
          v-if="canInvite"
          type="button"
          class="action-btn action-btn-danger"
          :title="t('dashboard.team.cancel_invitation')"
          :aria-label="t('dashboard.team.cancel_invitation')"
          @click="emit('cancel', inv)"
        >
          <DashboardIcon name="x" :size="14" />
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.invite-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--c-ink);
  background: var(--c-ink);
  color: var(--c-bg-card);
  transition: background .15s;
}
.invite-btn:hover { background: color-mix(in oklab, var(--c-ink) 90%, transparent); }
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
</style>
