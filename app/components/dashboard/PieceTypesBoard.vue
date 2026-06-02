<script setup lang="ts">
import { FetchError } from 'ofetch'
import type {
  CreatePieceTypeActionDto,
  CreatePieceTypeAttributeDto,
  OrganizationRole,
  PieceTypeActionResponseDto,
  PieceTypeAttributeResponseDto,
  UpdatePieceTypeActionDto,
  UpdatePieceTypeAttributeDto
} from '~/types/api'

const props = withDefaults(defineProps<{
  orgSlug: string
  role: OrganizationRole | null
  actionsEnabled?: boolean
}>(), {
  actionsEnabled: false
})

const { t } = useI18n()
const pieceTypes = usePieceTypesStore()

const selectedId = ref<number | null>(null)

const canWrite = computed(() => props.role === 'OWNER' || props.role === 'MANAGER')
const canViewActions = computed(() => props.actionsEnabled === true)
const canManageActions = computed(() => canViewActions.value && canWrite.value)

const selectedActions = computed<PieceTypeActionResponseDto[]>(() =>
  selectedId.value != null ? pieceTypes.actionsByTypeId[selectedId.value] ?? [] : [])

const selected = computed(() => selectedId.value != null
  ? pieceTypes.byId[selectedId.value] ?? null
  : null)

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
    const data = e.response?._data as { message?: string } | undefined
    return data?.message ?? fallback
  }
  return fallback
}

async function loadAll() {
  try {
    await pieceTypes.fetchAll(props.orgSlug)
  } catch {
    showError(t('dashboard.pieceTypes.errors.load_list'))
  }
}

watch(() => props.orgSlug, async (next, prev) => {
  if (prev !== undefined && next !== prev) pieceTypes.reset()
  selectedId.value = null
  await loadAll()
}, { immediate: true })

watch(selectedId, async (id) => {
  if (id == null) return
  if (!pieceTypes.byId[id]) {
    try {
      await pieceTypes.fetchOne(props.orgSlug, id)
    } catch {
      showError(t('dashboard.pieceTypes.errors.load_detail'))
    }
  }
  if (canViewActions.value && !pieceTypes.actionsByTypeId[id]) {
    try {
      await pieceTypes.fetchActions(props.orgSlug, id)
    } catch {
      showError(t('dashboard.pieceTypes.errors.load_actions'))
    }
  }
})

const formDialog = ref<{
  open: boolean
  mode: 'create' | 'rename'
  targetId?: number
  initialName: string
  loading: boolean
  error: string | null
}>({
  open: false,
  mode: 'create',
  initialName: '',
  loading: false,
  error: null
})

function openCreateType() {
  formDialog.value = {
    open: true,
    mode: 'create',
    initialName: '',
    loading: false,
    error: null
  }
}

function openRenameType(id: number) {
  const t_ = pieceTypes.byId[id]
  formDialog.value = {
    open: true,
    mode: 'rename',
    targetId: id,
    initialName: t_?.name ?? '',
    loading: false,
    error: null
  }
}

function closeFormDialog() {
  formDialog.value = { ...formDialog.value, open: false, error: null, loading: false }
}

async function submitFormDialog(payload: { name: string }) {
  formDialog.value.loading = true
  formDialog.value.error = null
  try {
    if (formDialog.value.mode === 'create') {
      const created = await pieceTypes.create(props.orgSlug, { name: payload.name })
      selectedId.value = created.id
    } else if (formDialog.value.targetId) {
      await pieceTypes.update(props.orgSlug, formDialog.value.targetId, { name: payload.name })
    }
    closeFormDialog()
  } catch (e) {
    formDialog.value.error = extractErrorMessage(e, t('dashboard.pieceTypes.errors.save_type'))
  } finally {
    formDialog.value.loading = false
  }
}

const attrFormDialog = ref<{
  open: boolean
  mode: 'create' | 'edit'
  typeId: number | null
  initial: PieceTypeAttributeResponseDto | null
  loading: boolean
  error: string | null
}>({
  open: false,
  mode: 'create',
  typeId: null,
  initial: null,
  loading: false,
  error: null
})

function openCreateAttribute() {
  if (!selected.value) return
  attrFormDialog.value = {
    open: true,
    mode: 'create',
    typeId: selected.value.id,
    initial: null,
    loading: false,
    error: null
  }
}

function openEditAttribute(attrId: number) {
  if (!selected.value) return
  const attr = selected.value.attributes.find(a => a.id === attrId)
  if (!attr) return
  attrFormDialog.value = {
    open: true,
    mode: 'edit',
    typeId: selected.value.id,
    initial: attr,
    loading: false,
    error: null
  }
}

