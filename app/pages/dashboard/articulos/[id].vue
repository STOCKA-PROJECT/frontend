<script setup lang="ts">
import { FetchError } from 'ofetch'
import type { LocationResponseDto, LocationTreeNodeDto, UpdatePieceDto } from '~/types/api'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const orgs = useOrganizationsStore()
const pieces = usePiecesStore()
const pieceTypes = usePieceTypesStore()
const locations = useLocationsStore()
const team = useTeamStore()

if (orgs.list.length === 0) {
  await orgs.fetchList()
}
if (!orgs.current) {
  await navigateTo(localePath('/dashboard/crear-organizacion'))
}

const orgId = computed(() => orgs.current?.id ?? null)
const role = computed(() => orgs.current?.currentUserRole ?? null)
const canWrite = computed(() => role.value === 'OWNER' || role.value === 'MANAGER' || role.value === 'USER')

const pieceId = computed(() => Number(route.params.id))

const piece = computed(() => detailFor(pieceId.value))
function detailFor(id: number) {
  return pieces.detailById[id] ?? null
}

const piecePieceTypes = computed(() => {
  if (!piece.value) return []
  return piece.value.pieceTypes
    .map(ref => pieceTypes.byId[ref.id])
    .filter((pt): pt is NonNullable<typeof pt> => Boolean(pt))
})

const pieceTypesLabel = computed(() => piece.value
  ? piece.value.pieceTypes.map(t => t.name).join(' · ')
  : ''
)

function flattenTree(nodes: LocationTreeNodeDto[], parents: string[] = []): LocationResponseDto[] {
  const out: LocationResponseDto[] = []
  for (const n of nodes) {
    const path = [...parents, n.name]
    out.push({
      id: n.id,
      organizationId: orgId.value ?? 0,
      name: path.join(' / '),
      description: n.description,
      breadcrumb: []
    } as unknown as LocationResponseDto)
    if (n.children?.length) out.push(...flattenTree(n.children, path))
  }
  return out
}
const flatLocations = computed(() => flattenTree(locations.tree))

const loading = ref(true)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const saving = ref(false)

const tab = ref<'info' | 'attachments' | 'history'>('info')

function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof FetchError) {
    const data = e.response?._data as { message?: string; detail?: string } | undefined
    return data?.message ?? data?.detail ?? fallback
  }
  return fallback
}

async function loadAll() {
  if (orgId.value == null) return
  loading.value = true
  loadError.value = null
  try {
    const detail = await pieces.fetchDetail(orgId.value, pieceId.value)
    const orgIdValue = orgId.value
    const typeFetches = detail.pieceTypes
      .filter(t => !pieceTypes.byId[t.id])
      .map(t => pieceTypes.fetchOne(orgIdValue, t.id).catch(() => undefined))
    // We always (re)fetch the full type list so the edit form has every type available, not
    // only the ones currently attached to the piece.
    if (pieceTypes.list.length === 0) {
      typeFetches.push(pieceTypes.fetchAll(orgIdValue).then(() => undefined).catch(() => undefined))
    }
    await Promise.all([
      ...typeFetches,
      locations.tree.length > 0
        ? Promise.resolve()
        : locations.fetchTree(orgIdValue).catch(() => undefined),
      team.getMembers(orgIdValue)
        ? Promise.resolve()
        : team.fetchMembers(orgIdValue).catch(() => undefined)
    ])
  } catch (e) {
    if (e instanceof FetchError && e.response?.status === 404) {
      loadError.value = t('dashboard.pieces.errors.not_found')
    } else {
      loadError.value = extractErrorMessage(e, t('dashboard.pieces.errors.load_detail'))
    }
  } finally {
    loading.value = false
  }
}

watch([orgId, pieceId], () => { void loadAll() }, { immediate: true })

useSeoMeta({
  title: () => piece.value?.name ?? t('dashboard.pieces.page_title'),
  robots: 'noindex, nofollow'
})

async function onSave(payload: UpdatePieceDto) {
  if (orgId.value == null || piece.value == null) return
  if (Object.keys(payload).length === 0) {
    saveError.value = null
    return
  }
  saving.value = true
  saveError.value = null
  try {
    await pieces.update(orgId.value, piece.value.id, payload)
  } catch (e) {
    saveError.value = extractErrorMessage(e, t('dashboard.pieces.errors.save'))
  } finally {
    saving.value = false
  }
}

const confirmDelete = ref(false)
const deleting = ref(false)
function askDelete() {
  if (!canWrite.value) return
  confirmDelete.value = true
}
function cancelDelete() {
  confirmDelete.value = false
}
async function doDelete() {
  if (orgId.value == null || piece.value == null) return
  deleting.value = true
  try {
    await pieces.softDelete(orgId.value, piece.value.id)
    confirmDelete.value = false
    void navigateTo(localePath('/dashboard/articulos'))
  } catch (e) {
    saveError.value = extractErrorMessage(e, t('dashboard.pieces.errors.delete'))
    confirmDelete.value = false
  } finally {
    deleting.value = false
  }
}

const members = computed(() => (orgId.value != null && team.getMembers(orgId.value)) || [])
</script>

