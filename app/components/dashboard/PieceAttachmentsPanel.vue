<script setup lang="ts">
import type { PieceAttachmentKind, PieceAttachmentResponseDto } from '~/types/api'

const props = defineProps<{
  orgId: number
  pieceId: number
  attachments: PieceAttachmentResponseDto[]
  coverAttachmentId?: number | null
  canWrite: boolean
}>()

const emit = defineEmits<{
  'set-cover': [attachmentId: number]
}>()

const { t, locale } = useI18n()
const pieces = usePiecesStore()
const apiError = useApiError()

const IMAGE_MAX_BYTES = 25 * 1024 * 1024
const DOCUMENT_MAX_BYTES = 100 * 1024 * 1024
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

const imageInput = ref<HTMLInputElement | null>(null)
const documentInput = ref<HTMLInputElement | null>(null)

const uploading = ref<PieceAttachmentKind | null>(null)
const errorMsg = ref<string | null>(null)
let errorTimer: ReturnType<typeof setTimeout> | null = null

function showError(msg: string) {
  errorMsg.value = msg
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => { errorMsg.value = null }, 6000)
}

function extractErrorMessage(e: unknown, fallback: string): string {
  const view = apiError(e)
  return view.description || fallback
}

const images = computed(() => props.attachments.filter(a => a.kind === 'IMAGE'))
const documents = computed(() => props.attachments.filter(a => a.kind === 'DOCUMENT'))

const blobUrlByAttachmentId = ref<Record<number, string>>({})
const loadingImageIds = ref<Set<number>>(new Set())

const dateLocale = computed(() => {
  const l = locale.value as string
  return l === 'ca' ? 'ca-ES' : l === 'en' ? 'en-US' : 'es-ES'
})

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(dateLocale.value, { day: '2-digit', month: 'short', year: 'numeric' })
}

async function loadImageUrl(attachmentId: number) {
  if (blobUrlByAttachmentId.value[attachmentId]) return
  if (loadingImageIds.value.has(attachmentId)) return
  loadingImageIds.value.add(attachmentId)
  try {
    const url = await pieces.fetchAttachmentBlobUrl(props.orgId, props.pieceId, attachmentId)
    blobUrlByAttachmentId.value = { ...blobUrlByAttachmentId.value, [attachmentId]: url }
  } catch {
    /* silenciamos: la galería muestra placeholder */
  } finally {
    loadingImageIds.value.delete(attachmentId)
  }
}

watch(images, (next, prev) => {
  // Cargar nuevas
  for (const att of next) {
    if (!blobUrlByAttachmentId.value[att.id]) void loadImageUrl(att.id)
  }
  // Revocar las que ya no existen
  if (prev) {
    const stillExists = new Set(next.map(a => a.id))
    const map = blobUrlByAttachmentId.value
    const updated: Record<number, string> = {}
    for (const [idStr, url] of Object.entries(map)) {
      const id = Number(idStr)
      if (stillExists.has(id)) {
        updated[id] = url
      } else {
        URL.revokeObjectURL(url)
      }
    }
    blobUrlByAttachmentId.value = updated
  }
}, { immediate: true })

onBeforeUnmount(() => {
  for (const url of Object.values(blobUrlByAttachmentId.value)) {
    URL.revokeObjectURL(url)
  }
  if (errorTimer) clearTimeout(errorTimer)
})

async function uploadFiles(files: FileList | File[], kind: PieceAttachmentKind) {
  const fileArr = Array.from(files)
  if (fileArr.length === 0) return
  const limit = kind === 'IMAGE' ? IMAGE_MAX_BYTES : DOCUMENT_MAX_BYTES
  uploading.value = kind
  try {
    for (const file of fileArr) {
      if (file.size > limit) {
        showError(t('dashboard.pieces.attachments.errors.too_large_local', {
          file: file.name,
          max: humanSize(limit)
        }))
        continue
      }
      try {
        await pieces.uploadAttachment(props.orgId, props.pieceId, file, kind)
      } catch (e) {
        showError(extractErrorMessage(e, t('dashboard.pieces.attachments.errors.upload')))
      }
    }
  } finally {
    uploading.value = null
  }
}

function onImageSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    void uploadFiles(input.files, 'IMAGE')
  }
  input.value = ''
}

function onDocumentSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    void uploadFiles(input.files, 'DOCUMENT')
  }
  input.value = ''
}

const lightbox = ref<{ open: boolean; url: string | null; name: string }>({
  open: false,
  url: null,
  name: ''
})