function closeAttrDialog() {
  attrFormDialog.value = { ...attrFormDialog.value, open: false, error: null, loading: false }
}

async function submitAttrDialog(payload: CreatePieceTypeAttributeDto | UpdatePieceTypeAttributeDto) {
  if (!attrFormDialog.value.typeId) return
  attrFormDialog.value.loading = true
  attrFormDialog.value.error = null
  try {
    const typeId = attrFormDialog.value.typeId
    if (attrFormDialog.value.mode === 'create') {
      await pieceTypes.addAttribute(props.orgSlug, typeId, payload as CreatePieceTypeAttributeDto)
    } else if (attrFormDialog.value.initial) {
      await pieceTypes.updateAttribute(
        props.orgSlug,
        typeId,
        attrFormDialog.value.initial.id,
        payload as UpdatePieceTypeAttributeDto
      )
    }
    closeAttrDialog()
  } catch (e) {
    attrFormDialog.value.error = extractErrorMessage(e, t('dashboard.pieceTypes.errors.save_attribute'))
  } finally {
    attrFormDialog.value.loading = false
  }
}

const actionFormDialog = ref<{
  open: boolean
  mode: 'create' | 'edit'
  typeId: number | null
  initial: PieceTypeActionResponseDto | null
  loading: boolean
  error: string | null
}>({
  open: false,
  mode: 'create',
  typeId: null,
  initial: null,
  loading: false,
  error: null
})

function openCreateAction() {
  if (!selected.value) return
  actionFormDialog.value = {
    open: true,
    mode: 'create',
    typeId: selected.value.id,
    initial: null,
    loading: false,
    error: null
  }
}

function openEditAction(actionId: number) {
  if (selectedId.value == null) return
  const action = selectedActions.value.find(a => a.id === actionId)
  if (!action) return
  actionFormDialog.value = {
    open: true,
    mode: 'edit',
    typeId: selectedId.value,
    initial: action,
    loading: false,
    error: null
  }
}

function closeActionDialog() {
  actionFormDialog.value = { ...actionFormDialog.value, open: false, error: null, loading: false }
}

async function submitActionDialog(payload: CreatePieceTypeActionDto | UpdatePieceTypeActionDto) {
  if (actionFormDialog.value.typeId == null) return
  actionFormDialog.value.loading = true
  actionFormDialog.value.error = null
  try {
    const typeId = actionFormDialog.value.typeId
    if (actionFormDialog.value.mode === 'create') {
      await pieceTypes.addAction(props.orgSlug, typeId, payload as CreatePieceTypeActionDto)
    } else if (actionFormDialog.value.initial) {
      await pieceTypes.updateAction(
        props.orgSlug,
        typeId,
        actionFormDialog.value.initial.id,
        payload as UpdatePieceTypeActionDto
      )
    }
    closeActionDialog()
  } catch (e) {
    actionFormDialog.value.error = extractErrorMessage(e, t('dashboard.pieceTypes.errors.save_action'))
  } finally {
    actionFormDialog.value.loading = false
  }
}

const actionDialogTypeName = computed(() => {
  if (actionFormDialog.value.typeId == null) return ''
  return pieceTypes.byId[actionFormDialog.value.typeId]?.name ?? ''
})

const confirmDialog = ref<{
  open: boolean
  kind: 'type' | 'attribute' | 'action' | null
  typeId: number | null
  attrId: number | null
  actionId: number | null
  targetName: string
  loading: boolean
}>({
  open: false,
  kind: null,
  typeId: null,
  attrId: null,
  actionId: null,
  targetName: '',
  loading: false
})

function openDeleteType(id: number) {
  const t_ = pieceTypes.byId[id]
  confirmDialog.value = {
    open: true,
    kind: 'type',
    typeId: id,
    attrId: null,
    actionId: null,
    targetName: t_?.name ?? '',
    loading: false
  }
}

function openDeleteAttribute(attrId: number) {
  if (!selected.value) return
  const attr = selected.value.attributes.find(a => a.id === attrId)
  if (!attr) return
  confirmDialog.value = {
    open: true,
    kind: 'attribute',
    typeId: selected.value.id,
    attrId,
    actionId: null,
    targetName: attr.displayName,
    loading: false
  }
}

function openDeleteAction(actionId: number) {
  if (selectedId.value == null) return
  const action = selectedActions.value.find(a => a.id === actionId)
  if (!action) return
  confirmDialog.value = {
    open: true,
    kind: 'action',
    typeId: selectedId.value,
    attrId: null,
    actionId,
    targetName: action.displayName,
    loading: false
  }
}

function closeConfirm() {
  confirmDialog.value = { ...confirmDialog.value, open: false }
}

