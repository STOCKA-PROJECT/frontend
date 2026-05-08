<script setup lang="ts">
import type { LocationTreeNodeDto, PagePieceListItemDto, PieceListItemDto } from '~/types/api'

definePageMeta({ layout: 'dashboard' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('dashboard.page_title'),
  robots: 'noindex, nofollow'
})

const orgs = useOrganizationsStore()

if (orgs.list.length === 0) {
  await orgs.fetchList()
}
if (orgs.list.length === 0) {
  await navigateTo(localePath('/dashboard/crear-organizacion'))
}

const orgId = computed(() => orgs.currentId)

const api = useApi()

const { data: pieces, pending: piecesPending } = await useAsyncData<PagePieceListItemDto>(
  () => `pieces-${orgId.value}`,
  () => api(`/organizations/${orgId.value}/pieces`, {
    params: { page: 0, size: 5, sort: 'updatedAt,desc' }
  }),
  { watch: [orgId], default: () => emptyPage(), immediate: !!orgId.value }
)

const { data: pendingPage, pending: pendingPagePending } = await useAsyncData<PagePieceListItemDto>(
  () => `pieces-pending-${orgId.value}`,
  () => api(`/organizations/${orgId.value}/pieces`, {
    params: { page: 0, size: 1, status: 'PENDING' }
  }),
  { watch: [orgId], default: () => emptyPage(), immediate: !!orgId.value }
)

const { data: locationsTree, pending: locationsPending } = await useAsyncData<LocationTreeNodeDto[]>(
  () => `locations-tree-${orgId.value}`,
  () => api(`/organizations/${orgId.value}/locations/tree`),
  { watch: [orgId], default: () => [], immediate: !!orgId.value }
)

const numberLocale = computed(() => {
  const l = locale.value as string
  return l === 'ca' ? 'ca-ES' : l === 'en' ? 'en-US' : 'es-ES'
})

function formatNumber(n: number): string {
  return new Intl.NumberFormat(numberLocale.value).format(n)
}

function emptyPage(): PagePieceListItemDto {
  return {
    totalElements: 0,
    totalPages: 0,
    size: 0,
    content: [],
    number: 0,
    pageable: { offset: 0, paged: false, pageNumber: 0, pageSize: 0, sort: { empty: true, sorted: false, unsorted: true }, unpaged: true },
    sort: { empty: true, sorted: false, unsorted: true },
    numberOfElements: 0,
    first: true,
    last: true,
    empty: true
  }
}

function countNodes(nodes: LocationTreeNodeDto[]): number {
  let n = 0
  for (const node of nodes) {
    n += 1
    n += countNodes(node.children ?? [])
  }
  return n
}

function maxDepth(nodes: LocationTreeNodeDto[], current = 0): number {
  if (!nodes.length) return current
  return Math.max(...nodes.map(n => maxDepth(n.children ?? [], current + 1)))
}

const totalPieces = computed(() => pieces.value?.totalElements ?? 0)
const totalPending = computed(() => pendingPage.value?.totalElements ?? 0)
const totalLocations = computed(() => countNodes(locationsTree.value ?? []))
const rootLocations = computed(() => (locationsTree.value ?? []).length)
const depth = computed(() => maxDepth(locationsTree.value ?? []))

function pieceLink(piece: PieceListItemDto): string {
  return localePath(`/dashboard/articulos/${piece.id}`)
}
</script>

<template>
  <div class="flex flex-col gap-7 px-4 pb-10 pt-5 sm:px-5 sm:pb-16 sm:pt-7 lg:px-8">
    <DashboardPageHeader />

    <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      <DashboardStatCard
        :label="t('dashboard.stats.items')"
        :value="formatNumber(totalPieces)"
        icon-name="box"
        :loading="piecesPending"
      >
        <template #meta>
          <span>{{ t('dashboard.stats.items_meta') }}</span>
        </template>
      </DashboardStatCard>

      <DashboardStatCard
        :label="t('dashboard.stats.locations')"
        :value="formatNumber(totalLocations)"
        icon-name="building"
        :loading="locationsPending"
      >
        <template #meta>
          <span v-if="totalLocations > 0">
            {{ depth }} {{ depth === 1 ? t('dashboard.stats.level_one') : t('dashboard.stats.level_many') }} ·
            {{ rootLocations }} {{ rootLocations === 1 ? t('dashboard.stats.site_one') : t('dashboard.stats.site_many') }}
          </span>
          <span v-else>{{ t('dashboard.stats.locations_empty') }}</span>
        </template>
      </DashboardStatCard>

      <DashboardStatCard
        :label="t('dashboard.stats.pending')"
        :value="formatNumber(totalPending)"
        icon-name="clock"
        :loading="pendingPagePending"
      >
        <template #meta>
          <span v-if="totalPending > 0" class="font-medium text-warn">
            {{ t('dashboard.stats.pending_meta', { count: totalPending }) }}
          </span>
          <span v-else>{{ t('dashboard.stats.all_done') }}</span>
        </template>
      </DashboardStatCard>
    </div>

    <div class="grid grid-cols-1 items-start gap-4 sm:gap-5 xl:grid-cols-[1.6fr_1fr]">
      <DashboardCard
        :title="t('dashboard.cards.recent_items')"
        :pill="t('dashboard.cards.last_changes')"
      >
        <DashboardPiecesTable
          :pieces="pieces?.content ?? []"
          :loading="piecesPending"
          :link-to="pieceLink"
        />
      </DashboardCard>

      <div class="flex flex-col gap-5">
        <DashboardCard
          :title="t('dashboard.cards.locations')"
          :pill="totalLocations"
        >
          <DashboardLocationsTree :nodes="locationsTree ?? []" :loading="locationsPending" />
        </DashboardCard>

        <DashboardCard :title="t('dashboard.cards.recent_activity')">
          <DashboardActivityCard />
        </DashboardCard>
      </div>
    </div>
  </div>
</template>
