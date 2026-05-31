<script setup lang="ts">
import type { SecurityActivityEntry, SecurityEventType } from '~/types/api'

const { t, locale } = useI18n()
const store = useSecurityActivityStore()

onMounted(() => {
  void store.fetchPage(0)
})

const hasEntries = computed(() => store.entries.length > 0)
const showPagination = computed(() => store.totalPages > 1)
const isLoading = computed(() => store.loading)
const hasError = computed(() => !!store.error)

/**
 * Masks the last byte of an IPv4 address (or last 16 bits of an IPv6 hextet)
 * to avoid pasting a full client IP into the rendered DOM.
 */
function maskIp(ip: string | null): string {
  if (!ip) return '—'
  if (ip.includes(':')) {
    const parts = ip.split(':')
    if (parts.length < 2) return ip
    return parts.slice(0, parts.length - 1).join(':') + ':•••'
  }
  const parts = ip.split('.')
  if (parts.length !== 4) return ip
  return `${parts[0]}.${parts[1]}.${parts[2]}.•`
}

/**
 * Compact User-Agent display. Most production UAs are too long for an inline
 * table cell, so we surface the leading product token only (e.g.
 * "Mozilla/5.0 (Macintosh ...)" → "Mozilla/5.0").
 */
function shortUa(ua: string | null): string {
  if (!ua) return '—'
  const head = ua.split(' ')[0] ?? ua
  return head.length > 40 ? head.slice(0, 40) + '…' : head
}

const RELATIVE_FORMATTER = computed(() =>
  new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
)
const ABSOLUTE_FORMATTER = computed(() =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
)

interface RelativeUnit { unit: Intl.RelativeTimeFormatUnit, ms: number }
const RELATIVE_UNITS: RelativeUnit[] = [
  { unit: 'year',   ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month',  ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day',    ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour',   ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 }
]

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = then - Date.now()
  const abs = Math.abs(diff)
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (abs >= ms || unit === 'second') {
      return RELATIVE_FORMATTER.value.format(Math.round(diff / ms), unit)
    }
  }
  return ABSOLUTE_FORMATTER.value.format(new Date(iso))
}

function absoluteTime(iso: string): string {
  return ABSOLUTE_FORMATTER.value.format(new Date(iso))
}

function eventLabel(entry: SecurityActivityEntry): string {
  const key = `dashboard.account.security.event.${entry.eventType}`
  return t(key, entry.eventType)
}

const EVENT_TONE: Record<SecurityEventType, 'ok' | 'warn' | 'danger' | 'info'> = {
  LOGIN_SUCCESS: 'ok',
  LOGIN_FAILED: 'warn',
  LOGOUT: 'info',
  PASSWORD_CHANGED: 'info',
  PASSWORD_RESET_REQUESTED: 'info',
  PASSWORD_RESET_COMPLETED: 'info',
  EMAIL_VERIFIED: 'ok',
  TWO_FACTOR_ENABLED: 'ok',
  TWO_FACTOR_DISABLED: 'warn',
  TWO_FACTOR_CHALLENGE_FAILED: 'warn',
  OAUTH_LINKED: 'info',
  OAUTH_UNLINKED: 'info',
  REFRESH_REUSE_DETECTED: 'danger',
  NEW_DEVICE_LOGIN: 'warn',
  SESSION_REVOKED: 'info'
}

function toneClasses(tone: 'ok' | 'warn' | 'danger' | 'info'): string {
  switch (tone) {
    case 'ok': return 'bg-success-soft text-success border-success/20'
    case 'warn': return 'bg-warn-soft text-warn border-warn/20'
    case 'danger': return 'bg-danger-soft text-danger border-danger/20'
    case 'info': return 'bg-bg-elevated text-ink-soft border-line'
  }
}

function entryTone(entry: SecurityActivityEntry): string {
  if (!entry.success) return toneClasses('warn')
  return toneClasses(EVENT_TONE[entry.eventType] ?? 'info')
}

async function changePage(target: number) {
  if (target < 0 || target >= store.totalPages || target === store.page) return
  await store.fetchPage(target)
}
</script>

<template>
  <section class="rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
    <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
      {{ t('dashboard.account.security.section_title') }}
    </h2>
    <p class="mb-4 mt-1 text-[12.5px] leading-relaxed text-ink-muted">
      {{ t('dashboard.account.security.subtitle') }}
    </p>

    <div v-if="hasError" role="alert"
      class="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ t('dashboard.account.security.errors.load_failed') }}
    </div>

    <div v-if="isLoading && !hasEntries" class="py-8 text-center text-[13px] text-ink-muted">
      {{ t('dashboard.account.security.loading') }}
    </div>

    <div v-else-if="!hasEntries && !hasError" class="py-8 text-center text-[13px] text-ink-muted">
      {{ t('dashboard.account.security.empty') }}
    </div>

    <ul v-else class="flex flex-col divide-y divide-line">
      <li v-for="entry in store.entries" :key="entry.id"
        class="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <span :class="['inline-flex h-7 shrink-0 items-center rounded-full border px-2 text-[11px] font-medium', entryTone(entry)]">
            {{ eventLabel(entry) }}
          </span>
          <div class="flex flex-col">
            <span class="text-[13px] text-ink">
              <time :datetime="entry.createdAt" :title="absoluteTime(entry.createdAt)">
                {{ relativeTime(entry.createdAt) }}
              </time>
            </span>
            <span class="text-[12px] text-ink-muted">
              {{ maskIp(entry.ipAddress) }} · {{ shortUa(entry.userAgent) }}
            </span>
          </div>
        </div>
      </li>
    </ul>

    <nav v-if="showPagination" class="mt-4 flex items-center justify-between text-[12.5px] text-ink-muted"
      :aria-label="t('dashboard.account.security.pagination_label')">
      <button type="button" class="rounded-md border border-line px-3 py-1.5 transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="store.page === 0 || isLoading" @click="changePage(store.page - 1)">
        {{ t('dashboard.account.security.previous') }}
      </button>
      <span>{{ t('dashboard.account.security.page_of', { current: store.page + 1, total: store.totalPages }) }}</span>
      <button type="button" class="rounded-md border border-line px-3 py-1.5 transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="store.page >= store.totalPages - 1 || isLoading" @click="changePage(store.page + 1)">
        {{ t('dashboard.account.security.next') }}
      </button>
    </nav>
  </section>
</template>
