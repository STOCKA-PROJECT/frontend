<script setup lang="ts">
import { FetchError } from 'ofetch'
import type {
  LocationResponseDto,
  LocationTreeNodeDto,
  OrganizationRole,
  PieceListItemDto
} from '~/types/api'

const props = defineProps<{
  orgId: number
  role: OrganizationRole | null
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const pieces = usePiecesStore()
const pieceTypes = usePieceTypesStore()
const locations = useLocationsStore()
const team = useTeamStore()

const canWrite = computed(() => props.role === 'OWNER' || props.role === 'MANAGER' || props.role === 'USER')

const errorMsg = ref<string | null>(null)
let errorTimer: ReturnType<typeof setTimeout> | null = null

function showError(msg: string) {
  errorMsg.value = msg
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => { errorMsg.value = null }, 6000)
}

onBeforeUnmount(() => { if (errorTimer) clearTimeout(errorTimer) })

function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof FetchError) {
    const data = e.response?._data as { message?: string; detail?: string } | undefined
    return data?.message ?? data?.detail ?? fallback
  }
  return fallback
}

function flattenTree(nodes: LocationTreeNodeDto[], parents: string[] = []): LocationResponseDto[] {
  const out: LocationResponseDto[] = []
  for (const n of nodes) {
    const path = [...parents, n.name]
    out.push({
      id: n.id,
      organizationId: props.orgId,
      name: path.join(' / '),
      description: n.description,
      breadcrumb: []
    } as unknown as LocationResponseDto)
    if (n.children?.length) {
      out.push(...flattenTree(n.children, path))
    }
  }
  return out
}

const flatLocations = computed(() => flattenTree(locations.tree))
const locationNameById = computed(() => {
  const map = new Map<number, string>()
  for (const loc of flatLocations.value) map.set(loc.id, loc.name)
  return map
})
const ownerNameById = computed(() => {
  const map = new Map<number, string>()
  const members = team.getMembers(props.orgId) ?? []
  for (const m of members) map.set(m.userId, `${m.name} ${m.lastName}`.trim())
  return map
})

function locationName(id?: number) {
  return id != null ? locationNameById.value.get(id) : undefined
}
function ownerName(id?: number) {
  return id != null ? ownerNameById.value.get(id) : undefined
}

async function loadAll() {
  try {
    await Promise.all([
      pieceTypes.fetchAll(props.orgId).catch(() => undefined),
      locations.fetchTree(props.orgId).catch(() => undefined),
      team.fetchMembers(props.orgId).catch(() => undefined),
      pieces.fetchList(props.orgId)
    ])
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
}

onMounted(() => {
  void loadAll()
})

watch(() => props.orgId, async (next, prev) => {
  if (prev === undefined || next === prev) return
  pieces.reset()
  pieceTypes.reset()
  locations.reset()
  await loadAll()
})

async function onFilterChange(patch: Record<string, unknown>) {
  try {
    await pieces.setFilters(props.orgId, patch)
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
}

async function onClearFilters() {
  try {
    await pieces.resetFilters(props.orgId)
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
}

async function onPageChange(page: number) {
  try {
    await pieces.setFilters(props.orgId, { page })
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
}
async function onSizeChange(size: number) {
  try {
    await pieces.setFilters(props.orgId, { size, page: 0 })
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
}

function goToCreate() {
  if (!canWrite.value) return
  void navigateTo(localePath('/dashboard/articulos/nuevo'))
}

const confirmDialog = ref<{
  open: boolean
  pieceId: number | null
  pieceName: string
  loading: boolean
}>({
  open: false,
  pieceId: null,
  pieceName: '',
  loading: false
})

function onDelete(piece: PieceListItemDto) {
  confirmDialog.value = {
    open: true,
    pieceId: piece.id,
    pieceName: piece.name,
    loading: false
  }
}
function closeConfirm() {
  confirmDialog.value = { ...confirmDialog.value, open: false }
}
async function confirmDelete() {
  const id = confirmDialog.value.pieceId
  if (id == null) return
  confirmDialog.value.loading = true
  try {
    await pieces.softDelete(props.orgId, id)
    closeConfirm()
    await pieces.fetchList(props.orgId)
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.delete')))
    closeConfirm()
  } finally {
    confirmDialog.value.loading = false
  }
}

function pieceLink(piece: PieceListItemDto) {
  return localePath(`/dashboard/articulos/${piece.id}`)
}
</script>

<template>
  <div class="board flex h-full flex-col">
    <div class="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-1">
      <div class="text-[12.5px] text-ink-muted">
        <span v-if="pieces.pageMeta && pieces.pageMeta.totalElements > 0">
          {{ t('dashboard.pieces.total_count', { n: pieces.pageMeta.totalElements }) }}
        </span>
      </div>
      <button
        v-if="canWrite"
        type="button"
        class="primary-btn"
        :disabled="pieces.loadingList"
        @click="goToCreate"
      >
        <DashboardIcon name="plus" :size="14" />
        {{ t('dashboard.pieces.actions.new') }}
      </button>
    </div>

    <div v-if="errorMsg" role="alert"
      class="mx-5 mb-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <div class="flex-1 min-h-0 overflow-hidden rounded-[14px] border border-line bg-bg-card">
      <DashboardPiecesFilterBar
        :filters="pieces.filters"
        :piece-types="pieceTypes.list"
        :locations="flatLocations"
        :members="team.getMembers(orgId) ?? []"
        :loading="pieces.loadingList"
        @change="onFilterChange"
        @clear="onClearFilters"
      />

      <DashboardPiecesTable
        :pieces="pieces.list"
        :loading="pieces.loadingList"
        :org-id="orgId"
        :show-location="true"
        :show-owner="true"
        :can-write="canWrite"
        :link-to="pieceLink"
        :location-name="locationName"
        :owner-name="ownerName"
        @delete="onDelete"
      />

      <DashboardPagination
        v-if="pieces.pageMeta && pieces.pageMeta.totalPages > 0"
        :page="pieces.pageMeta.number"
        :total-pages="pieces.pageMeta.totalPages"
        :size="pieces.pageMeta.size || (pieces.filters.size ?? 20)"
        :total-elements="pieces.pageMeta.totalElements"
        :disabled="pieces.loadingList"
        @update:page="onPageChange"
        @update:size="onSizeChange"
      />
    </div>

    <DashboardConfirmDialog
      :open="confirmDialog.open"
      :title="t('dashboard.pieces.confirm.delete_title')"
      :message="t('dashboard.pieces.confirm.delete_body', { name: confirmDialog.pieceName })"
      :confirm-label="t('dashboard.pieces.actions.delete')"
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
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  background: var(--c-ink);
  color: var(--c-bg-card);
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--c-ink);
  transition: background .15s;
}
.primary-btn:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-ink) 88%, transparent);
}
.primary-btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
