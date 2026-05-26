<script setup lang="ts">
import type { UserSession } from '~/types/api'

const { t, locale } = useI18n()
const store = useSessionsStore()
const toast = useToastStore()

const editingId = ref<number | null>(null)
const draftName = ref('')
const revokingId = ref<number | null>(null)
const revokingAll = ref(false)
const confirmRevokeId = ref<number | null>(null)
const confirmRevokeAll = ref(false)

onMounted(() => {
  void store.fetchAll()
})

const hasOthers = computed(() => store.sessions.some(s => !s.current))
const ABSOLUTE = computed(() =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
)
const RELATIVE = computed(() =>
  new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
)

interface RelativeUnit { unit: Intl.RelativeTimeFormatUnit, ms: number }
const UNITS: RelativeUnit[] = [
  { unit: 'year',   ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month',  ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day',    ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour',   ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 }
]

function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  for (const { unit, ms } of UNITS) {
    if (abs >= ms || unit === 'second') {
      return RELATIVE.value.format(Math.round(diff / ms), unit)
    }
  }
  return ABSOLUTE.value.format(new Date(iso))
}

function absolute(iso: string): string {
  return ABSOLUTE.value.format(new Date(iso))
}

function maskIp(ip: string | null): string {
  if (!ip) return '—'
  if (ip.includes(':')) {
    const parts = ip.split(':')
    return parts.slice(0, parts.length - 1).join(':') + ':•••'
  }
  const parts = ip.split('.')
  if (parts.length !== 4) return ip
  return `${parts[0]}.${parts[1]}.${parts[2]}.•`
}

function startEdit(session: UserSession) {
  editingId.value = session.id
  draftName.value = session.displayName
}

function cancelEdit() {
  editingId.value = null
  draftName.value = ''
}

async function saveEdit(session: UserSession) {
  const next = draftName.value.trim()
  if (!next || next === session.displayName) {
    cancelEdit()
    return
  }
  try {
    await store.rename(session.id, next)
    toast.push({ type: 'success', description: t('dashboard.account.sessions.renamed') })
  } catch {
    toast.push({ type: 'error', description: t('dashboard.account.sessions.errors.rename_failed') })
  } finally {
    cancelEdit()
  }
}

async function revokeSession(id: number) {
  revokingId.value = id
  try {
    await store.revoke(id)
    toast.push({ type: 'success', description: t('dashboard.account.sessions.revoked') })
  } catch {
    toast.push({ type: 'error', description: t('dashboard.account.sessions.errors.revoke_failed') })
  } finally {
    revokingId.value = null
    confirmRevokeId.value = null
  }
}

async function revokeAllOthers() {
  revokingAll.value = true
  try {
    await store.revokeAllOthers()
    toast.push({ type: 'success', description: t('dashboard.account.sessions.revoked_all') })
  } catch {
    toast.push({ type: 'error', description: t('dashboard.account.sessions.errors.revoke_failed') })
  } finally {
    revokingAll.value = false
    confirmRevokeAll.value = false
  }
}
</script>

<template>
  <section class="rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {{ t('dashboard.account.sessions.section_title') }}
        </h2>
        <p class="mb-4 mt-1 text-[12.5px] leading-relaxed text-ink-muted">
          {{ t('dashboard.account.sessions.subtitle') }}
        </p>
      </div>
      <button v-if="hasOthers" type="button"
        class="mt-1 shrink-0 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-bg-elevated disabled:opacity-50"
        :disabled="revokingAll" @click="confirmRevokeAll = true">
        {{ t('dashboard.account.sessions.revoke_all_others') }}
      </button>
    </div>

    <div v-if="store.error" role="alert"
      class="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ t('dashboard.account.sessions.errors.load_failed') }}
    </div>

    <div v-if="store.loading && store.sessions.length === 0"
      class="py-8 text-center text-[13px] text-ink-muted">
      {{ t('dashboard.account.sessions.loading') }}
    </div>

    <div v-else-if="store.sessions.length === 0 && !store.error"
      class="py-8 text-center text-[13px] text-ink-muted">
      {{ t('dashboard.account.sessions.empty') }}
    </div>

    <ul v-else class="flex flex-col divide-y divide-line">
      <li v-for="session in store.sessions" :key="session.id" class="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <template v-if="editingId === session.id">
              <input v-model="draftName" type="text"
                class="rounded-md border border-line bg-field px-2 py-1 text-[13.5px] text-ink outline-none focus:border-accent"
                maxlength="120" @keydown.enter.prevent="saveEdit(session)" @keydown.esc.prevent="cancelEdit">
              <button type="button"
                class="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-ink hover:bg-accent/90"
                @click="saveEdit(session)">{{ t('dashboard.account.sessions.save') }}</button>
              <button type="button"
                class="rounded-md border border-line px-2.5 py-1 text-[12px] text-ink-soft hover:bg-bg-elevated"
                @click="cancelEdit">{{ t('dashboard.account.sessions.cancel') }}</button>
            </template>
            <template v-else>
              <span class="text-[14px] font-medium text-ink">{{ session.displayName }}</span>
              <span v-if="session.current"
                class="inline-flex h-5 items-center rounded-full bg-success-soft px-2 text-[11px] font-medium text-success">
                {{ t('dashboard.account.sessions.current') }}
              </span>
              <button type="button"
                class="text-[12px] text-ink-muted underline-offset-2 hover:underline"
                @click="startEdit(session)">{{ t('dashboard.account.sessions.rename') }}</button>
            </template>
          </div>
          <span class="text-[12px] text-ink-muted">
            {{ maskIp(session.lastIp) }} ·
            <time :datetime="session.lastSeenAt" :title="absolute(session.lastSeenAt)">{{ relative(session.lastSeenAt) }}</time>
          </span>
        </div>
        <div v-if="!session.current" class="shrink-0">
          <button v-if="confirmRevokeId !== session.id" type="button"
            class="rounded-md border border-danger/40 px-3 py-1.5 text-[12.5px] font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
            :disabled="revokingId === session.id" @click="confirmRevokeId = session.id">
            {{ t('dashboard.account.sessions.revoke') }}
          </button>
          <div v-else class="flex items-center gap-2">
            <button type="button"
              class="rounded-md bg-danger px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-danger/90 disabled:opacity-50"
              :disabled="revokingId === session.id" @click="revokeSession(session.id)">
              {{ t('dashboard.account.sessions.confirm') }}
            </button>
            <button type="button"
              class="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-bg-elevated"
              @click="confirmRevokeId = null">
              {{ t('dashboard.account.sessions.cancel') }}
            </button>
          </div>
        </div>
      </li>
    </ul>

    <div v-if="confirmRevokeAll"
      class="mt-4 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-[13px] text-ink">
      <p class="mb-2">{{ t('dashboard.account.sessions.confirm_revoke_all') }}</p>
      <div class="flex items-center gap-2">
        <button type="button"
          class="rounded-md bg-danger px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-danger/90 disabled:opacity-50"
          :disabled="revokingAll" @click="revokeAllOthers">
          {{ t('dashboard.account.sessions.confirm') }}
        </button>
        <button type="button"
          class="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-bg-elevated"
          @click="confirmRevokeAll = false">
          {{ t('dashboard.account.sessions.cancel') }}
        </button>
      </div>
    </div>
  </section>
</template>
