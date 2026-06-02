<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

const { t } = useI18n()
const localePath = useLocalePath()
const { orgPath } = useOrgPath()
const { slug: currentOrgSlug } = useCurrentOrg()
const auth = useAuthStore()
const orgs = useOrganizationsStore()
const team = useTeamStore()
const { isOpen, close } = useMobileNav()

const hasOrgs = computed(() => orgs.list.length >= 1)
// Pages under [orgSlug] require a slug in scope. When the user is on /dashboard/mi-cuenta
// or similar user-scoped pages, fall back to the last remembered slug so nav links stay live.
const navOrgSlug = computed(() => currentOrgSlug.value ?? orgs.lastSlug ?? orgs.list[0]?.slug ?? null)
const hasOrgScope = computed(() => navOrgSlug.value != null)

// The "Puertos" section is a private, org-gated feature: only show its nav link when the
// organization in scope has it enabled (its owner is a global admin).
const navOrg = computed(() => navOrgSlug.value
  ? (orgs.list.find(o => o.slug === navOrgSlug.value) ?? null)
  : null)
const portsEnabled = computed(() => navOrg.value?.portsEnabled === true)

const userInitials = computed(() => initials(auth.user?.name, auth.user?.lastName))
const userFullName = computed(() => {
  const u = auth.user
  if (!u) return ''
  return `${u.name} ${u.lastName}`.trim()
})

const pendingInvitationsCount = computed(() => team.myPendingInvitationsCount)
const hasPendingInvitations = computed(() => pendingInvitationsCount.value > 0)

const menuOpen = shallowRef(false)
const userMenuRef = ref<HTMLElement | null>(null)

const inactiveItems = computed(() => [] as Array<{ label: string; icon: string }>)

function onDocClick(e: MouseEvent) {
  if (!userMenuRef.value) return
  if (!userMenuRef.value.contains(e.target as Node)) menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  if (auth.isAuthenticated && !team.myInvitationsLoaded) {
    team.fetchMyInvitations({ includeHistory: true }).catch(() => { /* silent: dot stays hidden */ })
  }
  onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
})

async function handleLogout() {
  menuOpen.value = false
  close()
  await auth.logout()
}
</script>

