<script setup lang="ts">
import { FetchError } from 'ofetch'
import type { ImportMode, PieceImportReportDto, PieceListFilters, SpreadsheetFormat } from '~/types/api'

const props = defineProps<{
  open: boolean
  orgSlug: string
  canWrite: boolean
  filters: PieceListFilters
}>()

const emit = defineEmits<{
  close: []
  imported: []
}>()

const { t } = useI18n()
const pieces = usePiecesStore()
const toast = useToastStore()

const mode = ref<ImportMode>('create')
const file = ref<File | null>(null)
const report = ref<PieceImportReportDto | null>(null)
/** Name of the action currently running, so only its button shows a busy state. */
const busy = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const fileFormat = computed<SpreadsheetFormat>(() =>
  file.value && /\.xlsx$/i.test(file.value.name) ? 'xlsx' : 'csv')

const canCommit = computed(() =>
  props.canWrite
  && file.value !== null
  && report.value !== null
  && report.value.failed === 0
  && busy.value === null)

function resetImport() {
  file.value = null
  report.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function close() {
  if (busy.value) return
  resetImport()
  mode.value = 'create'
  emit('close')
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) close()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function onExport(format: SpreadsheetFormat) {
  busy.value = `export-${format}`
  try {
    const blob = await pieces.exportPieces(props.orgSlug, format, props.filters)
    triggerDownload(blob, `articulos-${props.orgSlug}.${format}`)
  } catch {
    toast.push({ type: 'error', description: t('dashboard.pieces.import_export.toast.export_error') })
  } finally {
    busy.value = null
  }
}

async function onTemplate(format: SpreadsheetFormat) {
  busy.value = `template-${format}`
  try {
    const blob = await pieces.downloadImportTemplate(props.orgSlug, format)
    triggerDownload(blob, `plantilla-articulos.${format}`)
  } catch {
    toast.push({ type: 'error', description: t('dashboard.pieces.import_export.toast.export_error') })
  } finally {
    busy.value = null
  }
}

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  report.value = null
}

/** Extracts the import report carried by a 422 rejection, if present. */
function reportFromError(e: unknown): PieceImportReportDto | null {
  if (e instanceof FetchError) {
    const data = e.response?._data as PieceImportReportDto | undefined
    if (data && typeof data === 'object' && Array.isArray(data.rows)) return data
  }
  return null
}

async function onValidate() {
  if (!file.value) return
  busy.value = 'validate'
  try {
    report.value = await pieces.importPieces(props.orgSlug, file.value, fileFormat.value, mode.value, true)
  } catch (e) {
    const r = reportFromError(e)
    if (r) report.value = r
    else toast.push({ type: 'error', description: t('dashboard.pieces.import_export.toast.import_error') })
  } finally {
    busy.value = null
  }
}

async function onCommit() {
  if (!file.value) return
  busy.value = 'commit'
  try {
    const r = await pieces.importPieces(props.orgSlug, file.value, fileFormat.value, mode.value, false)
    if (r.applied) {
      toast.push({
        type: 'success',
        description: t('dashboard.pieces.import_export.toast.import_success', { created: r.created, updated: r.updated })
      })
      busy.value = null
      emit('imported')
      close()
      return
    }
    report.value = r
  } catch (e) {
    const r = reportFromError(e)
    if (r) {
      report.value = r
      toast.push({ type: 'error', description: t('dashboard.pieces.import_export.toast.rejected') })
    } else {
      toast.push({ type: 'error', description: t('dashboard.pieces.import_export.toast.import_error') })
    }
  } finally {
    busy.value = null
  }
}

