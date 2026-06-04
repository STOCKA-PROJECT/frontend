import type { LocationDoc } from "../db/schemas";

/** A location tree node for the UI, identified by {@code syncId} (the offline-stable identity). */
export interface LocationTreeNode {
  syncId: string;
  name: string;
  description: string | null;
  parentSyncId: string | null;
  children: LocationTreeNode[];
}

/**
 * Builds the hierarchical location tree from the flat local documents, excluding tombstones
 * (a doc with {@code deletedAt}). Siblings are sorted by name (case-insensitive). Pure function so
 * it is trivially testable and reusable by the offline locations composable.
 *
 * @param docs flat local location documents
 * @returns the root-level tree nodes
 */
export function buildLocationTree(docs: LocationDoc[]): LocationTreeNode[] {
  const live = docs.filter((doc) => !doc.deletedAt);
  const byParent = new Map<string | null, LocationDoc[]>();
  for (const doc of live) {
    const parent = doc.parentSyncId ?? null;
    const siblings = byParent.get(parent) ?? [];
    siblings.push(doc);
    byParent.set(parent, siblings);
  }

  const build = (parentSyncId: string | null): LocationTreeNode[] =>
    (byParent.get(parentSyncId) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map((doc) => ({
        syncId: doc.syncId,
        name: doc.name,
        description: doc.description ?? null,
        parentSyncId: doc.parentSyncId ?? null,
        children: build(doc.syncId),
      }));

  return build(null);
}
