<script setup lang="ts">
import { FetchError } from 'ofetch'

const props = defineProps<{
  orgSlug: string
  canManage: boolean
}>()

const { t, locale } = useI18n()
const pieces = usePiecesStore()

const status = computed(() => pieces.searchStatusFor(props.orgSlug))
const loading = ref(false)
const reindexing = ref(false)
const errorMsg = ref<string | null>(null)
const successVisible = ref(false)

watchEffect(async () => {
  if (!props.orgSlug) return
  loading.value = true
  errorMsg.value = null
  try {
    await pieces.fetchSearchStatus(props.orgSlug)
  } catch {
    errorMsg.value = t('dashboard.org_settings.search.errors.load')
  } finally {
    loading.value = false
  }
})

const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value, {
  dateStyle: 'medium',
  timeStyle: 'short'
}))

const lastTraining = computed(() => {
  const at = status.value?.lastTrainingLaunchedAt
  if (!at) return t('dashboard.org_settings.search.never')
  return dateFormatter.value.format(new Date(at))
})

const canReindex = computed(() =>
  props.canManage && Boolean(status.value?.enabled) && !reindexing.value && !loading.value
)

async function reindex() {
  if (!canReindex.value) return
  reindexing.value = true
  errorMsg.value = null
  successVisible.value = false
  try {
    await pieces.reindexSearch(props.orgSlug)
    successVisible.value = true
  } catch (e) {
    if (e instanceof FetchError && e.response?.status === 409) {
      errorMsg.value = t('dashboard.org_settings.search.errors.not_configured')
    } else if (e instanceof FetchError && e.response?.status === 403) {
      errorMsg.value = t('dashboard.org_settings.search.errors.forbidden')
    } else {
      errorMsg.value = t('dashboard.org_settings.search.errors.generic')
    }
  } finally {
    reindexing.value = false
  }
}
</script>

<template>
  <section class="rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-[16px] font-semibold leading-tight tracking-[-0.015em] text-ink">
          {{ t('dashboard.org_settings.search.title') }}
        </h2>
        <p class="mt-1 text-[13px] text-ink-soft">
          {{ t('dashboard.org_settings.search.subtitle') }}
        </p>
      </div>
      <button
        v-if="canManage && status?.enabled"
        type="button"
        class="action-btn shrink-0"
        :disabled="!canReindex"
        @click="reindex"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        <span>{{ reindexing ? t('dashboard.org_settings.search.reindexing') : t('dashboard.org_settings.search.reindex') }}</span>
      </button>
    </div>

    <div v-if="errorMsg" role="alert"
      class="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <div v-if="successVisible" role="status"
      class="mb-3 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-[13px] text-accent-ink">
      {{ t('dashboard.org_settings.search.reindexed') }}
    </div>

    <div v-if="status && !status.enabled"
      class="rounded-[10px] border border-dashed border-line bg-bg-soft px-4 py-6 text-center">
      <p class="text-[13px] text-ink-muted">
        {{ t('dashboard.org_settings.search.disabled') }}
      </p>
    </div>

    <dl v-else-if="status" class="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div class="stat">
        <dt>{{ t('dashboard.org_settings.search.state') }}</dt>
        <dd>
          <span class="dot" :class="status.indexed ? 'dot-on' : 'dot-off'" aria-hidden="true" />
          {{ status.indexed
            ? t('dashboard.org_settings.search.status_indexed')
            : t('dashboard.org_settings.search.status_not_indexed') }}
        </dd>
      </div>
      <div class="stat">
        <dt>{{ t('dashboard.org_settings.search.indexed_count') }}</dt>
        <dd>{{ status.indexedPieces }} / {{ status.totalPieces }}</dd>
      </div>
      <div class="stat">
        <dt>{{ t('dashboard.org_settings.search.last_training') }}</dt>
        <dd>
          {{ lastTraining }}
          <span v-if="status.trainingPending" class="pending">
            {{ t('dashboard.org_settings.search.pending') }}
          </span>
        </dd>
      </div>
    </dl>

    <p v-else-if="loading" class="text-[13px] text-ink-muted">
      {{ t('dashboard.org_settings.search.loading') }}
    </p>
  </section>
</template>

<style scoped>
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 9px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  font-size: 13px;
  font-weight: 500;
  transition: background .12s, border-color .12s;
}
.action-btn:hover:not(:disabled) { background: var(--c-bg-soft); }
.action-btn:disabled { opacity: .5; cursor: not-allowed; }
.stat {
  border: 1px solid var(--c-line);
  border-radius: 10px;
  background: var(--c-bg-soft);
  padding: 10px 12px;
}
.stat dt {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--c-ink-muted);
  letter-spacing: .03em;
  text-transform: uppercase;
}
.stat dd {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  color: var(--c-ink);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  display: inline-block;
}
.dot-on { background: var(--c-accent); }
.dot-off { background: var(--c-ink-muted); }
.pending {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
  font-size: 11px;
  font-weight: 500;
}
</style>
