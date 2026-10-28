<script setup lang="ts">
import type { DeviceLogFileDto, DeviceResponseDto } from '~/types/api'
import { formatBytes } from '~/utils/pi/piFormat'

/**
 * The log of the player kept in Stocka (the player uploads it when it has Internet, the belén app
 * carries it when it has not): pick a day, read its last lines or the whole day, filter by level,
 * module and text, and download the day or a period. Reads Stocka only, so it works with the
 * player off.
 */
const props = defineProps<{
  device: DeviceResponseDto
  orgSlug: string
}>()

const { t, locale } = useI18n()
const devices = useDevicesStore()
const apiError = useApiError()
const toast = useToastStore()

/** Lines read first: enough to see what just happened without loading a whole day. */
const TAIL_LINES = 1000
/** Most matching lines drawn at once; a whole busy day can have tens of thousands. */
const MAX_RENDERED = 3000
const LINE_PATTERN = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \| ([^|]*?) *\| (\w+) *\| ?(.*)$/
const LEVELS = ['ERROR', 'WARNING', 'INFO', 'DEBUG'] as const

interface LogLine {
  key: number
  time: string
  module: string
  level: string
  message: string
}

const files = ref<DeviceLogFileDto[]>([])
const filesLoaded = ref(false)
const selectedFile = ref<string | null>(null)
const lines = shallowRef<LogLine[]>([])
const wholeDay = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const level = ref<string>('ALL')
const moduleFilter = ref<string>('ALL')
const search = ref('')
const periodFrom = ref('')
const periodTo = ref('')
const downloading = ref(false)

const selected = computed(() => files.value.find(f => f.file === selectedFile.value) ?? null)
const dateTime = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }))
const dayFormat = computed(() => new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))

function dayLabel(file: DeviceLogFileDto): string {
  const date = new Date(`${file.day}T12:00:00`)
  return Number.isNaN(date.getTime()) ? file.day : dayFormat.value.format(date)
}

function syncedLabel(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : dateTime.value.format(date)
}

/** Lines of the player's log; a line that does not start with a time (a traceback) belongs to the one before. */
function parse(text: string): LogLine[] {
  const out: LogLine[] = []
  text.split('\n').forEach((raw, index) => {
    if (!raw) return
    const m = LINE_PATTERN.exec(raw)
    if (m) {
      out.push({ key: index, time: m[1]!.slice(11), module: m[2]!.trim(), level: m[3]!.toUpperCase(), message: m[4]! })
      return
    }
    const previous = out[out.length - 1]
    out.push({ key: index, time: '', module: previous?.module ?? '', level: previous?.level ?? 'INFO', message: raw })
  })
  return out
}

const modules = computed(() => [...new Set(lines.value.map(l => l.module).filter(Boolean))].sort((a, b) => a.localeCompare(b)))

const matching = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return lines.value.filter(l =>
    (level.value === 'ALL' || l.level === level.value)
    && (moduleFilter.value === 'ALL' || l.module === moduleFilter.value)
    && (!needle || l.message.toLowerCase().includes(needle) || l.module.toLowerCase().includes(needle)))
})
const rendered = computed(() => matching.value.slice(-MAX_RENDERED))

async function loadFiles() {
  try {
    files.value = await devices.logFiles(props.orgSlug, props.device.id)
    error.value = null
    if (!selectedFile.value || !files.value.some(f => f.file === selectedFile.value)) {
      selectedFile.value = files.value[0]?.file ?? null
    }
    if (files.value.length) {
      periodTo.value ||= files.value[0]!.day
      periodFrom.value ||= files.value[Math.min(files.value.length, 7) - 1]!.day
    }
  } catch (e) {
    error.value = apiError(e).description
  } finally {
    filesLoaded.value = true
  }
}

async function loadText() {
  const file = selectedFile.value
  if (!file) {
    lines.value = []
    return
  }
  loading.value = true
  try {
    const text = await devices.logText(props.orgSlug, props.device.id, file, wholeDay.value ? undefined : TAIL_LINES)
    if (file === selectedFile.value) lines.value = parse(text)
    error.value = null
  } catch (e) {
    error.value = apiError(e).description
  } finally {
    loading.value = false
  }
}

async function refresh() {
  await loadFiles()
  await loadText()
}

async function download(what: 'day' | 'period') {
  if (downloading.value) return
  downloading.value = true
  try {
    if (what === 'day' && selectedFile.value) {
      await devices.downloadLogs(props.orgSlug, props.device.id, { file: selectedFile.value }, `${props.device.name}-${selectedFile.value}`)
    } else if (what === 'period') {
      await devices.downloadLogs(props.orgSlug, props.device.id, { from: periodFrom.value, to: periodTo.value },
        `${props.device.name}-${periodFrom.value}_${periodTo.value}.zip`)
    }
  } catch (e) {
    toast.push({ type: 'error', title: t('dashboard.device.logs.download_failed'), description: apiError(e).description })
  } finally {
    downloading.value = false
  }
}

watch([selectedFile, wholeDay], () => void loadText())
watch(() => props.device.id, () => {
  selectedFile.value = null
  files.value = []
  void refresh()
})
onMounted(() => void refresh())
</script>

