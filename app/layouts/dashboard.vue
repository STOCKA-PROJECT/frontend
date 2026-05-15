<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()
const orgs = useOrganizationsStore()

// useAsyncData wraps the fetch so a transient error (e.g. expired token →
// useApi redirects to /login) does not throw out of <Suspense> and leave
// the previous view stuck on screen with the new URL.
const { error } = await useAsyncData('layout-dashboard-orgs', async () => {
  if (auth.isAuthenticated && orgs.list.length === 0) {
    await orgs.fetchList()
  }
  return true
})

// If the fetch failed because useApi cleared the session (expired token),
// bounce to /login. The check in useApi only runs on the client; doing it
// here lets SSR redirect cleanly too.
if (error.value && !auth.isAuthenticated) {
  await navigateTo(localePath('/login'))
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
