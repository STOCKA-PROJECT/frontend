<script setup lang="ts">
const { t } = useI18n()
const auth = useAuthStore()
const orgs = useOrganizationsStore()
const localePath = useLocalePath()

const greeting = computed(() => {
  const name = auth.user?.name?.trim()
  return name ? t('dashboard.header.greeting_named', { name }) : t('dashboard.header.greeting_anonymous')
})

const canCreatePieces = computed(() => {
  const role = orgs.current?.currentUserRole
  return role === 'OWNER' || role === 'MANAGER' || role === 'USER'
})
</script>

<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
    <div class="min-w-0">
      <h1 class="text-[22px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[26px]">
        {{ greeting }}
      </h1>
      <p class="mt-1 text-[14px] leading-relaxed text-ink-soft">
        <template v-if="orgs.current">
          <i18n-t keypath="dashboard.header.context_named" tag="span">
            <template #org>
              <span class="font-medium text-ink">{{ orgs.current.name }}</span>
            </template>
          </i18n-t>
        </template>
        <template v-else>
          {{ t('dashboard.header.context_empty') }}
        </template>
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:flex-nowrap">
      <button class="header-btn header-btn-outline flex-1 sm:flex-none" disabled :title="t('common.comingSoon')">
        <DashboardIcon name="upload" :size="14" />
        {{ t('dashboard.header.import_csv') }}
      </button>
      <NuxtLink
        v-if="canCreatePieces"
        :to="localePath('/dashboard/articulos/nuevo')"
        class="header-btn header-btn-primary flex-1 sm:flex-none"
      >
        <DashboardIcon name="plus" :size="14" />
        {{ t('dashboard.header.new_item') }}
      </NuxtLink>
      <button
        v-else
        class="header-btn header-btn-primary flex-1 sm:flex-none"
        disabled
        :title="t('errors.auth.forbidden')"
      >
        <DashboardIcon name="plus" :size="14" />
        {{ t('dashboard.header.new_item') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.header-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 40px;
  padding: 0 16px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
  white-space: nowrap;
  border: 0;
  cursor: pointer;
  min-width: 0;
  transition: background .15s, box-shadow .15s, border-color .15s, opacity .15s;
}
.header-btn[disabled] {
  cursor: not-allowed;
  opacity: .65;
}
.header-btn-primary {
  background: var(--c-ink);
  color: var(--c-bg-card);
  box-shadow: var(--shadow-sm);
}
.header-btn-primary:hover:not([disabled]) {
  background: color-mix(in oklab, var(--c-ink) 88%, transparent);
}
.header-btn-outline {
  background: transparent;
  color: var(--c-ink);
  border: 1px solid var(--c-line-strong);
}
.header-btn-outline:hover:not([disabled]) {
  background: var(--c-bg-soft);
}
</style>
