<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const localePath = useLocalePath()

const orgs = useOrganizationsStore()

if (orgs.list.length === 0) {
  await orgs.fetchList()
}
if (!orgs.current) {
  await navigateTo(localePath('/dashboard/crear-organizacion'))
}

useSeoMeta({
  title: () => t('dashboard.pieces.page_title'),
  robots: 'noindex, nofollow'
})

const orgId = computed(() => orgs.current?.id ?? null)
const role = computed(() => orgs.current?.currentUserRole ?? null)
</script>

<template>
  <div class="page flex flex-col gap-5 px-8 pb-8 pt-7 max-md:px-4">
    <div>
      <h1 class="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
        {{ t('dashboard.pieces.page_title') }}
      </h1>
      <p class="mt-1 max-w-[680px] text-[14px] leading-relaxed text-ink-soft">
        {{ t('dashboard.pieces.page_subtitle') }}
      </p>
    </div>

    <div class="board-host">
      <DashboardPiecesBoard v-if="orgId" :org-id="orgId" :role="role" />
    </div>
  </div>
</template>

<style scoped>
.page { min-height: calc(100vh - var(--topbar-h, 56px)); }
.board-host { flex: 1; min-height: 480px; display: flex; flex-direction: column; }
.board-host > * { flex: 1; min-height: 0; }
</style>
