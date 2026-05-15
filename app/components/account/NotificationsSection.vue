<script setup lang="ts">
import type { NotificationPreferenceResponseDto, UpdateNotificationPreferenceDto } from '~/types/api'

const { t } = useI18n()
const toast = useToastStore()
const apiError = useApiError()
const { fetchAll, update } = useNotificationPreferences()

const preferences = ref<NotificationPreferenceResponseDto[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const savingOrgId = ref<number | null>(null)
const pendingTimers = new Map<number, ReturnType<typeof setTimeout>>()
const lastSnapshots = new Map<number, NotificationPreferenceResponseDto>()

const DEBOUNCE_MS = 350

onMounted(async () => {
  await load()
})

onUnmounted(() => {
  for (const timer of pendingTimers.values()) clearTimeout(timer)
  pendingTimers.clear()
})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const data = await fetchAll()
    preferences.value = data
    for (const p of data) lastSnapshots.set(p.organizationId, structuredClone(p))
  } catch (e) {
    loadError.value = apiError(e).description || t('dashboard.account.notifications.errors.load')
  } finally {
    loading.value = false
  }
}

function onUpdate(next: NotificationPreferenceResponseDto) {
  const idx = preferences.value.findIndex(p => p.organizationId === next.organizationId)
  if (idx === -1) return
  preferences.value[idx] = next
  schedulePersist(next)
}

function schedulePersist(next: NotificationPreferenceResponseDto) {
  const orgId = next.organizationId
  const existing = pendingTimers.get(orgId)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    pendingTimers.delete(orgId)
    void persist(next)
  }, DEBOUNCE_MS)
  pendingTimers.set(orgId, timer)
}

async function persist(next: NotificationPreferenceResponseDto) {
  savingOrgId.value = next.organizationId
  const payload: UpdateNotificationPreferenceDto = {
    pieces: next.pieces,
    pieceScope: next.pieceScope,
    locations: next.locations,
    pieceTypes: next.pieceTypes
  }
  try {
    const saved = await update(next.organizationId, payload)
    const idx = preferences.value.findIndex(p => p.organizationId === saved.organizationId)
    if (idx !== -1) preferences.value[idx] = saved
    lastSnapshots.set(saved.organizationId, structuredClone(saved))
  } catch (e) {
    // Revert to the last known-good snapshot so the UI does not lie about persistence.
    const snapshot = lastSnapshots.get(next.organizationId)
    if (snapshot) {
      const idx = preferences.value.findIndex(p => p.organizationId === next.organizationId)
      if (idx !== -1) preferences.value[idx] = structuredClone(snapshot)
    }
    const view = apiError(e)
    toast.push({
      type: 'error',
      description: view.description || t('dashboard.account.notifications.errors.save')
    })
  } finally {
    if (savingOrgId.value === next.organizationId) savingOrgId.value = null
  }
}
</script>

<template>
  <section class="rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
    <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
      {{ t('dashboard.account.notifications.section_title') }}
    </h2>
    <p class="mb-4 mt-1 text-[12.5px] leading-relaxed text-ink-muted">
      {{ t('dashboard.account.notifications.subtitle') }}
    </p>

    <div v-if="loading" class="py-2 text-[13px] text-ink-muted">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="loadError" role="alert"
         class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ loadError }}
    </div>

    <p v-else-if="preferences.length === 0" class="py-2 text-[13px] text-ink-muted">
      {{ t('dashboard.account.notifications.empty') }}
    </p>

    <div v-else class="grid grid-cols-1 items-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
      <AccountNotificationOrganizationCard v-for="pref in preferences"
                                           :key="pref.organizationId"
                                           :preference="pref"
                                           :saving="savingOrgId === pref.organizationId"
                                           @update="onUpdate" />
    </div>
  </section>
</template>
