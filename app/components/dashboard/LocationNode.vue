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

const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0)
const isOpen = computed(() => props.expanded.has(props.node.id))
</script>

<template>
  <div>
    <button
      type="button"
      class="tree-row"
      :class="{ 'is-collapsed': !isOpen, 'no-caret': !hasChildren }"
      @click="hasChildren && emit('toggle', node.id)"
    >
      <span class="caret" aria-hidden="true">
        <DashboardIcon v-if="hasChildren" name="caret" :size="10" />
      </span>
      <span class="ico"><DashboardIcon :name="hasChildren ? 'building' : 'cabinet'" :size="14" /></span>
      <span class="lbl">{{ node.name }}</span>
      <span class="ct">{{ subtreeCount(node) }}</span>
    </button>

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
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13.5px;
  cursor: pointer;
  color: var(--c-ink);
  transition: background .12s;
  user-select: none;
  background: transparent;
  border: 0;
  width: 100%;
  text-align: left;
}
.tree-row:hover { background: var(--c-bg-soft); }
.tree-row.no-caret { cursor: default; }
.tree-row .caret {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--c-ink-muted);
  transition: transform .15s;
  flex-shrink: 0;
}
.tree-row.is-collapsed .caret { transform: rotate(-90deg); }
.tree-row .ico { color: var(--c-ink-soft); flex-shrink: 0; }
.tree-row .lbl {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree-row .ct {
  font-size: 11.5px;
  color: var(--c-ink-muted);
  font-variant-numeric: tabular-nums;
}
</style>
