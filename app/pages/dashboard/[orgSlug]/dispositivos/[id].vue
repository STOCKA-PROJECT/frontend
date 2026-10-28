<script setup lang="ts">
import type { DeviceResponseDto } from '~/types/api'

definePageMeta({ layout: 'dashboard' })

/**
 * One registered player: control it from the local network with the same options as the belén app
 * (`usePiControl`) and read the log Stocka keeps for it. The device row comes from the devices list
 * (reloaded here), which also carries the address and the PIN the page connects with.
 */
const { t } = useI18n()
const route = useRoute()
const { slug: orgSlug, org } = useCurrentOrg()
const { orgPath } = useOrgPath()
const devices = useDevicesStore()
const apiError = useApiError()

const deviceId = computed(() => Number(route.params.id))
const role = computed(() => org.value?.currentUserRole ?? null)
const devicesEnabled = computed(() => org.value?.portsEnabled === true)
const loadError = ref<string | null>(null)
const loaded = ref(false)

const device = computed<DeviceResponseDto | null>(() => devices.list.find(d => d.id === deviceId.value) ?? null)

async function load() {
  if (!orgSlug.value || !devicesEnabled.value) return
  try {
    await devices.load(orgSlug.value)
    loadError.value = null
  } catch (e) {
    loadError.value = apiError(e).description
  } finally {
    loaded.value = true
  }
}

watch([orgSlug, devicesEnabled], () => void load(), { immediate: true })
// The heartbeat fields (online, last seen) refresh with the list.
useVisiblePolling(load, 30_000)

useSeoMeta({
  title: () => device.value?.name ?? t('dashboard.devices.page_title'),
  robots: 'noindex, nofollow'
})
</script>

<template>
  <div class="device-page page flex flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 sm:pt-7 lg:px-8">
    <NuxtLink :to="orgPath('/dispositivos')" class="back-link">
      <DashboardIcon name="caret" :size="14" class="rotate-90" />
      {{ t('dashboard.device.back') }}
    </NuxtLink>

    <div v-if="!devicesEnabled && org" class="dp-empty">
      <h2>{{ t('dashboard.devices.not_available.title') }}</h2>
      <p>{{ t('dashboard.devices.not_available.body') }}</p>
    </div>
    <p v-else-if="loadError" class="dp-notice dp-notice-danger">{{ loadError }}</p>
    <div v-else-if="loaded && !device" class="dp-empty">
      <h2>{{ t('dashboard.device.not_found') }}</h2>
    </div>

    <template v-else-if="device && orgSlug">
      <DashboardDevicePiPanel :device="device" :org-slug="orgSlug" :role="role" />
      <DashboardDeviceLogs :device="device" :org-slug="orgSlug" />
    </template>
  </div>
</template>

<style scoped>
.page { min-height: calc(100vh - var(--topbar-h, 60px)); }
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  font-size: 13px;
  color: var(--c-ink-soft);
  text-decoration: none;
}
.back-link:hover { color: var(--c-ink); }
</style>

<style>
/*
 * Brandbook pieces shared by the panels of the device page (components/dashboard/device/*):
 * cards on surface-panel with radius-lg, uppercase labels, state badges with the ok/warn/danger
 * pairs, data in mono, small buttons labelled verb + object with one primary per card.
 */
