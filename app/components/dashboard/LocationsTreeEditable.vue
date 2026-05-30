<script setup lang="ts">
import type { LocationTreeNodeDto, OrganizationRole } from '~/types/api'

const props = defineProps<{
  nodes: LocationTreeNodeDto[]
  loading?: boolean
  selectedId: number | null
  isUnassignedFocus: boolean
  role: OrganizationRole | null
}>()

const emit = defineEmits<{
  select: [id: number]
  'select-unassigned': []
  'drop-location': [payload: { sourceId: number; targetId: number | null }]
  'drop-piece': [payload: { pieceId: number; targetLocationId: number | null }]
  'create-root': []
  'create-child': [parentId: number]
  rename: [id: number]
  delete: [id: number]
}>()

const { t } = useI18n()
const expanded = ref<Set<number>>(new Set())
const currentDrag = useCurrentDrag()

const canEditLocations = computed(() => props.role === 'OWNER' || props.role === 'MANAGER')
const canMovePieces = computed(() => props.role === 'OWNER' || props.role === 'MANAGER' || props.role === 'USER')

const isDraggingLocation = computed(() => currentDrag.value?.kind === 'location')

const blockedIds = computed(() => {
  const drag = currentDrag.value
  if (!drag || drag.kind !== 'location') return new Set<number>()
  const ids = descendantIds(props.nodes, drag.id)
  ids.delete(drag.id)
  return ids
})

function toggle(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

watch(() => props.selectedId, (id) => {
  if (id == null) return
  const path = pathToId(props.nodes, id)
  if (path.length === 0) return
  const next = new Set(expanded.value)
  for (const ancestor of path.slice(0, -1)) next.add(ancestor)
  expanded.value = next
})

function pathToId(nodes: LocationTreeNodeDto[], id: number, trail: number[] = []): number[] {
  for (const n of nodes) {
    const next = [...trail, n.id]
    if (n.id === id) return next
    const child = pathToId(n.children ?? [], id, next)
    if (child.length) return child
  }
  return []
}

const rootDrop = useDropTarget({
  accept: ['location'],
  canDrop: (p) => {
    if (!canEditLocations.value) return false
    const isAlreadyRoot = props.nodes.some(n => n.id === p.id)
    return !isAlreadyRoot
  },
  onDrop: (p) => {
    emit('drop-location', { sourceId: p.id, targetId: null })
  }
})

const unassignedDrop = useDropTarget({
  accept: ['piece'],
  canDrop: () => canMovePieces.value,
  onDrop: (p) => {
    emit('drop-piece', { pieceId: p.id, targetLocationId: null })
  }
})
</script>

<template>
  <aside class="tree-wrap flex h-full flex-col overflow-hidden rounded-[14px] border border-line bg-bg-card">
    <header class="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
      <h2 class="text-[13.5px] font-semibold tracking-[-0.005em] text-ink">
        {{ t('dashboard.locations.tree_title') }}
      </h2>
      <button v-if="canEditLocations" type="button" class="hdr-btn" @click="emit('create-root')">
        <DashboardIcon name="plus" :size="13" />
        <span class="max-md:hidden">{{ t('dashboard.locations.new_root') }}</span>
      </button>
    </header>

    <div class="flex-1 overflow-y-auto px-2 py-2" role="tree">
      <div v-if="loading" class="flex flex-col gap-1.5 px-1">
        <div v-for="i in 5" :key="`s-${i}`" class="h-7 animate-pulse rounded bg-bg-soft" />
      </div>

      <div v-else-if="!nodes.length" class="px-3 py-6 text-center">
        <p class="text-[13px] text-ink-muted">{{ t('dashboard.locations.empty_tree') }}</p>
        <button v-if="canEditLocations" type="button" class="mt-3 hdr-btn" @click="emit('create-root')">
          <DashboardIcon name="plus" :size="13" />
          <span>{{ t('dashboard.locations.new_root') }}</span>
        </button>
      </div>

      <div v-else>
        <DashboardLocationNodeEditable v-for="node in nodes" :key="node.id" :node="node" :selected-id="selectedId"
          :expanded="expanded" :blocked-ids="blockedIds" :can-edit-locations="canEditLocations"
          :can-move-pieces="canMovePieces" @toggle="toggle" @select="(id) => emit('select', id)"
          @drop-location="(p) => emit('drop-location', { sourceId: p.sourceId, targetId: p.targetId })"
          @drop-piece="(p) => emit('drop-piece', { pieceId: p.pieceId, targetLocationId: p.targetLocationId })"
          @create-child="(id) => emit('create-child', id)" @rename="(id) => emit('rename', id)"
          @delete="(id) => emit('delete', id)" />
      </div>
    </div>

    <!-- Footer-mounted root drop zone: only present while a location is being
         dragged. Inserting an element here only shrinks the scrollable tree
         area from the bottom — rows at the top of the tree (where the drag
         source lives) keep their on-screen position, so Chromium doesn't
         cancel the drag. -->
    <div v-if="isDraggingLocation && canEditLocations" class="root-drop" :class="{
      'is-drop-ok': rootDrop.isOver.value && !rootDrop.isInvalid.value,
      'is-drop-bad': rootDrop.isOver.value && rootDrop.isInvalid.value
    }" aria-hidden="true" @dragenter="rootDrop.onDragEnter" @dragover="rootDrop.onDragOver"
      @dragleave="rootDrop.onDragLeave" @drop="rootDrop.onDrop">
      <DashboardIcon name="upload" :size="13" />
      <span>{{ t('dashboard.locations.drop_to_root') }}</span>
    </div>

    <button type="button" class="unassigned-row" :class="{
      'is-selected': isUnassignedFocus,
      'is-drop-ok': unassignedDrop.isOver.value && !unassignedDrop.isInvalid.value
    }" @click="emit('select-unassigned')" @dragenter="unassignedDrop.onDragEnter"
      @dragover="unassignedDrop.onDragOver" @dragleave="unassignedDrop.onDragLeave" @drop="unassignedDrop.onDrop">
      <DashboardIcon name="folder" :size="14" />
      <span>{{ t('dashboard.locations.unassigned') }}</span>
    </button>
  </aside>
</template>

<style scoped>
.hdr-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .12s, border-color .12s;
}

.hdr-btn:hover {
  background: var(--c-bg-soft);
  border-color: var(--c-line-strong);
}

.root-drop {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0 8px 8px;
  padding: 8px 12px;
  border-radius: 9px;
  border: 1px dashed var(--c-line-strong);
  background: var(--c-bg-soft);
  font-size: 12px;
  color: var(--c-ink-muted);
  transition: background .12s, border-color .12s, color .12s;
}

.root-drop.is-drop-ok {
  background: var(--c-accent-soft);
  border-color: var(--c-accent);
  color: var(--c-accent-ink);
}

.root-drop.is-drop-bad {
  background: var(--c-danger-soft);
  border-color: var(--c-danger);
  color: var(--c-danger);
}

.unassigned-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--c-line);
  font-size: 13px;
  color: var(--c-ink-soft);
  background: transparent;
  border-left: 0;
  border-right: 0;
  border-bottom: 0;
  cursor: pointer;
  transition: background .12s, color .12s;
  text-align: left;
}

.unassigned-row:hover {
  background: var(--c-bg-soft);
  color: var(--c-ink);
}

.unassigned-row.is-selected {
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
}

.unassigned-row.is-drop-ok {
  background: var(--c-accent-soft);
  box-shadow: inset 0 0 0 1px var(--c-accent);
  color: var(--c-accent-ink);
}
</style>
