<script setup lang="ts">
import type { CreatePortDto, OrganizationRole, PortResponseDto, UpdatePortDto } from '~/types/api'

const props = defineProps<{
  orgSlug: string
  role: OrganizationRole | null
}>()

const { t } = useI18n()
const ports = usePortsStore()
const pieceTypes = usePieceTypesStore()
const toast = useToastStore()
const apiError = useApiError()

const canWrite = computed(() => props.role === 'OWNER' || props.role === 'MANAGER')

// Ports are related to an existing piece type; the form needs the org's piece types to choose from.
const pieceTypeOptions = computed(() => pieceTypes.list.map(t => ({ id: t.id, name: t.name })))

function notifyError(e: unknown) {
  const view = apiError(e)
  toast.push({ type: 'error', title: view.title, description: view.description })
}

async function loadAll() {
  try {
    await Promise.all([
      ports.fetchAll(props.orgSlug),
      pieceTypes.fetchAll(props.orgSlug)
    ])
  } catch (e) {
    notifyError(e)
  }
}

watch(() => props.orgSlug, (next, prev) => {
  if (prev !== undefined && next !== prev) ports.reset()
  loadAll()
}, { immediate: true })

// ---- create / edit dialog ----
const formDialog = ref<{
  open: boolean
  mode: 'create' | 'edit'
  target: PortResponseDto | null
  loading: boolean
  error: string | null
}>({ open: false, mode: 'create', target: null, loading: false, error: null })

function openCreate() {
  formDialog.value = { open: true, mode: 'create', target: null, loading: false, error: null }
}

function openEdit(port: PortResponseDto) {
  formDialog.value = { open: true, mode: 'edit', target: port, loading: false, error: null }
}

function closeForm() {
  formDialog.value = { ...formDialog.value, open: false, error: null, loading: false }
}

async function submitForm(payload: CreatePortDto | UpdatePortDto) {
  formDialog.value.loading = true
  formDialog.value.error = null
  try {
    if (formDialog.value.mode === 'create') {
      await ports.create(props.orgSlug, payload as CreatePortDto)
    } else if (formDialog.value.target) {
      await ports.update(props.orgSlug, formDialog.value.target.id, payload as UpdatePortDto)
    }
    closeForm()
  } catch (e) {
    formDialog.value.error = apiError(e).description
  } finally {
    formDialog.value.loading = false
  }
}

// ---- delete confirm ----
const confirmDialog = ref<{ open: boolean, target: PortResponseDto | null, loading: boolean }>({
  open: false,
  target: null,
  loading: false
})

function openDelete(port: PortResponseDto) {
  confirmDialog.value = { open: true, target: port, loading: false }
}

function closeConfirm() {
  confirmDialog.value = { ...confirmDialog.value, open: false }
}

async function confirmDelete() {
  if (!confirmDialog.value.target) return
  confirmDialog.value.loading = true
  try {
    await ports.softDelete(props.orgSlug, confirmDialog.value.target.id)
    closeConfirm()
  } catch (e) {
    notifyError(e)
    confirmDialog.value.loading = false
  }
}

const showInitialLoading = computed(() => ports.loading && !ports.loaded)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <span class="text-[13px] text-ink-muted">
        {{ t('dashboard.ports.list.count', { n: ports.list.length }) }}
      </span>
      <button v-if="canWrite" type="button" class="new-btn" @click="openCreate">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>{{ t('dashboard.ports.list.new') }}</span>
      </button>
    </div>

    <p v-if="showInitialLoading" class="rounded-[12px] border border-line bg-bg-card px-4 py-10 text-center text-[13.5px] text-ink-muted">
      {{ t('dashboard.ports.list.loading') }}
    </p>

    <p v-else-if="!ports.list.length" class="rounded-[12px] border border-dashed border-line bg-bg-soft px-4 py-12 text-center text-[13.5px] text-ink-muted">
      {{ t('dashboard.ports.list.empty') }}
    </p>

    <ul v-else class="flex flex-col gap-2">
      <DashboardPortRow
        v-for="port in ports.list"
        :key="port.id"
        :port="port"
        :can-write="canWrite"
        @edit="openEdit(port)"
        @delete="openDelete(port)"
      />
    </ul>

    <DashboardPortFormDialog
      :open="formDialog.open"
      :mode="formDialog.mode"
      :piece-types="pieceTypeOptions"
      :initial="formDialog.target"
      :loading="formDialog.loading"
      :error-msg="formDialog.error"
      @close="closeForm"
      @submit="submitForm"
    />

    <DashboardConfirmDialog
      :open="confirmDialog.open"
      :title="t('dashboard.ports.delete.confirm_title')"
      :message="t('dashboard.ports.delete.confirm_message', { name: confirmDialog.target?.name ?? '' })"
      :confirm-label="t('dashboard.ports.delete.confirm_label')"
      :loading="confirmDialog.loading"
      tone="danger"
      @close="closeConfirm"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.new-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 500;
  border: 1px solid var(--c-ink);
  background: var(--c-ink);
  color: var(--c-bg-card);
  transition: background .15s;
}
.new-btn:hover { background: color-mix(in oklab, var(--c-ink) 90%, transparent); }
</style>
