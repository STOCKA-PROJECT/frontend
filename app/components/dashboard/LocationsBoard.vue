<script setup lang="ts">
import { FetchError } from 'ofetch'
import type { LocationTreeNodeDto, OrganizationRole } from '~/types/api'

const props = defineProps<{
  orgId: number
  role: OrganizationRole | null
}>()

const { t } = useI18n()
const locations = useLocationsStore()
const pieces = usePiecesStore()

type Focus =
  | { kind: 'location'; id: number }
  | { kind: 'unassigned' }
  | { kind: 'none' }

const focus = ref<Focus>({ kind: 'none' })

const selectedId = computed(() => focus.value.kind === 'location' ? focus.value.id : null)
const isUnassignedFocus = computed(() => focus.value.kind === 'unassigned')

const detail = computed(() => selectedId.value ? locations.detailById[selectedId.value] ?? null : null)

const childrenOfSelected = computed<LocationTreeNodeDto[]>(() => {
  if (!selectedId.value) return []
  const node = findInTree(locations.tree, selectedId.value)
  return node?.children ?? []
})

const focusedPieces = computed(() => {
  if (focus.value.kind === 'location') return pieces.get(focus.value.id) ?? []
  if (focus.value.kind === 'unassigned') return pieces.get(null) ?? []
  return []
})

const piecesLoading = computed(() => {
  if (focus.value.kind === 'location') return pieces.loadingFor === focus.value.id
  if (focus.value.kind === 'unassigned') return pieces.loadingFor === -1
  return false
})

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

function findInTree(nodes: LocationTreeNodeDto[], id: number): LocationTreeNodeDto | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const child = findInTree(n.children ?? [], id)
    if (child) return child
  }
  return null
}

async function loadTree() {
  try {
    await locations.fetchTree(props.orgId)
  } catch {
    showError(t('dashboard.locations.errors.load_tree'))
  }
}

async function loadFocusedPieces() {
  try {
    if (focus.value.kind === 'location') {
      await pieces.fetchByLocation(props.orgId, focus.value.id)
    } else if (focus.value.kind === 'unassigned') {
      await pieces.fetchByLocation(props.orgId, null)
    }
  } catch {
    showError(t('dashboard.locations.errors.load_pieces'))
  }
}

async function loadDetail(id: number) {
  try {
    await locations.fetchOne(props.orgId, id)
  } catch {
    showError(t('dashboard.locations.errors.load_detail'))
  }
}

watch(() => props.orgId, async () => {
  focus.value = { kind: 'none' }
  pieces.invalidateAll()
  await loadTree()
}, { immediate: true })

watch(focus, async (next) => {
  if (next.kind === 'location') {
    if (!locations.detailById[next.id]) await loadDetail(next.id)
    if (!pieces.get(next.id)) await loadFocusedPieces()
  } else if (next.kind === 'unassigned') {
    if (!pieces.get(null)) await loadFocusedPieces()
  }
})

function onSelect(id: number) {
  focus.value = { kind: 'location', id }
}

function onSelectUnassigned() {
  focus.value = { kind: 'unassigned' }
}

function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof FetchError) {
    const data = e.response?._data as { message?: string } | undefined
    return data?.message ?? fallback
  }
  return fallback
}

async function handleDropLocation(payload: { sourceId: number; targetId: number | null }) {
  if (props.role !== 'OWNER' && props.role !== 'MANAGER') return
  if (payload.sourceId === payload.targetId) return
  try {
    if (payload.targetId == null) {
      await locations.update(props.orgId, payload.sourceId, { moveToRoot: true })
    } else {
      await locations.update(props.orgId, payload.sourceId, { parentId: payload.targetId })
    }
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.locations.errors.move_location')))
  }
}

async function handleDropPiece(payload: { pieceId: number; targetLocationId: number | null }) {
  if (!(props.role === 'OWNER' || props.role === 'MANAGER' || props.role === 'USER')) return
  const sourceLocationId = locateBucketForPiece(payload.pieceId)
  try {
    if (payload.targetLocationId == null) {
      await pieces.move(props.orgId, payload.pieceId, { clearLocation: true })
    } else {
      await pieces.move(props.orgId, payload.pieceId, { locationId: payload.targetLocationId })
    }
    pieces.invalidate(sourceLocationId)
    pieces.invalidate(payload.targetLocationId)
    await loadFocusedPieces()
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.locations.errors.move_piece')))
  }
}

function locateBucketForPiece(pieceId: number): number | null {
  for (const [key, list] of Object.entries(pieces.byLocation)) {
    if (!list) continue
    if (list.some(p => p.id === pieceId)) {
      const k = Number(key)
      return k === -1 ? null : k
    }
  }
  return null
}

const formDialog = ref<{
  open: boolean
  mode: 'create-root' | 'create-child' | 'rename'
  parentId?: number
  parentName?: string
  targetId?: number
  initialName?: string
  initialDescription?: string
  loading: boolean
  error: string | null
}>({
  open: false,
  mode: 'create-root',
  loading: false,
  error: null
})