<template>
  <section class="dp-card flex flex-col gap-3" :aria-label="t('dashboard.device.logs.title')">
    <div class="dp-card-head !mb-0">
      <div class="flex flex-col gap-0.5">
        <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">{{ t('dashboard.device.logs.title') }}</h2>
        <p class="dp-hint max-w-[680px]">{{ t('dashboard.device.logs.subtitle') }}</p>
      </div>
      <button type="button" class="dp-btn" :disabled="loading" @click="refresh">
        <DashboardIcon name="refresh" :size="14" />
        {{ t('dashboard.device.logs.refresh') }}
      </button>
    </div>

    <p v-if="error" class="dp-notice dp-notice-danger">{{ error }}</p>
    <p v-else-if="filesLoaded && !files.length" class="dp-empty-line">{{ t('dashboard.device.logs.none') }}</p>

    <template v-if="files.length">
      <div class="toolbar">
        <label class="flex flex-col gap-1">
          <span class="dp-hint">{{ t('dashboard.device.logs.day') }}</span>
          <select v-model="selectedFile" class="dp-field">
            <option v-for="f in files" :key="f.file" :value="f.file">{{ dayLabel(f) }} · {{ formatBytes(f.size) }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="dp-hint">{{ t('dashboard.device.logs.level') }}</span>
          <select v-model="level" class="dp-field">
            <option value="ALL">{{ t('dashboard.device.logs.all') }}</option>
            <option v-for="l in LEVELS" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="dp-hint">{{ t('dashboard.device.logs.module') }}</span>
          <select v-model="moduleFilter" class="dp-field">
            <option value="ALL">{{ t('dashboard.device.logs.all') }}</option>
            <option v-for="m in modules" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
        <label class="flex min-w-[180px] flex-1 flex-col gap-1">
          <span class="dp-hint">{{ t('dashboard.device.logs.search') }}</span>
          <input v-model="search" type="search" class="dp-field" :placeholder="t('dashboard.device.logs.search_placeholder')">
        </label>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="dp-hint tabular-nums">
          <template v-if="wholeDay">{{ t('dashboard.device.logs.whole_day', { n: lines.length }) }}</template>
          <template v-else>{{ t('dashboard.device.logs.latest', { n: lines.length }) }}</template>
          · {{ t('dashboard.device.logs.matching', { n: matching.length }) }}
          <template v-if="selected"> · {{ t('dashboard.device.logs.synced', { when: syncedLabel(selected.syncedAt) }) }}</template>
        </span>
        <span class="flex flex-wrap gap-2">
          <button type="button" class="dp-btn" :disabled="loading" :aria-pressed="wholeDay" @click="wholeDay = !wholeDay">
            {{ wholeDay ? t('dashboard.device.logs.show_latest', { n: TAIL_LINES }) : t('dashboard.device.logs.load_all') }}
          </button>
          <button type="button" class="dp-btn" :disabled="downloading || !selectedFile" @click="download('day')">
            <DashboardIcon name="download" :size="14" />
            {{ t('dashboard.device.logs.download_day') }}
          </button>
        </span>
      </div>

      <div class="log-view" :aria-busy="loading" tabindex="0">
        <p v-if="!rendered.length && !loading" class="dp-hint p-3">{{ t('dashboard.device.logs.empty_filter') }}</p>
        <p v-if="matching.length > MAX_RENDERED" class="dp-hint px-3 pt-2">{{ t('dashboard.device.logs.truncated', { shown: MAX_RENDERED, total: matching.length }) }}</p>
        <div v-for="line in rendered" :key="line.key" class="log-line" :class="`lvl-${line.level.toLowerCase()}`">
          <span class="log-time">{{ line.time }}</span>
          <span class="log-level">{{ line.time ? line.level : '' }}</span>
          <span class="log-module">{{ line.time ? line.module : '' }}</span>
          <span class="log-message">{{ line.message }}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-2 border-t border-line pt-3">
        <label class="flex flex-col gap-1">
          <span class="dp-hint">{{ t('dashboard.device.logs.from') }}</span>
          <input v-model="periodFrom" type="date" class="dp-field">
        </label>
        <label class="flex flex-col gap-1">
          <span class="dp-hint">{{ t('dashboard.device.logs.to') }}</span>
          <input v-model="periodTo" type="date" class="dp-field">
        </label>
        <button type="button" class="dp-btn" :disabled="downloading || !periodFrom || !periodTo" @click="download('period')">
          <DashboardIcon name="download" :size="14" />
          {{ t('dashboard.device.logs.download_period') }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; }
.dp-empty-line { font-size: 13.5px; color: var(--c-ink-soft); padding: 16px 0; }
.log-view {
  height: min(70vh, 640px);
  overflow: auto;
  border-radius: 6px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-soft);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 18px;
}
.log-view:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--c-bg-card), 0 0 0 4px var(--c-accent); }
.log-line {
  display: grid;
  grid-template-columns: 64px 64px minmax(80px, 140px) minmax(0, 1fr);
  gap: 8px;
  padding: 0 10px;
  color: var(--c-ink-soft);
}
.log-line:hover { background: color-mix(in oklab, var(--c-ink) 4%, transparent); }
.log-time { color: var(--c-ink-muted); font-variant-numeric: tabular-nums; }
.log-module { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--c-ink-muted); }
.log-message { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--c-ink); }
.lvl-warning .log-level, .lvl-warning .log-message { color: var(--c-warn-ink); }
.lvl-error .log-level, .lvl-error .log-message, .lvl-critical .log-level, .lvl-critical .log-message { color: var(--c-danger); }
.lvl-debug .log-message { color: var(--c-ink-muted); }
@media (max-width: 640px) {
  .log-line { grid-template-columns: 56px minmax(0, 1fr); }
  .log-level, .log-module { display: none; }
}
</style>
