<script setup lang="ts">
import { onScopeDispose, ref } from "vue";

import { useOfflineLocations } from "~/composables/useOfflineLocations";
import { getStockaDb } from "~/composables/useStockaDb";
import type { LocationTreeNode } from "~/data/locationsTree";

// Standalone page: no dashboard shell / org dependency, so it renders and works fully offline
// (local RxDB only). Demonstrates the offline write loop end to end; sync layers on when online.
definePageMeta({ layout: false });

// Open the shared per-account database (here the offline-only "local" namespace).
const db = await getStockaDb();
const { tree, create, remove } = useOfflineLocations(db);

const newName = ref("");

async function add() {
  const name = newName.value.trim();
  if (!name) return;
  await create({ name });
  newName.value = "";
}

// Live count of changes queued for the next sync.
const pending = ref(0);
const pendingSub = db.outbox
  .find({ selector: { status: "pending" } })
  .$.subscribe((docs) => {
    pending.value = docs.length;
  });
onScopeDispose(() => pendingSub.unsubscribe());

// Flatten the tree into an indented list so we avoid a recursive component here.
interface Row {
  node: LocationTreeNode;
  depth: number;
}
function flatten(nodes: LocationTreeNode[], depth = 0, out: Row[] = []): Row[] {
  for (const node of nodes) {
    out.push({ node, depth });
    flatten(node.children, depth + 1, out);
  }
  return out;
}
const rows = computed(() => flatten(tree.value));
</script>

<template>
  <main class="mx-auto flex max-w-[640px] flex-col gap-4 p-6">
    <header>
      <h1 class="text-xl font-semibold">Ubicaciones (offline)</h1>
      <p class="text-sm text-ink-soft">
        Se crean y guardan localmente sin conexión.
        <strong>{{ pending }}</strong> cambio(s) pendiente(s) de sincronizar.
      </p>
    </header>

    <form class="flex gap-2" @submit.prevent="add">
      <input
        v-model="newName"
        type="text"
        placeholder="Nueva ubicación…"
        class="flex-1 rounded-lg border border-line px-3 py-2 text-sm"
      />
      <button type="submit" class="rounded-lg border border-line bg-bg-soft px-4 py-2 text-sm font-medium">
        Añadir
      </button>
    </form>

    <ul class="flex flex-col gap-1">
      <li
        v-for="row in rows"
        :key="row.node.syncId"
        class="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"
        :style="{ marginLeft: row.depth * 16 + 'px' }"
      >
        <span>{{ row.node.name }}</span>
        <button
          type="button"
          class="text-xs text-red-600 hover:underline"
          @click="remove(row.node.syncId)"
        >
          Borrar
        </button>
      </li>
      <li v-if="rows.length === 0" class="px-3 py-2 text-sm text-ink-soft">
        No hay ubicaciones todavía.
      </li>
    </ul>
  </main>
</template>
