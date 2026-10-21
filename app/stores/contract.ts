import { defineStore } from 'pinia'
import type { CatalogAction, CatalogKind, CatalogParam, OutputCatalog, OutputKind } from '~/types/contract'

/**
 * The output catalog (kinds, config schemas and actions), fetched once from the backend. Read-only:
 * the forms for piece types, ports and actions render their options from it.
 */
export const useContractStore = defineStore('contract', () => {
  const catalog = ref<OutputCatalog | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Kinds the forms do not offer: pieces with LEDs use a `led_strip` type and share the strip
   * port; the timeline editor derives each piece's segment from its length and order on the
   * strip, so nobody needs to create `led_segment` ports or types by hand.
   */
  const HIDDEN_KINDS: OutputKind[] = ['led_segment']

  const kinds = computed<OutputKind[]>(() =>
    catalog.value ? (Object.keys(catalog.value.kinds) as OutputKind[]).filter(k => !HIDDEN_KINDS.includes(k)) : [])

  /** Kinds a piece type can drive: every kind with show actions (a strip is a piece too; a sensor is not). */
  const pieceKinds = computed<OutputKind[]>(() =>
    kinds.value.filter(k => Object.keys(catalog.value!.kinds[k].actions).length > 0))

  async function load(): Promise<void> {
    if (catalog.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      const api = useApi()
      catalog.value = await api<OutputCatalog>('/contract/catalog')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'catalog'
      throw e
    } finally {
      loading.value = false
    }
  }

  function kind(k: OutputKind | null | undefined): CatalogKind | null {
    if (!k || !catalog.value) return null
    return catalog.value.kinds[k] ?? null
  }

  function actionsOf(k: OutputKind | null | undefined): string[] {
    return Object.keys(kind(k)?.actions ?? {})
  }

  function action(k: OutputKind | null | undefined, name: string): CatalogAction | null {
    return kind(k)?.actions[name] ?? null
  }

  function configFieldsOf(k: OutputKind | null | undefined): Array<{ key: string, spec: CatalogParam }> {
    return Object.entries(kind(k)?.config ?? {}).map(([key, spec]) => ({ key, spec }))
  }

  return { catalog, loading, error, kinds, pieceKinds, load, kind, actionsOf, action, configFieldsOf }
})
