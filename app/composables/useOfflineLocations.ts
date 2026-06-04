import { onScopeDispose, ref, type Ref } from "vue";

import {
  createLocation,
  deleteLocation,
  updateLocation,
  type CreateLocationInput,
} from "../data/locationRepository";
import { buildLocationTree, type LocationTreeNode } from "../data/locationsTree";
import type { StockaDatabase } from "../db/database";

/** Reactive offline locations API for a screen: the tree comes from RxDB, writes go local + outbox. */
export interface OfflineLocations {
  /** The location tree, kept in sync with the local store (updates instantly on local writes). */
  tree: Ref<LocationTreeNode[]>;
  create(input: CreateLocationInput): Promise<void>;
  rename(syncId: string, name: string): Promise<void>;
  move(syncId: string, parentSyncId: string | null): Promise<void>;
  remove(syncId: string): Promise<void>;
}

/**
 * Offline-first locations for the UI: subscribes to the local RxDB {@code locations} collection and
 * exposes a reactive {@link LocationTreeNode} tree, plus create/rename/move/delete that write the
 * local store immediately (so the UI updates with no network) and enqueue a mutation for the next
 * push. This is what a desktop screen binds to instead of the API-backed store.
 *
 * @param db the local database (created post-login per account)
 * @returns the reactive tree and offline mutations
 */
export function useOfflineLocations(db: StockaDatabase): OfflineLocations {
  const tree = ref<LocationTreeNode[]>([]);

  const subscription = db.locations.find().$.subscribe((docs) => {
    tree.value = buildLocationTree(docs.map((doc) => doc.toJSON() as never));
  });
  onScopeDispose(() => subscription.unsubscribe());

  return {
    tree,
    async create(input) {
      await createLocation(db, input);
    },
    async rename(syncId, name) {
      await updateLocation(db, syncId, { name });
    },
    async move(syncId, parentSyncId) {
      await updateLocation(db, syncId, { parentSyncId });
    },
    async remove(syncId) {
      await deleteLocation(db, syncId);
    },
  };
}
