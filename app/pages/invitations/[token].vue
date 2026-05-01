<script setup lang="ts">
import { FetchError } from 'ofetch'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const auth = useAuthStore()
const team = useTeamStore()
const orgs = useOrganizationsStore()

const token = computed(() => String(route.params.token ?? ''))

useSeoMeta({
  title: () => t('invitations.page_title'),
  robots: 'noindex, nofollow'
})

type Status = 'idle' | 'accepting' | 'rejecting' | 'accepted' | 'rejected'
const status = ref<Status>('idle')
const errorMsg = ref<string | null>(null)

function loginUrl(): string {
  return localePath('/login') + '?next=' + encodeURIComponent(route.fullPath)
}

function signupUrl(): string {
  return localePath('/registro') + '?next=' + encodeURIComponent(route.fullPath)
}

function mapError(e: unknown): string {
  if (e instanceof FetchError) {
    const s = e.response?.status
    if (s === 404) return t('invitations.errors.not_found')
    if (s === 403) return t('invitations.errors.email_mismatch')
    if (s === 410) return t('invitations.errors.expired')
    if (s === 400) return t('invitations.errors.already_used')
    const data = e.data as { message?: unknown } | undefined
    if (data && typeof data.message === 'string' && data.message.trim()) return data.message
  }
  return t('invitations.errors.generic')
}

async function accept() {
  if (!auth.isAuthenticated || !token.value || status.value !== 'idle') return
  status.value = 'accepting'
  errorMsg.value = null
  try {
    await team.acceptInvitation(token.value)
    status.value = 'accepted'
    await orgs.fetchList()
    setTimeout(() => navigateTo(localePath('/dashboard')), 900)
  } catch (e) {
    errorMsg.value = mapError(e)
    status.value = 'idle'
  }
}

async function reject() {
  if (!auth.isAuthenticated || !token.value || status.value !== 'idle') return
  status.value = 'rejecting'
  errorMsg.value = null
  try {
    await team.rejectInvitation(token.value)
    status.value = 'rejected'
  } catch (e) {
    errorMsg.value = mapError(e)
    status.value = 'idle'
  }
}
</script>

<template>
  <AuthFormCard
    :title="status === 'accepted' ? t('invitations.accepted_title')
      : status === 'rejected' ? t('invitations.rejected_title')
      : !auth.isAuthenticated ? t('invitations.not_authenticated_title')
      : t('invitations.title')"
    :subtitle="status === 'accepted' ? t('invitations.accepted_subtitle')
      : status === 'rejected' ? t('invitations.rejected_subtitle')
      : !auth.isAuthenticated ? t('invitations.not_authenticated_subtitle')
      : t('invitations.subtitle')"
  >
    <div
      v-if="errorMsg"
      role="alert"
      class="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger"
    >
      {{ errorMsg }}
    </div>

    <template v-if="status === 'accepted' || status === 'rejected'">
      <NuxtLink
        :to="localePath('/dashboard')"
        class="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-ink px-4 text-[14px] font-medium text-bg-card transition-[background] hover:bg-ink/90"
      >
        {{ t('invitations.back_to_dashboard') }}
      </NuxtLink>
    </template>

    <template v-else-if="!auth.isAuthenticated">
      <div class="flex flex-col gap-3">
        <NuxtLink
          :to="loginUrl()"
          class="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-ink px-4 text-[14px] font-medium text-bg-card transition-[background] hover:bg-ink/90"
        >
          {{ t('invitations.go_to_login') }}
        </NuxtLink>
        <p class="text-center text-[13px] text-ink-soft">
          {{ t('invitations.no_account') }}
          <NuxtLink :to="signupUrl()" class="ml-1 font-medium text-ink border-b border-line-strong pb-px transition-colors hover:border-ink">
            {{ t('invitations.create_account') }}
          </NuxtLink>
        </p>
      </div>
    </template>

    <template v-else>
      <div class="flex flex-col gap-3">
        <button
          type="button"
          class="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-ink px-4 text-[14px] font-medium text-bg-card transition-[background] hover:bg-ink/90 disabled:opacity-60"
          :disabled="status !== 'idle'"
          @click="accept"
        >
          {{ status === 'accepting' ? t('invitations.accepting') : t('invitations.accept') }}
        </button>
        <button
          type="button"
          class="inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-line bg-bg-card px-4 text-[14px] font-medium text-ink-soft transition-colors hover:bg-bg-soft hover:text-ink disabled:opacity-60"
          :disabled="status !== 'idle'"
          @click="reject"
        >
          {{ status === 'rejecting' ? t('invitations.rejecting') : t('invitations.reject') }}
        </button>
      </div>
    </template>
  </AuthFormCard>
</template>
