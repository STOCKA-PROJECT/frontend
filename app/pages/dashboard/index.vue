<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  // The `/dashboard` URL is a redirector: it does not render any UI. Decide where to send
  // the user inside a page-level middleware so the redirect happens before page setup
  // runs (this avoids the redirect firing inside <Suspense> and freezing the view).
  middleware: [
    async function dashboardRootRedirect() {
      const nuxtApp = useNuxtApp()
      const localePath = useLocalePath()
      const auth = useAuthStore()
      if (!auth.isAuthenticated) return

      const orgs = useOrganizationsStore()
      if (orgs.list.length === 0) {
        try {
          await orgs.fetchList()
        } catch {
          // useApi may have cleared the session; downstream guard handles it.
        }
      }
      if (!auth.isAuthenticated) {
        return nuxtApp.runWithContext(() => navigateTo(localePath('/login')))
      }

      if (orgs.list.length === 0) {
        return nuxtApp.runWithContext(() =>
          navigateTo(localePath('/dashboard/crear-organizacion'))
        )
      }

      const preferredSlug = orgs.lastSlug && orgs.findBySlug(orgs.lastSlug)
        ? orgs.lastSlug
        : orgs.list[0]!.slug

      return nuxtApp.runWithContext(() =>
        navigateTo(localePath(`/dashboard/${preferredSlug}`), { replace: true })
      )
    }
  ]
})
</script>

<template>
  <div />
</template>
