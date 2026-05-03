<script setup lang="ts">
const { t } = useI18n()
const auth = useAuthStore()
const orgs = useOrganizationsStore()

if (auth.isAuthenticated && orgs.list.length === 0) {
  await orgs.fetchList()
}
</script>

<template>
  <div class="grid min-h-screen grid-cols-1 lg:grid-cols-[var(--sidebar-w)_1fr]">
    <a href="#dashboard-content" class="skip-link">{{ t('dashboard.skip') }}</a>
    <DashboardSidebar />
    <div class="flex min-w-0 flex-col">
      <DashboardTopbar />
      <main id="dashboard-content" class="min-w-0 flex-1">
        <slot />
      </main>
    </div>
  </div>
</template>