<template>
  <div class="page flex flex-col gap-5 px-8 pb-10 pt-6 max-md:px-4">
    <NuxtLink :to="localePath('/dashboard/articulos')" class="back-link">
      ← {{ t('dashboard.pieces.back_to_list') }}
    </NuxtLink>

    <div v-if="loading" class="flex flex-col gap-4">
      <div class="h-8 w-1/3 animate-pulse rounded bg-bg-soft" />
      <div class="h-[300px] animate-pulse rounded-xl bg-bg-soft" />
    </div>

    <div v-else-if="loadError" role="alert" class="error-card">
      {{ loadError }}
    </div>

    <template v-else-if="piece && orgId != null">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <h1 class="truncate text-[24px] font-semibold tracking-[-0.02em] text-ink">
              {{ piece.name }}
            </h1>
            <span :class="['tag', piece.status === 'PENDING' ? 'tag-warn' : 'tag-ok']">
              {{ piece.status === 'PENDING'
                ? t('dashboard.pieces_table.status_pending')
                : t('dashboard.pieces_table.status_active') }}
            </span>
          </div>
          <p class="mt-1 text-[13.5px] text-ink-soft">
            {{ pieceTypesLabel || '—' }} · #{{ piece.id }}
          </p>
        </div>
        <div class="flex gap-2">
          <button
            v-if="canWrite"
            type="button"
            class="danger-btn"
            :disabled="deleting"
            @click="askDelete"
          >
            <DashboardIcon name="trash" :size="14" />
            {{ t('dashboard.pieces.actions.delete') }}
          </button>
        </div>
      </header>

      <nav class="tab-bar" :aria-label="t('dashboard.pieces.tabs_aria')">
        <button
          type="button"
          :class="['tab', { active: tab === 'info' }]"
          @click="tab = 'info'"
        >
          {{ t('dashboard.pieces.tabs.info') }}
        </button>
        <button
          type="button"
          :class="['tab', { active: tab === 'attachments' }]"
          @click="tab = 'attachments'"
        >
          {{ t('dashboard.pieces.tabs.attachments') }}
          <span class="tab-count">{{ piece.attachments.length }}</span>
        </button>
        <button
          type="button"
          :class="['tab', { active: tab === 'history' }]"
          @click="tab = 'history'"
        >
          {{ t('dashboard.pieces.tabs.history') }}
        </button>
      </nav>

      <section class="panel">
        <DashboardPieceInfoPanel
          v-if="tab === 'info'"
          :piece="piece"
          :piece-types="piecePieceTypes.length > 0 ? pieceTypes.list : piecePieceTypes"
          :locations="flatLocations"
          :members="members"
          :can-write="canWrite"
          :saving="saving"
          :error-msg="saveError"
          @save="onSave"
        />
        <DashboardPieceAttachmentsPanel
          v-else-if="tab === 'attachments'"
          :org-id="orgId"
          :piece-id="piece.id"
          :attachments="piece.attachments"
          :can-write="canWrite"
        />
        <DashboardPieceHistoryPanel
          v-else
          :org-id="orgId"
          :piece-id="piece.id"
          :members="members"
        />
      </section>

      <DashboardConfirmDialog
        :open="confirmDelete"
        :title="t('dashboard.pieces.confirm.delete_title')"
        :message="t('dashboard.pieces.confirm.delete_body', { name: piece.name })"
        :confirm-label="t('dashboard.pieces.actions.delete')"
        :loading="deleting"
        tone="danger"
        @close="cancelDelete"
        @confirm="doDelete"
      />
    </template>
  </div>
</template>

<style scoped>
.page { min-height: calc(100vh - var(--topbar-h, 56px)); }

.back-link {
  align-self: flex-start;
  font-size: 12.5px;
  color: var(--c-ink-soft);
  padding: 4px 0;
  transition: color .12s;
}
.back-link:hover { color: var(--c-ink); }

.error-card {
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  padding: 24px;
  border-radius: 12px;
  text-align: center;
  color: var(--c-ink-soft);
}

.danger-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-danger);
  font-size: 13px;
  transition: background .15s, border-color .15s;
}
.danger-btn:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-danger) 8%, transparent);
  border-color: var(--c-danger);
}
.danger-btn:disabled { opacity: .5; cursor: not-allowed; }

.tab-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--c-line);
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 13.5px;
  color: var(--c-ink-soft);
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color .12s, border-color .12s;
}
.tab:hover { color: var(--c-ink); }
.tab.active {
  color: var(--c-ink);
  border-bottom-color: var(--c-ink);
  font-weight: 500;
}
.tab-count {
  font-size: 11.5px;
  background: var(--c-bg-soft);
  padding: 1px 7px;
  border-radius: 999px;
  color: var(--c-ink-muted);
}

.panel {
  background: var(--c-bg-card);
  border: 1px solid var(--c-line);
  border-radius: 14px;
  padding: 20px 22px;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
}
.tag-ok { background: var(--c-accent-soft); color: var(--c-accent-ink); }
.tag-warn { background: var(--c-warn-soft); color: #8a6324; }
</style>
