<script setup lang="ts">
import type { LocationTreeNodeDto } from '~/types/api'

const props = defineProps<{
  node: LocationTreeNodeDto
  expanded: Set<number>
  subtreeCount: (node: LocationTreeNodeDto) => number
}>()

const emit = defineEmits<{
  toggle: [id: number]
}>()

const { orgPath } = useOrgPath()

const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0)
const isOpen = computed(() => props.expanded.has(props.node.id))

const targetTo = computed(() => ({
  path: orgPath('/ubicaciones'),
  query: { location: String(props.node.id) }
}))

function onCaretClick(e: Event) {
  e.stopPropagation()
  e.preventDefault()
  if (hasChildren.value) emit('toggle', props.node.id)
}
</script>

<template>
  <div>
    <div class="tree-row" :class="{ 'is-collapsed': !isOpen, 'no-caret': !hasChildren }">
      <button
        type="button"
        class="caret-btn"
        :tabindex="hasChildren ? 0 : -1"
        :aria-hidden="!hasChildren"
        @click="onCaretClick"
      >
        <DashboardIcon v-if="hasChildren" name="caret" :size="10" />
      </button>

      <NuxtLink :to="targetTo" class="row-link">
        <span class="ico"><DashboardIcon :name="hasChildren ? 'building' : 'cabinet'" :size="14" /></span>
        <span class="lbl">{{ node.name }}</span>
        <span class="ct">{{ subtreeCount(node) }}</span>
      </NuxtLink>
    </div>

    <div v-if="isOpen && hasChildren" class="ml-3.5 border-l border-line pl-4">
      <DashboardLocationNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :expanded="expanded"
        :subtree-count="subtreeCount"
        @toggle="emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
  transition: background .12s;
  user-select: none;
}
.tree-row:hover { background: var(--c-bg-soft); }

.caret-btn {
  width: 18px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--c-ink-muted);
  border-radius: 4px;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform .15s, background .12s;
}
.caret-btn:hover { background: var(--c-bg-soft); }
.tree-row.is-collapsed .caret-btn { transform: rotate(-90deg); }
.tree-row.no-caret .caret-btn { pointer-events: none; cursor: default; }

.row-link {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 4px;
  border-radius: 8px;
  font-size: 13.5px;
  color: var(--c-ink);
  text-decoration: none;
  outline: none;
}
.row-link:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--c-accent) 35%, transparent);
}
.row-link .ico { color: var(--c-ink-soft); flex-shrink: 0; }
.row-link .lbl {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-link .ct {
  font-size: 11.5px;
  color: var(--c-ink-muted);
  font-variant-numeric: tabular-nums;
}
</style>
