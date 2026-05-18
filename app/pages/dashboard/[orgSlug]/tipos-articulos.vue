<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

// `resolve-org-slug.global.ts` already guarantees the org exists in the store
// and the user is a member.
const { slug: orgSlug, org } = useCurrentOrg()

useSeoMeta({
  title: () => t('dashboard.pieceTypes.page_title'),
  robots: 'noindex, nofollow'
})

const role = computed(() => org.value?.currentUserRole ?? null)
</script>

<template>
  <div class="page flex flex-col gap-5 px-4 pb-8 pt-5 sm:px-5 sm:pt-7 lg:px-8">
    <div>
      <h1 class="text-[22px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[26px]">
        {{ t('dashboard.pieceTypes.page_title') }}
      </h1>
      <p class="mt-1 max-w-[680px] text-[14px] leading-relaxed text-ink-soft">
        {{ t('dashboard.pieceTypes.page_subtitle') }}
      </p>
    </div>

    <div class="board-host">
      <DashboardPieceTypesBoard v-if="orgSlug" :org-slug="orgSlug" :role="role" />
    </div>
  </div>
</template>

<style scoped>
.page { min-height: calc(100vh - var(--topbar-h, 60px)); }
.board-host { flex: 1; min-height: 480px; display: flex; flex-direction: column; }
.board-host > * { flex: 1; min-height: 0; }
</style>