// Start from a clean slate each time the dialog opens.
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetImport()
    mode.value = 'create'
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="ie-backdrop" role="presentation" @click="onBackdrop" @keydown="onKey">
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="t('dashboard.pieces.import_export.title')"
        class="ie-modal"
      >
        <header class="ie-header">
          <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">
            {{ t('dashboard.pieces.import_export.title') }}
          </h2>
          <button type="button" class="ie-icon-btn" :aria-label="t('common.close')" @click="close">
            <DashboardIcon name="x" :size="16" />
          </button>
        </header>

        <div class="ie-body">
          <!-- Export -->
          <section class="ie-section">
            <h3 class="ie-h3">{{ t('dashboard.pieces.import_export.export.heading') }}</h3>
            <p class="ie-muted">{{ t('dashboard.pieces.import_export.export.description') }}</p>
            <div class="ie-btn-row">
              <button type="button" class="ie-ghost-btn" :disabled="busy !== null"
                :aria-busy="busy === 'export-csv'" @click="onExport('csv')">
                <DashboardIcon name="external" :size="14" />
                {{ t('dashboard.pieces.import_export.export.csv') }}
              </button>
              <button type="button" class="ie-ghost-btn" :disabled="busy !== null"
                :aria-busy="busy === 'export-xlsx'" @click="onExport('xlsx')">
                <DashboardIcon name="external" :size="14" />
                {{ t('dashboard.pieces.import_export.export.xlsx') }}
              </button>
            </div>
          </section>

          <!-- Import (write access only) -->
          <template v-if="canWrite">
            <hr class="ie-sep">

            <section class="ie-section">
              <h3 class="ie-h3">{{ t('dashboard.pieces.import_export.import.heading') }}</h3>
              <p class="ie-muted">{{ t('dashboard.pieces.import_export.import.description') }}</p>

              <div class="ie-btn-row">
                <span class="ie-muted">{{ t('dashboard.pieces.import_export.template.heading') }}:</span>
                <button type="button" class="ie-link-btn" :disabled="busy !== null" @click="onTemplate('csv')">
                  {{ t('dashboard.pieces.import_export.export.csv') }}
                </button>
                <button type="button" class="ie-link-btn" :disabled="busy !== null" @click="onTemplate('xlsx')">
                  {{ t('dashboard.pieces.import_export.export.xlsx') }}
                </button>
              </div>

              <div class="ie-field">
                <span class="ie-label">{{ t('dashboard.pieces.import_export.import.mode_label') }}</span>
                <div class="ie-mode-row">
                  <label class="ie-radio">
                    <input v-model="mode" type="radio" value="create" :disabled="busy !== null">
                    {{ t('dashboard.pieces.import_export.import.mode_create') }}
                  </label>
                  <label class="ie-radio">
                    <input v-model="mode" type="radio" value="upsert" :disabled="busy !== null">
                    {{ t('dashboard.pieces.import_export.import.mode_upsert') }}
                  </label>
                </div>
              </div>

              <input ref="fileInput" type="file" accept=".csv,.xlsx" class="sr-only" @change="onFileChange">
              <div class="ie-file-row">
                <button type="button" class="ie-ghost-btn" :disabled="busy !== null" @click="pickFile">
                  <DashboardIcon name="upload" :size="14" />
                  {{ t('dashboard.pieces.import_export.import.choose_file') }}
                </button>
                <span class="ie-muted ie-truncate">
                  {{ file?.name ?? t('dashboard.pieces.import_export.import.no_file') }}
                </span>
              </div>

              <p class="ie-hint">{{ t('dashboard.pieces.import_export.import.hint_columns') }}</p>

              <div class="ie-btn-row">
                <button type="button" class="ie-primary-btn" :disabled="!file || busy !== null"
                  :aria-busy="busy === 'validate'" @click="onValidate">
                  {{ busy === 'validate'
                    ? t('dashboard.pieces.import_export.import.validating')
                    : t('dashboard.pieces.import_export.import.validate') }}
                </button>
                <button v-if="report" type="button" class="ie-ghost-btn" :disabled="busy !== null"
                  @click="resetImport">
                  {{ t('dashboard.pieces.import_export.import.reset') }}
                </button>
              </div>

              <DashboardPieceImportReport v-if="report" :report="report" />

              <div v-if="report" class="ie-btn-row">
                <button type="button" class="ie-primary-btn" :disabled="!canCommit"
                  :aria-busy="busy === 'commit'" @click="onCommit">
                  {{ busy === 'commit'
                    ? t('dashboard.pieces.import_export.import.committing')
                    : t('dashboard.pieces.import_export.import.commit') }}
                </button>
              </div>
            </section>
          </template>
        </div>

        <footer class="ie-footer">
          <button type="button" class="ie-ghost-btn" :disabled="busy !== null" @click="close">
            {{ t('common.close') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ie-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--c-ink) 30%, transparent);
  backdrop-filter: blur(2px);
  padding: 12px;
}
.ie-modal {
  display: flex;
  width: 100%;
  max-width: 560px;
  max-height: calc(100vh - 24px);
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  box-shadow: var(--shadow-card, 0 12px 40px rgba(0, 0, 0, .14));
}
.ie-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--c-line);
  padding: 16px 20px;
}
.ie-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding: 18px 20px;
}
.ie-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--c-line);
  padding: 14px 20px;
}
.ie-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ie-h3 {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--c-ink);
}
.ie-muted {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--c-ink-soft);
}
.ie-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--c-ink-muted);
}
.ie-sep {
  border: 0;
  border-top: 1px solid var(--c-line);
}
.ie-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ie-label {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--c-ink);
}
.ie-mode-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.ie-radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--c-ink-soft);
  cursor: pointer;
}
.ie-file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.ie-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ie-btn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ie-primary-btn,
.ie-ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  transition: background .15s, border-color .15s;
}
.ie-primary-btn {
  background: var(--c-ink);
  color: var(--c-bg-card);
  border-color: var(--c-ink);
}
.ie-primary-btn:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-ink) 88%, transparent);
}
.ie-ghost-btn {
  background: var(--c-bg-card);
  color: var(--c-ink);
}
.ie-ghost-btn:hover:not(:disabled) {
  background: var(--c-bg-soft);
}
.ie-primary-btn:disabled,
.ie-ghost-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}
.ie-link-btn {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--c-accent-ink, var(--c-ink));
  text-decoration: underline;
  text-underline-offset: 2px;
}
.ie-link-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
