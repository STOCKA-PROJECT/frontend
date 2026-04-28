<script setup lang="ts">
import type { LocationResponseDto, LocationTreeNodeDto, OrganizationRole, PieceListItemDto } from '~/types/api'

const props = defineProps<{
  selectedId: number | null
  isUnassignedFocus: boolean
  detail: LocationResponseDto | null
  childLocations: LocationTreeNodeDto[]
  pieces: PieceListItemDto[]
  loading?: boolean
  role: OrganizationRole | null
}>()

const emit = defineEmits<{
  'create-child': []
  rename: []
  delete: []
  'select-child': [id: number]
}>()

const { t } = useI18n()

const canManageLocations = computed(() => props.role === 'OWNER' || props.role === 'MANAGER')
const canMovePieces = computed(() => props.role === 'OWNER' || props.role === 'MANAGER' || props.role === 'USER')

const piecesCount = computed(() => props.pieces.length)
const childCount = computed(() => props.childLocations.length)

const breadcrumb = computed(() => {
  if (props.isUnassignedFocus) return [{ id: 0, name: t('dashboard.locations.unassigned') }]
  return props.detail?.breadcrumb ?? []
})

const showEmptyState = computed(() =>
  !props.isUnassignedFocus && !props.selectedId
)
</script>

<template>
  <section class="flex h-full flex-col overflow-hidden rounded-[14px] border border-line bg-bg-card">
    <div v-if="showEmptyState" class="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center">
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-bg-soft text-ink-muted">
        <DashboardIcon name="building" :size="20" />
      </div>
      <p class="max-w-[320px] text-[13.5px] text-ink-soft">
        {{ t('dashboard.locations.detail_empty') }}
      </p>
    </div>

    <template v-else>
      <header class="flex flex-col gap-2 border-b border-line px-6 py-4 max-md:px-4">
        <nav v-if="breadcrumb.length" :aria-label="t('dashboard.main_label')"
          class="flex flex-wrap items-center gap-1 text-[12px] text-ink-muted">
          <template v-for="(item, idx) in breadcrumb" :key="`${item.id}-${idx}`">
            <span aria-hidden="true" v-if="idx > 0" class="text-ink-muted">/</span>
            <span class="truncate" :class="{ 'font-medium text-ink-soft': idx === breadcrumb.length - 1 }">
              {{ item.name }}
            </span>
          </template>
        </nav>

        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate text-[20px] font-semibold tracking-[-0.015em] text-ink">
              {{ isUnassignedFocus ? t('dashboard.locations.unassigned') : detail?.name }}
            </h2>
            <p v-if="!isUnassignedFocus && detail?.description"
              class="mt-0.5 max-w-[640px] text-[13px] leading-relaxed text-ink-soft">
              {{ detail.description }}
            </p>
            <p v-else-if="isUnassignedFocus"
              class="mt-0.5 max-w-[640px] text-[13px] leading-relaxed text-ink-soft">
              {{ t('dashboard.locations.unassigned_subtitle') }}
            </p>
          </div>

          <div v-if="!isUnassignedFocus && canManageLocations" class="flex items-center gap-2">
            <button type="button" class="action-btn" @click="emit('create-child')">
              <DashboardIcon name="plus" :size="14" />
              <span class="max-md:hidden">{{ t('dashboard.locations.new_child') }}</span>
            </button>
            <button type="button" class="action-btn" @click="emit('rename')">
              {{ t('dashboard.locations.rename') }}
            </button>
            <button type="button" class="action-btn action-btn-danger" @click="emit('delete')">
              {{ t('dashboard.locations.delete') }}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <span class="chip">
            <DashboardIcon name="box" :size="12" />
            {{ t('dashboard.locations.pieces_count', { n: piecesCount }) }}
          </span>
          <span v-if="!isUnassignedFocus" class="chip">
            <DashboardIcon name="building" :size="12" />
            {{ t('dashboard.locations.subloc_count', { n: childCount }) }}
          </span>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto px-6 py-4 max-md:px-4">
        <section v-if="!isUnassignedFocus && childLocations.length" class="mb-6">
          <h3 class="mb-2 text-[11.5px] font-semibold uppercase tracking-[.06em] text-ink-muted">
            {{ t('dashboard.locations.children_title') }}
          </h3>
          <ul class="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
            <li v-for="child in childLocations" :key="child.id">
              <button type="button" class="child-card"
                @click="emit('select-child', child.id)">
                <DashboardIcon name="cabinet" :size="14" />
                <span class="truncate">{{ child.name }}</span>
                <span v-if="child.children?.length" class="ml-auto text-[11.5px] text-ink-muted">
                  {{ child.children.length }}
                </span>
              </button>
            </li>
          </ul>
        </section>

        <section>
          <h3 class="mb-2 text-[11.5px] font-semibold uppercase tracking-[.06em] text-ink-muted">
            {{ t('dashboard.locations.pieces_title') }}
          </h3>

          <div v-if="loading" class="flex flex-col gap-2">
            <div v-for="i in 3" :key="`s-${i}`"
              class="h-[58px] animate-pulse rounded-[10px] border border-line bg-bg-soft" />
          </div>

          <div v-else-if="!pieces.length" class="rounded-[10px] border border-dashed border-line bg-bg-soft px-4 py-8 text-center">
            <p class="text-[13px] text-ink-muted">{{ t('dashboard.locations.empty_pieces') }}</p>
          </div>

          <div v-else class="flex flex-col gap-2">
            <DashboardPieceDraggableRow v-for="p in pieces" :key="p.id"
              :piece="p" :draggable="canMovePieces" />
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.action-btn {
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
  transition: background .12s, border-color .12s, color .12s;
}
.action-btn:hover { background: var(--c-bg-soft); border-color: var(--c-line-strong); }
.action-btn-danger { color: var(--c-danger); border-color: color-mix(in oklab, var(--c-danger) 35%, transparent); }
.action-btn-danger:hover { background: var(--c-danger-soft); }

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  background: var(--c-bg-soft);
  color: var(--c-ink-soft);
}

.child-card {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border-radius: 9px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  font-size: 13px;
  text-align: left;
  transition: background .12s, border-color .12s;
}
.child-card:hover { background: var(--c-bg-soft); border-color: var(--c-line-strong); }
</style>
