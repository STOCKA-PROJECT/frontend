<script setup lang="ts">
import type { DragPayload } from '~/composables/useDnd'
import type { LocationTreeNodeDto } from '~/types/api'

const props = defineProps<{
  node: LocationTreeNodeDto
  selectedId: number | null
  expanded: Set<number>
  blockedIds: Set<number>
  canEditLocations: boolean
  canMovePieces: boolean
}>()

const emit = defineEmits<{
  toggle: [id: number]
  select: [id: number]
  'drop-location': [payload: { sourceId: number; targetId: number }]
  'drop-piece': [payload: { pieceId: number; targetLocationId: number }]
  'create-child': [parentId: number]
  rename: [id: number]
  delete: [id: number]
}>()

const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0)
const isOpen = computed(() => props.expanded.has(props.node.id))
const isSelected = computed(() => props.selectedId === props.node.id)
const isBlocked = computed(() => props.blockedIds.has(props.node.id))

const { onDragStart, onDragEnd, dragging } = useDragSource(
  () => ({ kind: 'location', id: props.node.id }),
  { disabled: () => !props.canEditLocations }
)

const drop = useDropTarget({
  accept: (p: DragPayload) => {
    if (p.kind === 'location') return props.canEditLocations
    if (p.kind === 'piece') return props.canMovePieces
    return false
  },
  canDrop: (p: DragPayload) => {
    if (p.kind === 'location') {
      if (p.id === props.node.id) return false
      return !props.blockedIds.has(props.node.id)
    }
    return true
  },
  onDrop: (p: DragPayload) => {
    if (p.kind === 'location') {
      emit('drop-location', { sourceId: p.id, targetId: props.node.id })
    } else if (p.kind === 'piece') {
      emit('drop-piece', { pieceId: p.id, targetLocationId: props.node.id })
    }
  }
})

const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

function onMenuClickOutside(e: MouseEvent) {
  if (!menuRef.value) return
  if (!menuRef.value.contains(e.target as Node)) menuOpen.value = false
}

watch(menuOpen, (open) => {
  if (open) {
    document.addEventListener('click', onMenuClickOutside)
  } else {
    document.removeEventListener('click', onMenuClickOutside)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onMenuClickOutside)
})

function onRowClick() {
  emit('select', props.node.id)
}

function onCaretClick(e: Event) {
  e.stopPropagation()
  if (hasChildren.value) emit('toggle', props.node.id)
}

function openMenu(e: Event) {
  e.stopPropagation()
  menuOpen.value = !menuOpen.value
}
</script>

