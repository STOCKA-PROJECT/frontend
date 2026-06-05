<script setup lang="ts">
import { FetchError } from 'ofetch'
import type { OrganizationRole, TimelineResponseDto } from '~/types/api'

const props = defineProps<{
  orgSlug: string
  role: OrganizationRole | null
}>()

const { t, locale } = useI18n()
const timelines = useTimelinesStore()

const canWrite = computed(() =>
  props.role === 'OWNER' || props.role === 'MANAGER' || props.role === 'USER')

// ---- error toast ----
const errorMsg = ref<string | null>(null)
let errorTimer: ReturnType<typeof setTimeout> | null = null

function showError(msg: string) {
  errorMsg.value = msg
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => { errorMsg.value = null }, 6000)
}

onBeforeUnmount(() => {
  if (errorTimer) clearTimeout(errorTimer)
})

function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof FetchError) {
    const data = e.response?._data as { message?: string; detail?: string } | undefined
    return data?.message ?? data?.detail ?? fallback
  }
  return fallback
}

// ---- date formatting ----
const dateLocale = computed(() => {
  const l = locale.value as string
  return l === 'ca' ? 'ca-ES' : l === 'en' ? 'en-US' : 'es-ES'
})
const dateFormatter = computed(() => new Intl.DateTimeFormat(dateLocale.value, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
}))
function fmtDate(iso: string): string {
  if (!iso) return '—'
  return dateFormatter.value.format(new Date(iso))
}

// ---- load ----
async function loadAll() {
  try {
    await timelines.fetchList(props.orgSlug)
  } catch {
    showError(t('dashboard.timelines.errors.load_list'))
  }
}

watch(() => props.orgSlug, async (next, prev) => {
  if (prev !== undefined && next !== prev) timelines.reset()
  await loadAll()
}, { immediate: true })

// ---- create / rename dialog ----
const formDialog = ref<{
  open: boolean
  mode: 'create' | 'rename'
  targetId: number | null
  name: string
  loading: boolean
  error: string | null
}>({
  open: false,
  mode: 'create',
  targetId: null,
  name: '',
  loading: false,
  error: null
})

const formDialogTitle = computed(() => formDialog.value.mode === 'rename'
  ? t('dashboard.timelines.dialog.edit_title')
  : t('dashboard.timelines.dialog.title'))

const formDialogSubmit = computed(() => formDialog.value.mode === 'rename'
  ? t('dashboard.timelines.dialog.save')
  : t('dashboard.timelines.dialog.submit'))

function openCreate() {
  formDialog.value = { open: true, mode: 'create', targetId: null, name: '', loading: false, error: null }
}

// "Modificar": placeholder, does nothing for now (will eventually open a detail view).
function onModify(_timeline: TimelineResponseDto) {
  // Intentionally empty.
}

function onRename(timeline: TimelineResponseDto) {
  formDialog.value = {
    open: true,
    mode: 'rename',
    targetId: timeline.id,
    name: timeline.name,
    loading: false,
    error: null
  }
}

function closeFormDialog() {
  formDialog.value = { ...formDialog.value, open: false, error: null, loading: false }
}

async function submitFormDialog() {
  const name = formDialog.value.name.trim()
  if (!name) {
    formDialog.value.error = t('dashboard.timelines.dialog.name_required')
    return
  }
  formDialog.value.loading = true
  formDialog.value.error = null
  try {
    if (formDialog.value.mode === 'rename' && formDialog.value.targetId != null) {
      await timelines.update(props.orgSlug, formDialog.value.targetId, { name })
    } else {
      await timelines.create(props.orgSlug, { name })
    }
    closeFormDialog()
  } catch (e) {
    formDialog.value.error = extractErrorMessage(e, t('dashboard.timelines.errors.save'))
  } finally {
    formDialog.value.loading = false
  }
}

// ---- delete confirm ----
const confirmDialog = ref<{ open: boolean; id: number | null; name: string; loading: boolean }>({
  open: false,
  id: null,
  name: '',
  loading: false
})

function openDelete(timeline: TimelineResponseDto) {
  confirmDialog.value = { open: true, id: timeline.id, name: timeline.name, loading: false }
}

function closeConfirm() {
  confirmDialog.value = { ...confirmDialog.value, open: false }
}

async function confirmDelete() {
  const id = confirmDialog.value.id
  if (id == null) return
  confirmDialog.value.loading = true
  try {
    await timelines.softDelete(props.orgSlug, id)
    closeConfirm()
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.timelines.errors.delete')))
    closeConfirm()
  } finally {
    confirmDialog.value.loading = false
  }
}
</script>

