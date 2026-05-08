<script setup lang="ts">
import { FetchError } from 'ofetch'
import type { InvitationResponseDto } from '~/types/api'

definePageMeta({ layout: 'dashboard' })

const { t, locale } = useI18n()
const team = useTeamStore()
const orgs = useOrganizationsStore()
const toast = useToastStore()

useSeoMeta({
  title: () => t('dashboard.my_invitations.page_title'),
  robots: 'noindex, nofollow'
})

const pageError = ref<string | null>(null)
const actingId = ref<number | null>(null)
const action = ref<'accept' | 'reject' | null>(null)

async function loadAll() {
  pageError.value = null
  try {
    await team.fetchMyInvitations({ includeHistory: true })
  } catch (e) {
    pageError.value = errorMessage(e, t('dashboard.my_invitations.errors.load'))
  }
}

watch(() => team.myInvitationsLoaded, (loaded) => {
  if (!loaded) loadAll()
}, { immediate: true })

const pending = computed(() =>
  team.myInvitations.filter((i: InvitationResponseDto) => i.status === 'PENDING')
)
const history = computed(() =>
  team.myInvitations.filter((i: InvitationResponseDto) => i.status !== 'PENDING')
)

const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value, {
  year: 'numeric',
  month: 'short',
  day: '2-digit'
}))

function formatDate(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return dateFormatter.value.format(d)
}

function expiresLabel(inv: InvitationResponseDto): string {
  const exp = new Date(inv.expiresAt).getTime()
  if (exp < Date.now()) {
    return t('dashboard.my_invitations.expired_on', { date: formatDate(inv.expiresAt) })
  }
  return t('dashboard.my_invitations.expires_on', { date: formatDate(inv.expiresAt) })
}

function historySubLabel(inv: InvitationResponseDto): string {
  if (inv.status === 'ACCEPTED' && inv.acceptedAt) {
    return t('dashboard.my_invitations.accepted_on', { date: formatDate(inv.acceptedAt) })
  }
  if (inv.status === 'EXPIRED') {
    return t('dashboard.my_invitations.expired_on', { date: formatDate(inv.expiresAt) })
  }
  if (inv.createdAt) {
    return t('dashboard.my_invitations.received_on', { date: formatDate(inv.createdAt) })
  }
  return ''
}

async function accept(inv: InvitationResponseDto) {
  if (!inv.token || actingId.value !== null) return
  actingId.value = inv.id
  action.value = 'accept'
  pageError.value = null
  try {
    await team.acceptInvitation(inv.token)
    toast.push({ type: 'success', description: t('invitations.accepted_title') })
    await Promise.all([
      team.fetchMyInvitations({ includeHistory: true }),
      orgs.fetchList()
    ])
  } catch (e) {
    pageError.value = errorMessage(e, t('dashboard.my_invitations.errors.accept'))
  } finally {
    actingId.value = null
    action.value = null
  }
}

async function reject(inv: InvitationResponseDto) {
  if (!inv.token || actingId.value !== null) return
  actingId.value = inv.id
  action.value = 'reject'
  pageError.value = null
  try {
    await team.rejectInvitation(inv.token)
    await team.fetchMyInvitations({ includeHistory: true })
  } catch (e) {
    pageError.value = errorMessage(e, t('dashboard.my_invitations.errors.reject'))
  } finally {
    actingId.value = null
    action.value = null
  }
}