.device-page .dp-card {
  border-radius: 10px;
  border: 1px solid var(--c-line-strong);
  background: var(--c-bg-card);
  padding: 14px 16px;
  min-width: 0;
}
.device-page .dp-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.device-page .dp-label {
  font-size: 11px;
  line-height: 14px;
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--c-ink-muted);
}
.device-page .dp-hint { font-size: 12.5px; line-height: 18px; color: var(--c-ink-muted); }
.device-page .mono { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12.5px; }
.device-page .badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 8px;
  border-radius: 3px;
  background: var(--c-bg-alt);
  color: var(--c-ink-soft);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  white-space: nowrap;
}
.device-page .badge::before { content: ""; width: 6px; height: 6px; flex: none; border-radius: 50%; background: currentColor; }
.device-page .badge-ok { background: var(--c-ok-soft); color: var(--c-ok); }
.device-page .badge-brand { background: var(--c-accent-soft); color: var(--c-accent-ink); }
.device-page .badge-warn { background: var(--c-warn-soft); color: var(--c-warn-ink); }
.device-page .badge-danger { background: var(--c-danger-soft); color: var(--c-danger); }
.device-page .badge-highlight { background: color-mix(in oklab, var(--c-highlight) 22%, var(--c-bg-card)); color: var(--c-highlight-ink); }
.device-page .dp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid var(--c-line-control, var(--c-line-strong));
  background: var(--c-bg-card);
  color: var(--c-ink);
  cursor: pointer;
  transition: background .12s, border-color .12s, color .12s;
}
.device-page .dp-btn:hover:not(:disabled) { background: var(--c-bg-soft); }
.device-page .dp-btn:disabled { opacity: .5; cursor: not-allowed; }
.device-page .dp-btn:focus-visible, .device-page .dp-field:focus-visible, .device-page .dp-swatch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--c-bg-card), 0 0 0 4px var(--c-accent);
}
.device-page .dp-btn-lg { height: 40px; padding: 0 16px; font-size: 14px; }
.device-page .dp-btn-primary { border-color: var(--c-ink); background: var(--c-ink); color: var(--c-bg-card); }
.device-page .dp-btn-primary:hover:not(:disabled) { background: color-mix(in oklab, var(--c-ink) 88%, #000); }
.device-page .dp-btn-danger { border-color: var(--c-danger); color: var(--c-danger); }
.device-page .dp-btn-danger:hover:not(:disabled) { background: var(--c-danger-soft); }
.device-page .dp-btn-danger-solid { border-color: var(--c-danger); background: var(--c-danger); color: #fff; }
.device-page .dp-btn-danger-solid:hover:not(:disabled) { filter: brightness(.92); }
.device-page .dp-btn-quiet { border-color: transparent; background: transparent; }
.device-page .dp-field {
  height: 30px;
  min-width: 0;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid var(--c-line-control, var(--c-line-strong));
  background: var(--c-bg-card);
  color: var(--c-ink);
  font-size: 13px;
}
.device-page .dp-meta { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0; }
.device-page .dp-meta > div { display: flex; align-items: baseline; gap: 6px; font-size: 12.5px; line-height: 16px; }
.device-page .dp-meta dt { color: var(--c-ink-muted); }
.device-page .dp-meta dd { margin: 0; font-family: var(--font-mono, ui-monospace, monospace); color: var(--c-ink-soft); }
.device-page .dp-list { display: flex; flex-direction: column; }
.device-page .dp-list > li { border-top: 1px solid var(--c-line); padding: 10px 0; }
.device-page .dp-list > li:first-child { border-top: 0; }
.device-page .dp-notice { border-radius: 6px; padding: 8px 10px; font-size: 13px; line-height: 18px; }
.device-page .dp-notice-danger { background: var(--c-danger-soft); color: var(--c-danger); }
.device-page .dp-notice-warn { background: var(--c-warn-soft); color: var(--c-warn-ink); }
.device-page .dp-notice-ok { background: var(--c-ok-soft); color: var(--c-ok); }
.device-page .dp-notice-info { background: var(--c-accent-soft); color: var(--c-accent-ink); }
.device-page .dp-progress { height: 6px; border-radius: 3px; background: var(--c-bg-alt); overflow: hidden; }
.device-page .dp-progress > span { display: block; height: 100%; background: var(--c-accent); transition: width .2s; }
.device-page .dp-empty {
  border-radius: 12px;
  border: 1px dashed var(--c-line);
  background: var(--c-bg-soft);
  padding: 40px 20px;
  text-align: center;
}
.device-page .dp-empty h2 { font-size: 15px; font-weight: 600; color: var(--c-ink); }
.device-page .dp-empty p { margin-top: 6px; font-size: 13.5px; color: var(--c-ink-soft); }
@media (prefers-reduced-motion: reduce) {
  .device-page .dp-progress > span, .device-page .dp-btn { transition: none; }
}
</style>
