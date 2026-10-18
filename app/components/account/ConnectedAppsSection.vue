<script setup lang="ts">
import type { ConnectedApp } from '~/types/api'

const { t, locale } = useI18n()
const store = useConnectedAppsStore()
const toast = useToastStore()

const revokingId = ref<string | null>(null)
const confirmId = ref<string | null>(null)

onMounted(() => {
  void store.fetchAll()
})

const ABSOLUTE = computed(() =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
)

function absolute(iso: string | null): string {
  return iso ? ABSOLUTE.value.format(new Date(iso)) : '—'
}

function initial(app: ConnectedApp): string {
  return (app.name || '?').trim().charAt(0).toUpperCase()
}

function scopeLabel(scope: string): string {
  const key = `dashboard.account.connected_apps.scope.${scope}`
  return t(key, scope)
}

function permissionScopes(app: ConnectedApp): string[] {
  return app.scopes.filter(s => s !== 'offline_access')
}

async function revoke(app: ConnectedApp) {
  revokingId.value = app.clientId
  try {
    await store.revoke(app.clientId)
    toast.push({ type: 'success', description: t('dashboard.account.connected_apps.revoked') })
  } catch {
    toast.push({ type: 'error', description: t('dashboard.account.connected_apps.errors.revoke_failed') })
  } finally {
    revokingId.value = null
    confirmId.value = null
  }
}
</script>

<template>
  <section class="rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
    <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
      {{ t('dashboard.account.connected_apps.section_title') }}
    </h2>
    <p class="mb-4 mt-1 text-[12.5px] leading-relaxed text-ink-muted">
      {{ t('dashboard.account.connected_apps.subtitle') }}
    </p>

    <div v-if="store.error" role="alert"
      class="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ t('dashboard.account.connected_apps.errors.load_failed') }}
    </div>

    <div v-if="store.loading && store.apps.length === 0" class="py-8 text-center text-[13px] text-ink-muted">
      {{ t('dashboard.account.connected_apps.loading') }}
    </div>

    <div v-else-if="store.apps.length === 0 && !store.error" class="py-8 text-center text-[13px] text-ink-muted">
      {{ t('dashboard.account.connected_apps.empty') }}
    </div>

    <ul v-else class="flex flex-col divide-y divide-line">
      <li v-for="app in store.apps" :key="app.clientId"
        class="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 gap-3">
          <img v-if="app.logoUri" :src="app.logoUri" alt="" class="h-10 w-10 shrink-0 rounded-[10px] border border-line object-cover">
          <div v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-[15px] font-semibold text-accent">
            {{ initial(app) }}
          </div>
          <div class="flex min-w-0 flex-col gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[14px] font-medium text-ink">{{ app.name }}</span>
              <span v-if="app.trusted"
                class="inline-flex h-5 items-center rounded-full bg-success-soft px-2 text-[11px] font-medium text-success">
                {{ t('dashboard.account.connected_apps.trusted') }}
              </span>
              <span v-else
                class="inline-flex h-5 items-center rounded-full bg-warn-soft px-2 text-[11px] font-medium text-warn">
                {{ t('dashboard.account.connected_apps.untrusted') }}
              </span>
            </div>
            <a v-if="app.clientUri" :href="app.clientUri" target="_blank" rel="noopener noreferrer"
              class="truncate text-[12px] text-ink-muted underline-offset-2 hover:underline">{{ app.clientUri }}</a>
            <span class="text-[12px] text-ink-muted">
              {{ t('dashboard.account.connected_apps.granted_at', { date: absolute(app.grantedAt) }) }} ·
              <template v-if="app.lastUsedAt">
                {{ t('dashboard.account.connected_apps.last_used', { date: absolute(app.lastUsedAt) }) }}
              </template>
              <template v-else>{{ t('dashboard.account.connected_apps.never_used') }}</template>
            </span>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-muted">
                {{ t('dashboard.account.connected_apps.permissions') }}
              </span>
              <span v-for="scope in permissionScopes(app)" :key="scope"
                class="inline-flex h-5 items-center rounded-full bg-bg-soft px-2 text-[11px] text-ink-soft"
                :title="scope">{{ scopeLabel(scope) }}</span>
            </div>
          </div>
        </div>
        <div class="shrink-0">
          <button v-if="confirmId !== app.clientId" type="button"
            class="rounded-md border border-danger/40 px-3 py-1.5 text-[12.5px] font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
            :disabled="revokingId === app.clientId" @click="confirmId = app.clientId">
            {{ t('dashboard.account.connected_apps.revoke') }}
          </button>
          <div v-else class="flex items-center gap-2">
            <button type="button"
              class="rounded-md bg-danger px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-danger/90 disabled:opacity-50"
              :disabled="revokingId === app.clientId" @click="revoke(app)">
              {{ t('dashboard.account.connected_apps.confirm') }}
            </button>
            <button type="button"
              class="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-bg-elevated"
              @click="confirmId = null">
              {{ t('dashboard.account.connected_apps.cancel') }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