function openLightbox(att: PieceAttachmentResponseDto) {
  const url = blobUrlByAttachmentId.value[att.id]
  if (!url) return
  lightbox.value = { open: true, url, name: att.originalFilename }
}
function closeLightbox() {
  lightbox.value = { open: false, url: null, name: '' }
}
function onLightboxKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeLightbox()
}

async function downloadDocument(att: PieceAttachmentResponseDto) {
  try {
    const url = await pieces.fetchAttachmentBlobUrl(props.orgId, props.pieceId, att.id)
    const a = document.createElement('a')
    a.href = url
    a.download = att.originalFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.attachments.errors.download')))
  }
}

const deletingId = ref<number | null>(null)
const confirmDeleteId = ref<number | null>(null)
const confirmDeleteName = ref('')

function askDelete(att: PieceAttachmentResponseDto) {
  confirmDeleteId.value = att.id
  confirmDeleteName.value = att.originalFilename
}
function cancelDelete() {
  confirmDeleteId.value = null
  confirmDeleteName.value = ''
}
async function confirmDelete() {
  const id = confirmDeleteId.value
  if (id == null) return
  deletingId.value = id
  try {
    await pieces.deleteAttachment(props.orgId, props.pieceId, id)
    confirmDeleteId.value = null
    confirmDeleteName.value = ''
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.attachments.errors.delete')))
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div v-if="errorMsg" role="alert"
      class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <div v-if="canWrite" class="flex flex-wrap gap-2">
      <button
        type="button"
        class="upload-btn"
        :disabled="uploading !== null"
        @click="imageInput?.click()"
      >
        <DashboardIcon name="upload" :size="14" />
        {{ uploading === 'IMAGE'
          ? t('dashboard.pieces.attachments.uploading')
          : t('dashboard.pieces.attachments.upload_image') }}
      </button>
      <input
        ref="imageInput"
        type="file"
        :accept="IMAGE_ACCEPT"
        multiple
        class="hidden"
        @change="onImageSelect"
      >
      <button
        type="button"
        class="upload-btn"
        :disabled="uploading !== null"
        @click="documentInput?.click()"
      >
        <DashboardIcon name="upload" :size="14" />
        {{ uploading === 'DOCUMENT'
          ? t('dashboard.pieces.attachments.uploading')
          : t('dashboard.pieces.attachments.upload_document') }}
      </button>
      <input
        ref="documentInput"
        type="file"
        multiple
        class="hidden"
        @change="onDocumentSelect"
      >
    </div>

    <section>
      <h3 class="section-title">
        {{ t('dashboard.pieces.attachments.images_title') }}
        <span class="count">{{ images.length }}</span>
      </h3>
      <div v-if="images.length === 0" class="empty-state">
        {{ t('dashboard.pieces.attachments.images_empty') }}
      </div>
      <div v-else class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div v-for="att in images" :key="att.id"
          class="image-card"
          :class="{ 'is-cover': coverAttachmentId === att.id }">
          <button
            type="button"
            class="image-thumb"
            :aria-label="att.originalFilename"
            @click="openLightbox(att)"
          >
            <img
              v-if="blobUrlByAttachmentId[att.id]"
              :src="blobUrlByAttachmentId[att.id]"
              :alt="att.originalFilename"
              loading="lazy"
            >
            <span v-else class="image-placeholder">
              <DashboardIcon name="box" :size="22" />
            </span>
            <span v-if="coverAttachmentId === att.id" class="cover-badge">
              {{ t('dashboard.pieces.attachments.cover_badge') }}
            </span>
          </button>
          <div class="image-meta">
            <div class="truncate text-[12.5px] text-ink" :title="att.originalFilename">
              {{ att.originalFilename }}
            </div>
            <div class="flex items-center justify-between gap-2 text-[11.5px] text-ink-muted">
              <span>{{ humanSize(att.sizeBytes) }}</span>
              <div class="flex items-center gap-1.5">
                <button
                  v-if="canWrite && coverAttachmentId !== att.id"
                  type="button"
                  class="cover-btn"
                  :title="t('dashboard.pieces.attachments.set_cover')"
                  @click="emit('set-cover', att.id)"
                >
                  {{ t('dashboard.pieces.attachments.set_cover') }}
                </button>
                <button
                  v-if="canWrite"
                  type="button"
                  class="image-delete"
                  :disabled="deletingId === att.id"
                  :aria-label="t('dashboard.pieces.actions.delete')"
                  @click="askDelete(att)"
                >
                  <DashboardIcon name="trash" :size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <h3 class="section-title">
        {{ t('dashboard.pieces.attachments.documents_title') }}
        <span class="count">{{ documents.length }}</span>
      </h3>
      <div v-if="documents.length === 0" class="empty-state">
        {{ t('dashboard.pieces.attachments.documents_empty') }}
      </div>
      <ul v-else class="flex flex-col divide-y divide-line rounded-lg border border-line bg-bg-card">
        <li v-for="att in documents" :key="att.id" class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-bg-soft text-ink-soft">
              <DashboardIcon name="folder" :size="16" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[13.5px] font-medium text-ink" :title="att.originalFilename">
                {{ att.originalFilename }}
              </div>
              <div class="flex items-center gap-2 text-[11.5px] text-ink-muted">
                <span>{{ humanSize(att.sizeBytes) }}</span>
                <span>·</span>
                <span class="truncate">{{ formatDate(att.createdAt) }}</span>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="ghost-btn" @click="downloadDocument(att)">
              {{ t('dashboard.pieces.actions.download') }}
            </button>
            <button
              v-if="canWrite"
              type="button"
              class="ghost-btn ghost-btn-danger"
              :disabled="deletingId === att.id"
              @click="askDelete(att)"
            >
              {{ t('dashboard.pieces.actions.delete') }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <DashboardConfirmDialog
      :open="confirmDeleteId !== null"
      :title="t('dashboard.pieces.attachments.confirm_delete_title')"
      :message="t('dashboard.pieces.attachments.confirm_delete_body', { name: confirmDeleteName })"
      :confirm-label="t('dashboard.pieces.actions.delete')"
      :loading="deletingId !== null"
      tone="danger"
      @close="cancelDelete"
      @confirm="confirmDelete"
    />

    <Teleport to="body">
      <div
        v-if="lightbox.open"
        class="lightbox"
        role="dialog"
        aria-modal="true"
        :aria-label="lightbox.name"
        @click="closeLightbox"
        @keydown="onLightboxKey"
      >
        <img v-if="lightbox.url" :src="lightbox.url" :alt="lightbox.name" class="lightbox-image">
        <button type="button" class="lightbox-close" :aria-label="t('common.close')" @click.stop="closeLightbox">
          <DashboardIcon name="x" :size="18" />
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  font-size: 13px;
  transition: background .15s, border-color .15s;
}
.upload-btn:hover:not(:disabled) { background: var(--c-bg-soft); border-color: var(--c-ink-muted); }
.upload-btn:disabled { opacity: .5; cursor: not-allowed; }

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--c-ink);
  margin-bottom: 12px;
}
.count {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--c-ink-muted);
  background: var(--c-bg-soft);
  padding: 1px 8px;
  border-radius: 999px;
}
.empty-state {
  border: 1px dashed var(--c-line);
  background: var(--c-bg-soft);
  border-radius: 10px;
  padding: 28px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--c-ink-muted);
}