function openCreateRoot() {
  formDialog.value = {
    open: true,
    mode: 'create-root',
    loading: false,
    error: null,
    initialName: '',
    initialDescription: ''
  }
}

function openCreateChild(parentId: number) {
  const parent = findInTree(locations.tree, parentId)
  formDialog.value = {
    open: true,
    mode: 'create-child',
    parentId,
    parentName: parent?.name,
    loading: false,
    error: null,
    initialName: '',
    initialDescription: ''
  }
}

async function openRename(id: number) {
  if (!locations.detailById[id]) await loadDetail(id)
  const d = locations.detailById[id]
  formDialog.value = {
    open: true,
    mode: 'rename',
    targetId: id,
    loading: false,
    error: null,
    initialName: d?.name ?? '',
    initialDescription: d?.description ?? ''
  }
}

function closeFormDialog() {
  formDialog.value = { ...formDialog.value, open: false, error: null, loading: false }
}

async function submitFormDialog(payload: { name: string; description?: string }) {
  formDialog.value.loading = true
  formDialog.value.error = null
  try {
    if (formDialog.value.mode === 'create-root') {
      const created = await locations.create(props.orgId, payload)
      focus.value = { kind: 'location', id: created.id }
    } else if (formDialog.value.mode === 'create-child' && formDialog.value.parentId) {
      const created = await locations.create(props.orgId, { ...payload, parentId: formDialog.value.parentId })
      focus.value = { kind: 'location', id: created.id }
    } else if (formDialog.value.mode === 'rename' && formDialog.value.targetId) {
      await locations.update(props.orgId, formDialog.value.targetId, payload)
    }
    closeFormDialog()
  } catch (e) {
    formDialog.value.error = extractErrorMessage(e, t('dashboard.locations.errors.save'))
  } finally {
    formDialog.value.loading = false
  }
}

const confirmDialog = ref<{
  open: boolean
  targetId: number | null
  targetName: string
  loading: boolean
}>({
  open: false,
  targetId: null,
  targetName: '',
  loading: false
})

function openDelete(id: number) {
  const node = findInTree(locations.tree, id)
  confirmDialog.value = {
    open: true,
    targetId: id,
    targetName: node?.name ?? '',
    loading: false
  }
}

function closeConfirm() {
  confirmDialog.value = { ...confirmDialog.value, open: false }
}

async function confirmDelete() {
  if (!confirmDialog.value.targetId) return
  confirmDialog.value.loading = true
  try {
    await locations.softDelete(props.orgId, confirmDialog.value.targetId)
    if (focus.value.kind === 'location' && focus.value.id === confirmDialog.value.targetId) {
      focus.value = { kind: 'none' }
    }
    closeConfirm()
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.locations.errors.delete')))
    confirmDialog.value.loading = false
  }
}

function onDetailRename() {
  if (selectedId.value) openRename(selectedId.value)
}

function onDetailCreateChild() {
  if (selectedId.value) openCreateChild(selectedId.value)
}

function onDetailDelete() {
  if (selectedId.value) openDelete(selectedId.value)
}
</script>

<template>
  <div class="board flex h-full flex-col gap-3">
    <div v-if="errorMsg" role="alert"
      class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <div class="board-grid flex-1">
      <DashboardLocationsTreeEditable
        :nodes="locations.tree"
        :loading="locations.loadingTree"
        :selected-id="selectedId"
        :is-unassigned-focus="isUnassignedFocus"
        :role="role"
        @select="onSelect"
        @select-unassigned="onSelectUnassigned"
        @drop-location="handleDropLocation"
        @drop-piece="handleDropPiece"
        @create-root="openCreateRoot"
        @create-child="openCreateChild"
        @rename="openRename"
        @delete="openDelete"
      />

      <DashboardLocationDetailPanel
        :selected-id="selectedId"
        :is-unassigned-focus="isUnassignedFocus"
        :detail="detail"
        :child-locations="childrenOfSelected"
        :pieces="focusedPieces"
        :loading="piecesLoading"
        :role="role"
        @create-child="onDetailCreateChild"
        @rename="onDetailRename"
        @delete="onDetailDelete"
        @select-child="onSelect"
      />
    </div>

    <DashboardLocationFormDialog
      :open="formDialog.open"
      :mode="formDialog.mode"
      :parent-name="formDialog.parentName"
      :initial-name="formDialog.initialName"
      :initial-description="formDialog.initialDescription"
      :loading="formDialog.loading"
      :error-msg="formDialog.error"
      @close="closeFormDialog"
      @submit="submitFormDialog"
    />

    <DashboardConfirmDialog
      :open="confirmDialog.open"
      :title="t('dashboard.locations.delete_confirm_title')"
      :message="t('dashboard.locations.delete_confirm_message', { name: confirmDialog.targetName })"
      :confirm-label="t('dashboard.locations.delete')"
      :loading="confirmDialog.loading"
      tone="danger"
      @close="closeConfirm"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.board { min-height: 0; }
.board-grid {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 14px;
  min-height: 0;
  height: 100%;
}
@media (max-width: 980px) {
  .board-grid {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(280px, 40vh) 1fr;
  }
}
</style>
