<script setup lang="ts">
import type { TimelineResponseDto } from '~/types/api'
import type { PiBundles } from '~/types/pi'
import type { PiUploadState } from '~/composables/usePiControl'
import { formatBytes, hash8, percent } from '~/utils/pi/piFormat'

/**
 * Sends a timeline to the player (Stocka builds its `.belen.zip`, the page uploads it in pieces)
 * and manages the bundles the player keeps: activate one, go back to the previous one, delete.
 */
const props = defineProps<{
  orgSlug: string
  bundles: PiBundles | null
  upload: PiUploadState | null
  canControl: boolean
  busy: boolean
  /** Timeline the active show was exported from, to preselect it. */
  activeTimelineId: number | null
}>()

const emit = defineEmits<{
  send: [timelineName: string, download: () => Promise<Blob>, activate: boolean]
  cancel: []
  dismiss: []
  activate: [hash: string]
  remove: [hash: string]
  rollback: []
}>()

const { t, locale } = useI18n()
const timelines = useTimelinesStore()
const apiError = useApiError()

const selectedId = ref<number | null>(null)
const activateAfter = ref(true)
const confirmDelete = ref<{ hash: string, name: string } | null>(null)

const sorted = computed<TimelineResponseDto[]>(() => [...timelines.list].sort((a, b) => a.name.localeCompare(b.name)))
const selected = computed(() => timelines.list.find(tl => tl.id === selectedId.value) ?? null)
const inFlight = computed(() => !!props.upload && ['downloading', 'uploading', 'verifying'].includes(props.upload.phase))
const uploadPercent = computed(() => (props.upload ? percent(props.upload.sent, props.upload.total) : 0))
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }))

onMounted(() => {
  if (!timelines.list.length) void timelines.fetchList(props.orgSlug).catch(() => {})
})

watch([() => props.activeTimelineId, () => timelines.list.length], () => {
  if (selectedId.value === null && props.activeTimelineId !== null && timelines.list.some(tl => tl.id === props.activeTimelineId)) {
    selectedId.value = props.activeTimelineId
  }
}, { immediate: true })

function send() {
  const timeline = selected.value
  if (!timeline) return
  const download = async () => {
    try {
      return (await timelines.downloadBundle(props.orgSlug, timeline)).blob
    } catch (err) {
      throw new Error(apiError(err).description)
    }
  }
  emit('send', timeline.name, download, activateAfter.value)
}

function importedAt(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : dateFormatter.value.format(date)
}

function onConfirmDelete() {
  if (confirmDelete.value) emit('remove', confirmDelete.value.hash)
  confirmDelete.value = null
}
</script>