.image-card { display: flex; flex-direction: column; gap: 6px; }
.image-card.is-cover .image-thumb { border-color: var(--c-accent); }
.image-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-soft);
  overflow: hidden;
  padding: 0;
}
.cover-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--c-accent);
  color: var(--c-bg-card);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .03em;
  text-transform: uppercase;
}
.cover-btn {
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  font-size: 11px;
  color: var(--c-ink-soft);
  transition: background .12s, color .12s, border-color .12s;
}
.cover-btn:hover {
  background: var(--c-bg-soft);
  color: var(--c-ink);
  border-color: var(--c-line-strong);
}
.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.image-thumb:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--c-ink-muted);
}
.image-meta { padding: 0 2px; }
.image-delete {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--c-ink-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.image-delete:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-danger) 8%, transparent);
  color: var(--c-danger);
}
.image-delete:disabled { opacity: .4; cursor: not-allowed; }

.ghost-btn {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--c-line);
  border-radius: 8px;
  background: var(--c-bg-card);
  color: var(--c-ink);
  font-size: 13px;
  transition: background .12s;
}
@media (min-width: 640px) {
  .ghost-btn {
    height: 32px;
    padding: 0 10px;
    font-size: 12.5px;
  }
}
.ghost-btn:hover:not(:disabled) { background: var(--c-bg-soft); }
.ghost-btn:disabled { opacity: .5; cursor: not-allowed; }
.ghost-btn-danger { color: var(--c-danger); }
.ghost-btn-danger:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-danger) 8%, transparent);
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--c-ink) 70%, transparent);
  padding: 32px;
}
.lightbox-image {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-shadow: 0 18px 36px -8px rgba(0,0,0,.4);
}
.lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.2);
  background: rgba(0,0,0,.45);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lightbox-close:hover { background: rgba(0,0,0,.7); }
</style>
