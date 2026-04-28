<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'

const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()

const portalHref = computed(() => auth.isAuthenticated
  ? localePath('/dashboard')
  : localePath('/login'))

const scrolled = useScrolled(6)
const menuOpen = shallowRef(false)
const route = useRoute()

const toggleMenu = () => { menuOpen.value = !menuOpen.value }
const closeMenu = () => { menuOpen.value = false }

watch(menuOpen, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
})

watch(() => route.fullPath, closeMenu)

onMounted(() => {
  const onResize = () => { if (window.innerWidth > 900) closeMenu() }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu() }
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKey)
  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKey)
    if (typeof document !== 'undefined') document.body.style.overflow = ''
  })
})

const navLinks = computed(() => [
  { label: t('nav.features'), href: '#features' },
  { label: t('nav.how'), href: '#how' }
])
</script>

<template>
  <header
    class="sticky top-0 z-50 border-b transition-colors duration-200"
    :class="scrolled ? 'border-line' : 'border-transparent'"
    style="background: color-mix(in oklab, var(--c-bg) 82%, transparent); backdrop-filter: blur(12px) saturate(140%); -webkit-backdrop-filter: blur(12px) saturate(140%);"
  >
    <div class="wrap flex h-[var(--nav-h)] items-center justify-between">
      <BrandLogo :size="24" />

      <nav
        class="hidden items-center gap-1 lg:flex"
        :aria-label="t('common.main_nav')"
      >
        <a
          v-for="link in navLinks"
          :key="link.href"
          :href="link.href"
          class="rounded-lg px-3.5 py-2 text-sm text-ink-soft transition-colors duration-150
                 hover:bg-ink/5 hover:text-ink"
        >
          {{ link.label }}
        </a>
      </nav>

      <div class="flex items-center gap-2">
        <LanguageSwitcher class="hidden lg:inline-flex" variant="ghost" />
        <NuxtLink class="btn btn-primary hidden lg:inline-flex" :to="portalHref">{{ t('nav.my_portal') }}</NuxtLink>
        <LanguageSwitcher class="lg:hidden" variant="ghost" />
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-transparent text-ink
                 transition-colors hover:bg-ink/[.06] lg:hidden"
          :aria-label="menuOpen ? t('common.close_menu') : t('common.open_menu')"
          :aria-expanded="menuOpen"
          aria-controls="mobile-menu"
          @click="toggleMenu"
        >
          <svg
            v-if="!menuOpen"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
          ><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          <svg
            v-else
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
          ><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </div>
  </header>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-200 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="menuOpen"
        class="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm lg:hidden"
        aria-hidden="true"
        @click="closeMenu"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)]"
      leave-active-class="transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)]"
      enter-from-class="translate-x-full"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="menuOpen"
        id="mobile-menu"
        class="fixed inset-y-0 right-0 z-[70] flex w-[min(420px,88vw)] flex-col overflow-y-auto
               border-l border-line bg-bg-card pl-6 pr-[max(1.5rem,env(safe-area-inset-right))]
               pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-elevated lg:hidden"
        :style="{ paddingTop: 'calc(var(--nav-h) + 12px)' }"
        role="dialog"
        aria-modal="true"
        :aria-label="t('common.main_nav')"
      >
        <nav class="flex flex-col" :aria-label="t('common.main_nav')">
          <a
            v-for="(link, i) in navLinks"
            :key="link.href"
            :href="link.href"
            class="block border-b border-line py-4 text-[17px] font-medium text-ink transition-colors hover:text-accent-ink"
            :class="i === 0 ? 'border-t' : ''"
            @click="closeMenu"
          >
            {{ link.label }}
          </a>
        </nav>
        <div class="mt-6 flex flex-col gap-2.5">
          <NuxtLink class="btn btn-primary btn-lg" :to="portalHref" @click="closeMenu">{{ t('nav.my_portal') }}</NuxtLink>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