<template>
  <!-- Desktop sidebar (lg+): fixed, always visible -->
  <aside
    class="dashboard-side sticky top-0 hidden h-screen flex-col gap-[18px] border-r border-line bg-bg-card px-3.5 py-4.5 lg:flex">
    <NuxtLink :to="localePath('/')"
      class="flex items-center gap-2.5 px-2 py-1.5 text-[15px] font-semibold tracking-[-0.015em] text-ink">
      <svg width="22" height="22" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="36" height="36" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.25" />
        <rect x="8" y="8" width="24" height="24" rx="4" stroke="currentColor" stroke-width="1.5" opacity="0.55" />
        <rect x="14" y="14" width="12" height="12" rx="2.5" fill="currentColor" />
      </svg>
      <span>Stocka</span>
    </NuxtLink>

    <DashboardOrgSwitcher v-if="hasOrgs" />
    <NuxtLink v-else :to="localePath('/dashboard/crear-organizacion')"
      class="flex items-center gap-2.5 rounded-[10px] border border-dashed border-line-strong bg-bg-soft px-3 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-[border-color,color,background] duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent-ink">
      <div
        class="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-ink-muted">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <span class="flex-1 leading-snug">{{ t('dashboard.org.start_first_cta') }}</span>
    </NuxtLink>

    <nav class="flex flex-col gap-px" :aria-label="t('common.main_nav')">
      <NuxtLink :to="orgPath('', navOrgSlug)" exact-active-class="is-active" class="nav-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>{{ t('dashboard.summary') }}</span>
      </NuxtLink>

      <NuxtLink v-if="hasOrgs" :to="orgPath('/articulos', navOrgSlug)" active-class="is-active" class="nav-item">
        <DashboardIcon name="box" />
        <span>{{ t('dashboard.nav.items') }}</span>
      </NuxtLink>

      <NuxtLink v-if="hasOrgs" :to="orgPath('/ubicaciones', navOrgSlug)" exact-active-class="is-active"
        class="nav-item">
        <DashboardIcon name="building" />
        <span>{{ t('dashboard.nav.locations') }}</span>
      </NuxtLink>

      <NuxtLink v-if="hasOrgs" :to="orgPath('/tipos-articulos', navOrgSlug)" exact-active-class="is-active"
        class="nav-item">
        <DashboardIcon name="list" />
        <span>{{ t('dashboard.nav.types') }}</span>
      </NuxtLink>

      <NuxtLink v-if="hasOrgs && portsEnabled" :to="orgPath('/puertos', navOrgSlug)" exact-active-class="is-active"
        class="nav-item">
        <DashboardIcon name="cpu" />
        <span>{{ t('dashboard.nav.ports') }}</span>
      </NuxtLink>

      <button v-for="item in inactiveItems" :key="item.label" type="button" class="nav-item is-disabled"
        :title="`${item.label} · ${t('common.comingSoon')}`" :aria-disabled="true" disabled>
        <DashboardIcon :name="item.icon" />
        <span>{{ item.label }}</span>
        <span class="ml-auto rounded-md bg-bg-soft px-1.5 py-px text-[11px] text-ink-muted">{{
          t('common.comingSoonShort') }}</span>
      </button>
    </nav>

    <div class="flex flex-col gap-px">
      <span class="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-muted">
        {{ t('dashboard.organization_label') }}
      </span>
      <NuxtLink v-if="hasOrgs" :to="orgPath('/equipo', navOrgSlug)" exact-active-class="is-active" class="nav-item">
        <DashboardIcon name="users" />
        <span>{{ t('dashboard.nav.team') }}</span>
      </NuxtLink>
      <NuxtLink v-if="hasOrgs" :to="orgPath('/ajustes-organizacion', navOrgSlug)" exact-active-class="is-active"
        class="nav-item">
        <DashboardIcon name="settings" />
        <span>{{ t('dashboard.nav.settings') }}</span>
      </NuxtLink>
    </div>

    <div ref="userMenuRef" class="relative mt-auto">
      <button type="button"
        class="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-bg-soft"
        :aria-expanded="menuOpen" aria-haspopup="menu" @click="menuOpen = !menuOpen">
        <div class="relative flex-shrink-0">
          <div
            class="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br from-[#c4b5a3] to-[#a89786] text-[12px] font-semibold text-white">
            {{ userInitials }}
          </div>
          <span
            v-if="hasPendingInvitations"
            class="notification-dot"
            :aria-label="t('dashboard.my_invitations.menu_pending_aria', pendingInvitationsCount, { named: { n: pendingInvitationsCount } })"
          />
        </div>
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-[13px] font-medium text-ink">{{ userFullName || t('common.user_fallback') }}</span>
          <span class="truncate text-[11.5px] text-ink-muted">{{ auth.user?.email }}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round" class="text-ink-muted" aria-hidden="true">
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>

      <div v-if="menuOpen" role="menu"
        class="absolute bottom-full left-0 right-0 z-30 mb-2 rounded-[10px] border border-line bg-bg-card p-1 shadow-card">
        <NuxtLink :to="localePath('/dashboard/mi-cuenta')" role="menuitem"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors hover:bg-bg-soft"
          @click="menuOpen = false">
          <DashboardIcon name="user" :size="14" />
          {{ t('dashboard.account.menu_entry') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/dashboard/invitaciones')" role="menuitem"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors hover:bg-bg-soft"
          @click="menuOpen = false">
          <DashboardIcon name="mail" :size="14" />
          <span>{{ t('dashboard.my_invitations.menu_entry') }}</span>
          <span v-if="hasPendingInvitations" class="ml-auto inline-flex items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-bg-card min-w-[18px] h-[18px]">
            {{ pendingInvitationsCount }}
          </span>
        </NuxtLink>
        <button type="button" role="menuitem"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors hover:bg-bg-soft"
          @click="handleLogout">
          <DashboardIcon name="log-out" :size="14" />
          {{ t('dashboard.logout') }}
        </button>
      </div>
    </div>
  </aside>

  <!-- Mobile drawer (<lg): teleported to body, slides in from left -->
  <Teleport to="body">
    <Transition name="backdrop">
      <div
        v-if="isOpen"
        class="mobile-nav-backdrop fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        aria-hidden="true"
        @click="close"
      />
    </Transition>
    <Transition name="drawer">
      <aside
        v-if="isOpen"
        class="mobile-nav-drawer fixed inset-y-0 left-0 z-50 flex w-[min(320px,85vw)] flex-col gap-[18px] overflow-y-auto border-r border-line bg-bg-card px-3.5 pt-[max(1.125rem,env(safe-area-inset-top))] pb-[max(1.125rem,env(safe-area-inset-bottom))] shadow-elevated lg:hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="t('common.main_nav')"
      >
        <div class="flex items-center justify-between">
          <NuxtLink
            :to="localePath('/')"
            class="flex items-center gap-2.5 px-2 py-1.5 text-[15px] font-semibold tracking-[-0.015em] text-ink"
            @click="close"
          >
            <svg width="22" height="22" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="36" height="36" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.25" />
              <rect x="8" y="8" width="24" height="24" rx="4" stroke="currentColor" stroke-width="1.5" opacity="0.55" />
              <rect x="14" y="14" width="12" height="12" rx="2.5" fill="currentColor" />
            </svg>
            <span>Stocka</span>
          </NuxtLink>
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-bg-card text-ink-soft transition-colors hover:bg-bg-soft"
            :aria-label="t('common.close_menu')"
            @click="close"
          >
            <DashboardIcon name="x" :size="18" />
          </button>
        </div>

        <DashboardOrgSwitcher v-if="hasOrgs" />
        <NuxtLink
          v-else
          :to="localePath('/dashboard/crear-organizacion')"
          class="flex items-center gap-2.5 rounded-[10px] border border-dashed border-line-strong bg-bg-soft px-3 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-[border-color,color,background] duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
          @click="close"
        >
          <div class="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-ink-muted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span class="flex-1 leading-snug">{{ t('dashboard.org.start_first_cta') }}</span>
        </NuxtLink>

        <nav class="flex flex-col gap-px" :aria-label="t('common.main_nav')">
          <NuxtLink :to="orgPath('', navOrgSlug)" exact-active-class="is-active" class="nav-item" @click="close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>{{ t('dashboard.summary') }}</span>
          </NuxtLink>

          <NuxtLink v-if="hasOrgs" :to="orgPath('/articulos', navOrgSlug)" active-class="is-active" class="nav-item" @click="close">
            <DashboardIcon name="box" />
            <span>{{ t('dashboard.nav.items') }}</span>
          </NuxtLink>

          <NuxtLink v-if="hasOrgs" :to="orgPath('/ubicaciones', navOrgSlug)" exact-active-class="is-active" class="nav-item" @click="close">
            <DashboardIcon name="building" />
            <span>{{ t('dashboard.nav.locations') }}</span>
          </NuxtLink>

          <NuxtLink v-if="hasOrgs" :to="orgPath('/tipos-articulos', navOrgSlug)" exact-active-class="is-active" class="nav-item" @click="close">
            <DashboardIcon name="list" />
            <span>{{ t('dashboard.nav.types') }}</span>
          </NuxtLink>

          <NuxtLink v-if="hasOrgs && portsEnabled" :to="orgPath('/puertos', navOrgSlug)" exact-active-class="is-active" class="nav-item" @click="close">
            <DashboardIcon name="cpu" />
            <span>{{ t('dashboard.nav.ports') }}</span>
          </NuxtLink>
        </nav>

        <div class="flex flex-col gap-px">
          <span class="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-muted">
            {{ t('dashboard.organization_label') }}
          </span>
          <NuxtLink v-if="hasOrgs" :to="orgPath('/equipo', navOrgSlug)" exact-active-class="is-active" class="nav-item" @click="close">
            <DashboardIcon name="users" />
            <span>{{ t('dashboard.nav.team') }}</span>
          </NuxtLink>
          <NuxtLink v-if="hasOrgs" :to="orgPath('/ajustes-organizacion', navOrgSlug)" exact-active-class="is-active" class="nav-item" @click="close">
            <DashboardIcon name="settings" />
            <span>{{ t('dashboard.nav.settings') }}</span>
          </NuxtLink>
        </div>

        <div class="mt-auto">
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left transition-colors hover:bg-bg-soft"
          >
            <div class="relative flex-shrink-0">
              <div class="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br from-[#c4b5a3] to-[#a89786] text-[12px] font-semibold text-white">
                {{ userInitials }}
              </div>
              <span
                v-if="hasPendingInvitations"
                class="notification-dot"
                :aria-label="t('dashboard.my_invitations.menu_pending_aria', pendingInvitationsCount, { named: { n: pendingInvitationsCount } })"
              />
            </div>
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[13px] font-medium text-ink">{{ userFullName || t('common.user_fallback') }}</span>
              <span class="truncate text-[11.5px] text-ink-muted">{{ auth.user?.email }}</span>
            </div>
          </button>
          <NuxtLink
            :to="localePath('/dashboard/mi-cuenta')"
            class="mt-1 flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2.5 text-left text-[13.5px] text-ink transition-colors hover:bg-bg-soft"
            @click="close"
          >
            <DashboardIcon name="user" :size="14" />
            {{ t('dashboard.account.menu_entry') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/dashboard/invitaciones')"
            class="mt-1 flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2.5 text-left text-[13.5px] text-ink transition-colors hover:bg-bg-soft"
            @click="close"
          >
            <DashboardIcon name="mail" :size="14" />
            <span>{{ t('dashboard.my_invitations.menu_entry') }}</span>
            <span v-if="hasPendingInvitations" class="ml-auto inline-flex items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-bg-card min-w-[18px] h-[18px]">
              {{ pendingInvitationsCount }}
            </span>
          </NuxtLink>
          <button
            type="button"
            class="mt-1 flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2.5 text-left text-[13.5px] text-ink transition-colors hover:bg-bg-soft"
            @click="handleLogout"
          >
            <DashboardIcon name="log-out" :size="14" />
            {{ t('dashboard.logout') }}
          </button>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13.5px;
  color: var(--c-ink-soft);
  background: transparent;
  border: 0;
  text-align: left;
  width: 100%;
  transition: background .12s, color .12s;
}

.nav-item:not(.is-active):not(.is-disabled):hover {
  background: color-mix(in oklab, var(--c-ink) 5%, transparent);
  color: var(--c-ink);
}

.nav-item :deep(svg) {
  color: var(--c-ink-muted);
  flex-shrink: 0;
}

.nav-item:not(.is-active):hover :deep(svg) {
  color: var(--c-ink-soft);
}

.nav-item.is-active {
  background: var(--c-ink);
  color: var(--c-bg-card);
}

.nav-item.is-active :deep(svg) {
  color: var(--c-bg-card);
}

.nav-item.is-disabled {
  cursor: not-allowed;
  opacity: .55;
}

.notification-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background: var(--c-danger);
  border: 2px solid var(--c-bg-card);
  pointer-events: none;
}

.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity .2s ease;
}
.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform .25s cubic-bezier(.2, .7, .2, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
}

@media (prefers-reduced-motion: reduce) {
  .backdrop-enter-active,
  .backdrop-leave-active,
  .drawer-enter-active,
  .drawer-leave-active {
    transition: none;
  }
}
</style>