function isActing(inv: InvitationResponseDto, kind: 'accept' | 'reject'): boolean {
  return actingId.value === inv.id && action.value === kind
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
  <div class="flex flex-col gap-6 px-4 pb-10 pt-5 sm:px-5 sm:pb-16 sm:pt-7 lg:px-8">
    <div>
      <h1 class="text-[22px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[26px]">
        {{ t('dashboard.my_invitations.page_title') }}
      </h1>
      <p class="mt-1 max-w-[640px] text-[14px] leading-relaxed text-ink-soft">
        {{ t('dashboard.my_invitations.page_subtitle') }}
      </p>
    </div>

    <div v-if="pageError" role="alert"
      class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ pageError }}
    </div>

    <div class="flex max-w-[760px] flex-col gap-5">
      <!-- Pending -->
      <section class="rounded-[14px] border border-line bg-bg-card shadow-card">
        <header class="px-5 pb-3 pt-5 sm:px-6">
          <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {{ t('dashboard.my_invitations.pending_section_title') }}
          </h2>
          <p class="mt-0.5 text-[12px] text-ink-muted">
            {{ t('dashboard.my_invitations.pending_section_count', pending.length, { named: { n: pending.length } }) }}
          </p>
        </header>

        <div v-if="team.loadingMyInvitations && pending.length === 0"
          class="px-5 pb-6 pt-2 text-[13px] text-ink-muted sm:px-6">
          {{ t('common.loading') }}
        </div>
        <div v-else-if="pending.length === 0" class="px-5 pb-6 pt-2 text-[13px] text-ink-muted sm:px-6">
          {{ t('dashboard.my_invitations.pending_empty') }}
        </div>

        <ul v-else class="divide-y divide-line border-t border-line">
          <li v-for="inv in pending" :key="inv.id"
            class="flex flex-col gap-3 px-5 py-4 sm:px-6">
            <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3.5">
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <div
                  class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-bg-soft text-ink-soft">
                  <DashboardIcon name="mail" :size="16" />
                </div>
                <div class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-[13.5px] font-medium tracking-[-0.005em] text-ink">
                    {{ t('dashboard.my_invitations.invitation_to', { org: inv.organization.name }) }}
                  </span>
                  <span class="truncate text-[12px] text-ink-muted">{{ expiresLabel(inv) }}</span>
                </div>
              </div>
              <div class="flex items-center justify-end gap-2 sm:gap-3">
                <DashboardRoleChip :role="inv.role" />
              </div>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button"
                class="reject-btn"
                :disabled="actingId !== null"
                @click="reject(inv)">
                <span v-if="isActing(inv, 'reject')">{{ t('dashboard.my_invitations.rejecting') }}</span>
                <span v-else>{{ t('dashboard.my_invitations.reject') }}</span>
              </button>
              <button type="button"
                class="accept-btn"
                :disabled="actingId !== null"
                @click="accept(inv)">
                <span v-if="isActing(inv, 'accept')">{{ t('dashboard.my_invitations.accepting') }}</span>
                <span v-else>{{ t('dashboard.my_invitations.accept') }}</span>
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- History -->
      <section class="rounded-[14px] border border-line bg-bg-card shadow-card">
        <header class="px-5 pb-3 pt-5 sm:px-6">
          <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {{ t('dashboard.my_invitations.history_section_title') }}
          </h2>
          <p class="mt-0.5 text-[12px] text-ink-muted">
            {{ t('dashboard.my_invitations.history_section_subtitle') }}
          </p>
        </header>

        <div v-if="team.loadingMyInvitations && history.length === 0"
          class="px-5 pb-6 pt-2 text-[13px] text-ink-muted sm:px-6">
          {{ t('common.loading') }}
        </div>
        <div v-else-if="history.length === 0" class="px-5 pb-6 pt-2 text-[13px] text-ink-muted sm:px-6">
          {{ t('dashboard.my_invitations.history_empty') }}
        </div>

        <ul v-else class="divide-y divide-line border-t border-line">
          <li v-for="inv in history" :key="inv.id"
            class="flex flex-col gap-2.5 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-3.5 sm:px-6">
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-bg-soft text-ink-soft">
                <DashboardIcon name="mail" :size="16" />
              </div>
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-[13.5px] font-medium tracking-[-0.005em] text-ink">
                  {{ t('dashboard.my_invitations.invitation_to', { org: inv.organization.name }) }}
                </span>
                <span class="truncate text-[12px] text-ink-muted">{{ historySubLabel(inv) }}</span>
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <DashboardRoleChip :role="inv.role" />
              <span class="status-chip" :class="`status-chip--${inv.status.toLowerCase()}`">
                {{ t(`dashboard.my_invitations.status.${inv.status}`) }}
              </span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.accept-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--c-ink);
  background: var(--c-ink);
  color: var(--c-bg-card);
  transition: background .15s, opacity .15s;
}
.accept-btn:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-ink) 90%, transparent);
}
.accept-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.reject-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink-soft);
  transition: background .15s, border-color .15s, color .15s, opacity .15s;
}
.reject-btn:hover:not(:disabled) {
  background: var(--c-bg-soft);
  border-color: var(--c-line-strong);
  color: var(--c-ink);
}
.reject-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 9px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
  white-space: nowrap;
  border: 1px solid transparent;
}
.status-chip--accepted {
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
}
.status-chip--rejected,
.status-chip--cancelled {
  background: var(--c-danger-soft);
  color: var(--c-danger);
}
.status-chip--expired {
  background: var(--c-bg-soft);
  color: var(--c-ink-muted);
}
.status-chip--pending {
  background: var(--c-bg-card);
  color: var(--c-ink);
  border-color: var(--c-line-strong);
}
</style>
