<script setup lang="ts">
import type { LocationTreeNodeDto, OrganizationRole } from '~/types/api'

const props = defineProps<{
  orgId: number
  role: OrganizationRole | null
}>()

const { t } = useI18n()
const locations = useLocationsStore()
const pieces = usePiecesStore()
const toast = useToastStore()
const apiError = useApiError()

function notifyError(e: unknown) {
  const view = apiError(e)
  toast.push({ type: 'error', title: view.title, description: view.description })
}

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
  } catch (e) {
    notifyError(e)
  }
}

async function loadFocusedPieces() {
  try {
    if (focus.value.kind === 'location') {
      await pieces.fetchByLocation(props.orgId, focus.value.id)
    } else if (focus.value.kind === 'unassigned') {
      await pieces.fetchByLocation(props.orgId, null)
    }
  } catch (e) {
    notifyError(e)
  }
}

async function loadDetail(id: number) {
  try {
    await locations.fetchOne(props.orgId, id)
  } catch (e) {
    notifyError(e)
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
    notifyError(e)
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
    notifyError(e)
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
    formDialog.value.error = apiError(e).description
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
    notifyError(e)
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
  grid-template-columns: 1fr;
  grid-template-rows: minmax(280px, 40vh) 1fr;
  gap: 12px;
  min-height: 0;
  height: 100%;
}
@media (min-width: 1024px) {
  .board-grid {
    grid-template-columns: minmax(280px, 360px) 1fr;
    grid-template-rows: 1fr;
    gap: 14px;
  }
}
</style>