<template>
  <section class="dp-card flex flex-col gap-4">
    <div v-if="canControl" class="flex flex-col gap-2">
      <span class="dp-label">{{ t('dashboard.device.pi.send.title') }}</span>

      <template v-if="upload">
        <template v-if="inFlight">
          <p class="text-[13px] text-ink">
            <template v-if="upload.phase === 'downloading'">{{ t('dashboard.device.pi.send.downloading', { name: upload.timelineName }) }}</template>
            <template v-else-if="upload.phase === 'uploading'">{{ t('dashboard.device.pi.send.uploading', { name: upload.timelineName, percent: uploadPercent }) }}</template>
            <template v-else>{{ t('dashboard.device.pi.send.verifying') }}</template>
          </p>
          <div class="dp-progress"><span :style="{ width: `${upload.phase === 'verifying' ? 100 : uploadPercent}%` }" /></div>
          <div class="flex items-center justify-between gap-2">
            <span class="dp-hint tabular-nums">{{ formatBytes(upload.sent) }} / {{ formatBytes(upload.total) }}</span>
            <button type="button" class="dp-btn" @click="emit('cancel')">{{ t('dashboard.device.pi.send.cancel') }}</button>
          </div>
        </template>
        <template v-else>
          <div v-if="upload.phase === 'error'" class="dp-notice dp-notice-danger">{{ t('dashboard.device.pi.send.failed', { message: upload.error ?? '' }) }}</div>
          <div v-else-if="upload.report" class="dp-notice" :class="upload.report.ok ? 'dp-notice-ok' : 'dp-notice-danger'">
            <strong>{{ upload.report.ok ? t('dashboard.device.pi.send.ok') : t('dashboard.device.pi.send.rejected') }}<template v-if="upload.report.ok && upload.report.activated"> {{ t('dashboard.device.pi.send.activated') }}</template></strong>
            <template v-if="upload.report.name"> · {{ upload.report.name }}</template>
            <template v-if="upload.report.hash"> · <code class="mono">{{ hash8(upload.report.hash) }}</code></template>
            <ul v-if="upload.report.errors.length || upload.report.warnings.length || upload.report.skipped.length" class="mt-1">
              <li v-for="(e, i) in upload.report.errors" :key="`e${i}`">{{ e.code }}: {{ e.message }}</li>
              <li v-for="(w, i) in upload.report.warnings" :key="`w${i}`" class="text-warn-ink">{{ w.code }}: {{ w.message }}</li>
              <li v-for="(s, i) in upload.report.skipped" :key="`s${i}`">{{ s }} ({{ t('dashboard.device.pi.send.skipped') }})</li>
            </ul>
          </div>
          <div>
            <button type="button" class="dp-btn" @click="emit('dismiss')">{{ t('dashboard.device.pi.send.close') }}</button>
          </div>
        </template>
      </template>

      <template v-else>
        <label class="flex flex-col gap-1">
          <span class="dp-hint">{{ t('dashboard.device.pi.send.timeline') }}</span>
          <select v-model="selectedId" class="dp-field">
            <option :value="null" disabled>{{ t('dashboard.device.pi.send.choose') }}</option>
            <option v-for="timeline in sorted" :key="timeline.id" :value="timeline.id">{{ timeline.name }}</option>
          </select>
        </label>
        <label class="inline-flex items-center gap-2 text-[13px] text-ink">
          <input v-model="activateAfter" type="checkbox">
          {{ t('dashboard.device.pi.send.activate') }}
        </label>
        <div>
          <button type="button" class="dp-btn dp-btn-primary" :disabled="busy || !selected" @click="send">
            <DashboardIcon name="upload" :size="14" />
            {{ t('dashboard.device.pi.send.button') }}
          </button>
        </div>
      </template>
    </div>

    <div class="flex flex-col gap-1">
      <div class="dp-card-head !mb-0">
        <span class="dp-label">{{ t('dashboard.device.pi.bundles.title') }}</span>
        <button v-if="canControl" type="button" class="dp-btn" :disabled="busy || !bundles?.previous" @click="emit('rollback')">
          {{ t('dashboard.device.pi.bundles.rollback') }}
        </button>
      </div>
      <ul v-if="bundles?.shows.length" class="dp-list">
        <li v-for="show in bundles.shows" :key="show.hash" class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-[13.5px] font-medium text-ink">{{ show.name || hash8(show.hash) }}</span>
            <span class="dp-hint">
              <code class="mono">{{ hash8(show.hash) }}</code> · {{ formatBytes(show.size) }} · {{ importedAt(show.importedAt) }}
            </span>
            <span class="mt-1 flex flex-wrap gap-1.5">
              <span v-if="show.active" class="badge badge-brand">{{ t('dashboard.device.pi.bundles.active') }}</span>
              <span v-if="show.previous" class="badge">{{ t('dashboard.device.pi.bundles.previous') }}</span>
            </span>
          </div>
          <div v-if="canControl && !show.active" class="flex gap-1.5">
            <button type="button" class="dp-btn" :disabled="busy" @click="emit('activate', show.hash)">{{ t('dashboard.device.pi.bundles.activate') }}</button>
            <button
              v-if="!show.previous"
              type="button"
              class="dp-btn dp-btn-danger"
              :disabled="busy"
              @click="confirmDelete = { hash: show.hash, name: show.name || hash8(show.hash) }"
            >
              {{ t('dashboard.device.pi.bundles.delete') }}
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="dp-hint">{{ t('dashboard.device.pi.bundles.none') }}</p>
    </div>

    <DashboardConfirmDialog
      :open="confirmDelete !== null"
      tone="danger"
      :title="t('dashboard.device.pi.bundles.delete_title')"
      :message="t('dashboard.device.pi.bundles.delete_message', { name: confirmDelete?.name ?? '' })"
      :confirm-label="t('dashboard.device.pi.bundles.delete')"
      @confirm="onConfirmDelete"
      @close="confirmDelete = null"
    />
  </section>
</template>
