<script setup lang="ts">
import type { LocationTreeNodeDto } from '~/types/api'

const props = defineProps<{
  nodes: LocationTreeNodeDto[]
  loading?: boolean
}>()

const { t } = useI18n()

const expanded = ref<Set<number>>(new Set())

watch(() => props.nodes, (nodes) => {
  if (nodes.length === 0) return
  if (expanded.value.size > 0) return
  for (const node of nodes) expanded.value.add(node.id)
}, { immediate: true })

function toggle(id: number) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
  expanded.value = new Set(expanded.value)
}

function subtreeCount(node: LocationTreeNodeDto): number {
  let n = 1
  for (const child of node.children ?? []) n += subtreeCount(child)
  return n
}
</script>

<template>
  <div class="px-2 pb-3 pt-1.5">
    <template v-if="loading">
      <div v-for="i in 4" :key="`s-${i}`" class="my-1 h-7 animate-pulse rounded bg-bg-soft" />
    </template>

    <div v-else-if="nodes.length === 0" class="px-3 py-8 text-center">
      <p class="text-[13px] text-ink-soft">
        {{ t('dashboard.locations_tree.empty') }}
      </p>
    </div>

    <DashboardLocationNode
      v-for="node in nodes"
      v-else
      :key="node.id"
      :node="node"
      :expanded="expanded"
      :subtree-count="subtreeCount"
      @toggle="toggle"
    />
  </div>
</template>