const DELETE_ERROR_KEYS: Record<'type' | 'attribute' | 'action', string> = {
  type: 'dashboard.pieceTypes.errors.delete_type',
  attribute: 'dashboard.pieceTypes.errors.delete_attribute',
  action: 'dashboard.pieceTypes.errors.delete_action'
}

async function confirmDelete() {
  const c = confirmDialog.value
  const kind = c.kind
  if (!kind) return
  c.loading = true
  try {
    if (kind === 'type' && c.typeId != null) {
      await pieceTypes.softDelete(props.orgSlug, c.typeId)
      if (selectedId.value === c.typeId) selectedId.value = null
    } else if (kind === 'attribute' && c.typeId != null && c.attrId != null) {
      await pieceTypes.removeAttribute(props.orgSlug, c.typeId, c.attrId)
    } else if (kind === 'action' && c.typeId != null && c.actionId != null) {
      await pieceTypes.removeAction(props.orgSlug, c.typeId, c.actionId)
    }
    closeConfirm()
  } catch (e) {
    showError(extractErrorMessage(e, t(DELETE_ERROR_KEYS[kind])))
    closeConfirm()
  } finally {
    confirmDialog.value.loading = false
  }
}

const confirmTitle = computed(() => {
  switch (confirmDialog.value.kind) {
    case 'attribute': return t('dashboard.pieceTypes.delete.attribute_confirm_title')
    case 'action': return t('dashboard.pieceTypes.actions.delete_confirm_title')
    default: return t('dashboard.pieceTypes.delete.confirm_title')
  }
})

const confirmMessage = computed(() => {
  const name = confirmDialog.value.targetName
  switch (confirmDialog.value.kind) {
    case 'attribute': return t('dashboard.pieceTypes.delete.attribute_confirm_message', { name })
    case 'action': return t('dashboard.pieceTypes.actions.delete_confirm_message', { name })
    default: return t('dashboard.pieceTypes.delete.confirm_message', { name })
  }
})

const attrDialogTypeName = computed(() => {
  if (!attrFormDialog.value.typeId) return ''
  return pieceTypes.byId[attrFormDialog.value.typeId]?.name ?? ''
})
</script>

<template>
  <div class="board flex h-full flex-col gap-3">
    <div v-if="errorMsg" role="alert"
      class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <div class="board-grid flex-1">
      <DashboardPieceTypesList
        :types="pieceTypes.list"
        :loading="pieceTypes.loading"
        :selected-id="selectedId"
        :can-write="canWrite"
        @select="(id) => selectedId = id"
        @create="openCreateType"
        @rename="openRenameType"
        @delete="openDeleteType"
      />

      <DashboardPieceTypeDetailPanel
        :detail="selected"
        :can-write="canWrite"
        :actions="selectedActions"
        :can-view-actions="canViewActions"
        :can-manage-actions="canManageActions"
        @rename="selectedId != null && openRenameType(selectedId)"
        @delete="selectedId != null && openDeleteType(selectedId)"
        @add-attribute="openCreateAttribute"
        @edit-attribute="openEditAttribute"
        @delete-attribute="openDeleteAttribute"
        @add-action="openCreateAction"
        @edit-action="openEditAction"
        @delete-action="openDeleteAction"
      />
    </div>

    <DashboardPieceTypeFormDialog
      :open="formDialog.open"
      :mode="formDialog.mode"
      :initial-name="formDialog.initialName"
      :loading="formDialog.loading"
      :error-msg="formDialog.error"
      @close="closeFormDialog"
      @submit="submitFormDialog"
    />

    <DashboardPieceTypeAttributeFormDialog
      :open="attrFormDialog.open"
      :mode="attrFormDialog.mode"
      :type-name="attrDialogTypeName"
      :initial="attrFormDialog.initial"
      :loading="attrFormDialog.loading"
      :error-msg="attrFormDialog.error"
      @close="closeAttrDialog"
      @submit="submitAttrDialog"
    />

    <DashboardPieceTypeActionFormDialog
      :open="actionFormDialog.open"
      :mode="actionFormDialog.mode"
      :type-name="actionDialogTypeName"
      :initial="actionFormDialog.initial"
      :loading="actionFormDialog.loading"
      :error-msg="actionFormDialog.error"
      @close="closeActionDialog"
      @submit="submitActionDialog"
    />

    <DashboardConfirmDialog
      :open="confirmDialog.open"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-label="t('dashboard.pieceTypes.delete.confirm_label')"
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
@media (min-width: 960px) {
  .board-grid {
    grid-template-columns: minmax(280px, 360px) 1fr;
    grid-template-rows: 1fr;
    gap: 14px;
  }
}
</style>