<template>
  <div class="board flex h-full flex-col gap-3">
    <div v-if="errorMsg" role="alert"
      class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <div class="flex items-center justify-between gap-3">
      <span class="text-[13px] text-ink-muted">
        {{ t('dashboard.timelines.count', timelines.list.length, { n: timelines.list.length }) }}
      </span>
      <button v-if="canWrite" type="button" class="primary-btn" @click="openCreate">
        <DashboardIcon name="plus" :size="15" />
        {{ t('dashboard.timelines.actions.new') }}
      </button>
    </div>

    <div class="flex-1 overflow-auto rounded-[14px] border border-line bg-bg-card">
      <div v-if="timelines.loading" class="px-4 py-8 text-center text-[13px] text-ink-muted">
        {{ t('common.loading') }}
      </div>
      <div v-else-if="timelines.list.length === 0" class="px-4 py-12 text-center text-[13px] text-ink-muted">
        {{ t('dashboard.timelines.empty') }}
      </div>
      <table v-else class="w-full border-collapse text-[13.5px]">
        <thead>
          <tr class="border-b border-line text-left text-[12px] uppercase tracking-[.04em] text-ink-muted">
            <th class="px-4 py-3 font-medium">{{ t('dashboard.timelines.columns.name') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('dashboard.timelines.columns.created') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('dashboard.timelines.columns.updated') }}</th>
            <th v-if="canWrite" class="px-4 py-3 text-right font-medium">{{ t('dashboard.timelines.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tl in timelines.list" :key="tl.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3 font-medium text-ink">{{ tl.name }}</td>
            <td class="px-4 py-3 text-ink-soft">{{ fmtDate(tl.createdAt) }}</td>
            <td class="px-4 py-3 text-ink-soft">{{ fmtDate(tl.updatedAt) }}</td>
            <td v-if="canWrite" class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <button type="button" class="row-btn" @click="onModify(tl)">
                  <DashboardIcon name="external" :size="14" />
                  {{ t('dashboard.timelines.actions.modify') }}
                </button>
                <button type="button" class="row-btn" @click="onRename(tl)">
                  <DashboardIcon name="edit" :size="14" />
                  {{ t('dashboard.timelines.actions.rename') }}
                </button>
                <button type="button" class="row-btn row-btn-danger" @click="openDelete(tl)">
                  <DashboardIcon name="trash" :size="14" />
                  {{ t('dashboard.timelines.actions.delete') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / rename dialog -->
    <Teleport to="body">
      <div v-if="formDialog.open" class="dialog-backdrop" role="presentation"
        @click="(e) => { if (e.target === e.currentTarget) closeFormDialog() }"
        @keydown="(e) => { if (e.key === 'Escape') closeFormDialog() }">
        <div role="dialog" aria-modal="true" :aria-label="formDialogTitle"
          class="flex w-full max-w-[420px] flex-col rounded-[14px] border border-line bg-bg-card shadow-card">
          <form @submit.prevent="submitFormDialog">
            <div class="px-5 py-5 sm:px-6">
              <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">
                {{ formDialogTitle }}
              </h2>
              <label class="mt-4 block text-[13px] font-medium text-ink-soft" for="timeline-name">
                {{ t('dashboard.timelines.dialog.name_label') }}
              </label>
              <input id="timeline-name" v-model="formDialog.name" type="text" class="dialog-input mt-1.5"
                :placeholder="t('dashboard.timelines.dialog.name_placeholder')" :disabled="formDialog.loading"
                autofocus maxlength="120">
              <p v-if="formDialog.error" class="mt-2 text-[12.5px] text-danger">{{ formDialog.error }}</p>
            </div>
            <footer class="border-t border-line px-5 py-4 sm:px-6">
              <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" class="dialog-btn" :disabled="formDialog.loading" @click="closeFormDialog">
                  {{ t('common.close') }}
                </button>
                <button type="submit" class="dialog-btn dialog-btn-primary"
                  :disabled="formDialog.loading" :aria-busy="formDialog.loading">
                  {{ formDialogSubmit }}
                </button>
              </div>
            </footer>
          </form>
        </div>
      </div>
    </Teleport>

    <DashboardConfirmDialog
      :open="confirmDialog.open"
      :title="t('dashboard.timelines.confirm.delete_title')"
      :message="t('dashboard.timelines.confirm.delete_body', { name: confirmDialog.name })"
      :confirm-label="t('dashboard.timelines.actions.delete')"
      :loading="confirmDialog.loading"
      tone="danger"
      @close="closeConfirm"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.board { min-height: 0; }
.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 500;
  background: var(--c-ink);
  color: var(--c-bg-card);
  border: 1px solid var(--c-ink);
  transition: background .15s;
}
.primary-btn:hover { background: color-mix(in oklab, var(--c-ink) 90%, transparent); }
.row-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .15s, border-color .15s, color .15s;
}
.row-btn:hover { background: var(--c-bg-soft); }
.row-btn-danger { color: var(--c-danger); border-color: color-mix(in oklab, var(--c-danger) 30%, var(--c-line)); }
.row-btn-danger:hover { background: var(--c-danger-soft); }

.dialog-backdrop {
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
.dialog-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border-radius: 9px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  font-size: 13.5px;
}
.dialog-input:focus { outline: none; border-color: var(--c-ink); }
.dialog-input:disabled { opacity: .5; cursor: not-allowed; }
.dialog-btn {
  height: 40px;
  padding: 0 16px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .15s, border-color .15s;
}
.dialog-btn:hover:not(:disabled) { background: var(--c-bg-soft); }
.dialog-btn:disabled { opacity: .5; cursor: not-allowed; }
.dialog-btn-primary {
  background: var(--c-ink);
  color: var(--c-bg-card);
  border-color: var(--c-ink);
}
.dialog-btn-primary:hover:not(:disabled) { background: color-mix(in oklab, var(--c-ink) 90%, transparent); }
</style>