<template>
  <div>
    <div
      class="tree-row"
      :class="{
        'is-collapsed': !isOpen,
        'no-caret': !hasChildren,
        'is-selected': isSelected,
        'is-dragging': dragging,
        'is-drop-ok': drop.isOver.value && !drop.isInvalid.value,
        'is-drop-bad': drop.isOver.value && drop.isInvalid.value,
        'is-blocked': isBlocked
      }"
      :draggable="canEditLocations ? true : false"
      role="treeitem"
      :aria-selected="isSelected"
      :aria-expanded="hasChildren ? isOpen : undefined"
      tabindex="0"
      @click="onRowClick"
      @keydown.enter.prevent="onRowClick"
      @keydown.space.prevent="onRowClick"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragenter="drop.onDragEnter"
      @dragover="drop.onDragOver"
      @dragleave="drop.onDragLeave"
      @drop="drop.onDrop"
    >
      <button type="button" class="caret-btn" :tabindex="-1" :aria-hidden="!hasChildren" @click="onCaretClick">
        <DashboardIcon v-if="hasChildren" name="caret" :size="10" />
      </button>
      <span class="ico"><DashboardIcon :name="hasChildren ? 'building' : 'cabinet'" :size="14" /></span>
      <span class="lbl">{{ node.name }}</span>

      <div v-if="canEditLocations" ref="menuRef" class="menu-wrap" @click.stop>
        <button type="button" class="menu-btn" :aria-expanded="menuOpen" :aria-haspopup="true"
          :title="$t('dashboard.locations.actions')" @click="openMenu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="5" cy="12" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
          </svg>
        </button>
        <div v-if="menuOpen" role="menu" class="menu">
          <button type="button" role="menuitem" class="menu-item"
            @click="menuOpen = false; emit('create-child', node.id)">
            <DashboardIcon name="plus" :size="12" />
            {{ $t('dashboard.locations.new_child') }}
          </button>
          <button type="button" role="menuitem" class="menu-item"
            @click="menuOpen = false; emit('rename', node.id)">
            {{ $t('dashboard.locations.rename') }}
          </button>
          <button type="button" role="menuitem" class="menu-item menu-item-danger"
            @click="menuOpen = false; emit('delete', node.id)">
            {{ $t('dashboard.locations.delete') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="isOpen && hasChildren" class="ml-3.5 border-l border-line pl-4">
      <DashboardLocationNodeEditable
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-id="selectedId"
        :expanded="expanded"
        :blocked-ids="blockedIds"
        :can-edit-locations="canEditLocations"
        :can-move-pieces="canMovePieces"
        @toggle="emit('toggle', $event)"
        @select="emit('select', $event)"
        @drop-location="emit('drop-location', $event)"
        @drop-piece="emit('drop-piece', $event)"
        @create-child="emit('create-child', $event)"
        @rename="emit('rename', $event)"
        @delete="emit('delete', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 6px;
  border-radius: 8px;
  font-size: 13.5px;
  cursor: pointer;
  color: var(--c-ink);
  transition: background .12s, border-color .12s, box-shadow .12s, opacity .12s;
  user-select: none;
  background: transparent;
  border: 1px solid transparent;
  text-align: left;
  outline: none;
}
.tree-row:hover { background: var(--c-bg-soft); }
.tree-row:focus-visible { box-shadow: 0 0 0 2px color-mix(in oklab, var(--c-accent) 35%, transparent); }
.tree-row.is-selected { background: var(--c-accent-soft); border-color: color-mix(in oklab, var(--c-accent) 30%, transparent); }
.tree-row.is-selected .ico { color: var(--c-accent-ink); }
.tree-row.is-dragging { opacity: .5; }
.tree-row.is-drop-ok { background: var(--c-accent-soft); border-color: var(--c-accent); }
.tree-row.is-drop-bad { background: var(--c-danger-soft); border-color: var(--c-danger); cursor: not-allowed; }
.tree-row.is-blocked { opacity: .55; }
.tree-row.no-caret .caret-btn { pointer-events: none; }

.caret-btn {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--c-ink-muted);
  border-radius: 4px;
  flex-shrink: 0;
  transition: transform .15s, background .12s;
}
.caret-btn:hover { background: var(--c-bg-soft); }
.tree-row.is-collapsed .caret-btn { transform: rotate(-90deg); }

.ico { color: var(--c-ink-soft); flex-shrink: 0; }
.lbl {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-wrap { position: relative; flex-shrink: 0; }
.menu-btn {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--c-ink-muted);
  border-radius: 5px;
  opacity: 0;
  transition: opacity .12s, background .12s, color .12s;
}
.tree-row:hover .menu-btn,
.tree-row.is-selected .menu-btn,
.menu-btn[aria-expanded="true"] { opacity: 1; }
.menu-btn:hover { background: var(--c-bg-soft); color: var(--c-ink); }

.menu {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  min-width: 180px;
  z-index: 30;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  border-radius: 9px;
  box-shadow: var(--shadow-md, 0 6px 20px rgba(0,0,0,.08));
  padding: 4px;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  border-radius: 6px;
  font-size: 13px;
  background: transparent;
  border: 0;
  color: var(--c-ink);
  text-align: left;
  cursor: pointer;
}
.menu-item:hover { background: var(--c-bg-soft); }
.menu-item-danger { color: var(--c-danger); }
.menu-item-danger:hover { background: var(--c-danger-soft); }
</style>
