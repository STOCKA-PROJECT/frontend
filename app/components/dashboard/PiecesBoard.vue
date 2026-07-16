<script setup lang="ts">
import { FetchError } from 'ofetch'
import type {
  LocationResponseDto,
  LocationTreeNodeDto,
  OrganizationRole,
  PieceListItemDto
} from '~/types/api'

const props = defineProps<{
  orgSlug: string
  role: OrganizationRole | null
}>()

const { t } = useI18n()
const { orgPath } = useOrgPath()

const pieces = usePiecesStore()
const pieceTypes = usePieceTypesStore()
const locations = useLocationsStore()
const team = useTeamStore()
const orgAttributes = useOrganizationPieceAttributesStore()
const contacts = useContactsStore()

const canWrite = computed(() => props.role === 'OWNER' || props.role === 'MANAGER' || props.role === 'USER')

const importExportOpen = ref(false)

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
      // organizationId is a legacy field in the flattened payload — the API
      // is now slug-scoped, but downstream consumers still expect a number.
      organizationId: 0,
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
  const members = team.getMembers(props.orgSlug) ?? []
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
      pieceTypes.fetchAll(props.orgSlug).catch(() => undefined),
      locations.fetchTree(props.orgSlug).catch(() => undefined),
      team.fetchMembers(props.orgSlug).catch(() => undefined),
      orgAttributes.fetchAll(props.orgSlug).catch(() => undefined),
      contacts.fetchContacts(props.orgSlug).catch(() => undefined),
      pieces.fetchList(props.orgSlug)
    ])
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
}

// Use a single watcher with `immediate: true` so the initial load and the
// org-switch reload share the same code path (see vue-router rule:
// route-param changes do not retrigger lifecycle hooks).
watch(() => props.orgSlug, async (next, prev) => {
  if (prev !== undefined && next !== prev) {
    pieces.reset()
    pieceTypes.reset()
    locations.reset()
  }
  await loadAll()
}, { immediate: true })

async function onFilterChange(patch: Record<string, unknown>) {
  try {
    await pieces.setFilters(props.orgSlug, patch)
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
}

async function onClearFilters() {
  try {
    await pieces.resetFilters(props.orgSlug)
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
}

async function onPageChange(page: number) {
  try {
    await pieces.setFilters(props.orgSlug, { page })
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
}
async function onSizeChange(size: number) {
  try {
    await pieces.setFilters(props.orgSlug, { size, page: 0 })
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
}

function goToCreate() {
  if (!canWrite.value) return
  void navigateTo(orgPath('/articulos/nuevo'))
}

async function onImported() {
  try {
    await pieces.fetchList(props.orgSlug)
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.load_list')))
  }
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
    await pieces.softDelete(props.orgSlug, id)
    closeConfirm()
    await pieces.fetchList(props.orgSlug)
  } catch (e) {
    showError(extractErrorMessage(e, t('dashboard.pieces.errors.delete')))
    closeConfirm()
  } finally {
    confirmDialog.value.loading = false
  }
}

function pieceLink(piece: PieceListItemDto) {
  return orgPath(`/articulos/${piece.id}`)
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
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="secondary-btn"
          :disabled="pieces.loadingList"
          @click="importExportOpen = true"
        >
          <DashboardIcon name="upload" :size="14" />
          {{ canWrite
            ? t('dashboard.pieces.import_export.open')
            : t('dashboard.pieces.import_export.open_export_only') }}
        </button>
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
    </div>

    <div v-if="errorMsg" role="alert"
      class="mx-5 mb-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <div class="flex-1 min-h-0 overflow-hidden rounded-[14px] border border-line bg-bg-card">
      <DashboardPiecesFilterBar
        :filters="pieces.filters"
        :locations="flatLocations"
        :members="team.getMembers(orgSlug) ?? []"
        :contacts="contacts.getContacts(orgSlug) ?? []"
        :loading="pieces.loadingList"
        @change="onFilterChange"
        @clear="onClearFilters"
      />

      <DashboardPiecesAdvancedFilters
        :filters="pieces.filters"
        :piece-types="pieceTypes.list"
        :org-attributes="orgAttributes.listFor(orgSlug)"
        :members="team.getMembers(orgSlug) ?? []"
        :loading="pieces.loadingList"
        @change="onFilterChange"
      />

      <DashboardPiecesTable
        :pieces="pieces.list"
        :loading="pieces.loadingList"
        :org-slug="orgSlug"
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

    <DashboardPieceImportExportDialog
      :open="importExportOpen"
      :org-slug="orgSlug"
      :can-write="canWrite"
      :filters="pieces.filters"
      @close="importExportOpen = false"
      @imported="onImported"
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
.secondary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  background: var(--c-bg-card);
  color: var(--c-ink);
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  transition: background .15s, border-color .15s;
}
.secondary-btn:hover:not(:disabled) {
  background: var(--c-bg-soft);
  border-color: var(--c-line-strong);
}
.secondary-btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
