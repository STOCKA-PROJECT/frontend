<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const auth = useAuthStore()

const isLogin = computed(() => {
  const last = route.path.split('/').pop()
  return last === 'login'
})

const year = new Date().getFullYear()
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a href="#auth-stage" class="skip-link">{{ t('common.skip_to_content') }}</a>

    <header class="flex items-center justify-between px-8 py-6 max-sm:px-5">
      <BrandLogo :size="22" />
      <div class="flex items-center gap-3 text-[13px] text-ink-soft max-sm:gap-2">
        <LanguageSwitcher variant="ghost" />
        <template v-if="auth.isAuthenticated">
          <NuxtLink
            :to="localePath('/dashboard')"
            class="font-medium text-ink border-b border-line-strong pb-px transition-colors hover:border-ink"
          >
            {{ t('nav.my_portal') }}
          </NuxtLink>
        </template>
        <template v-else-if="isLogin">
          <span class="max-sm:hidden">{{ t('auth.header.new_here') }}</span>
          <NuxtLink
            :to="localePath('/registro')"
            class="font-medium text-ink border-b border-line-strong pb-px transition-colors hover:border-ink"
          >
            {{ t('nav.signup') }}
          </NuxtLink>
        </template>
        <template v-else>
          <span class="max-sm:hidden">{{ t('auth.header.already_customer') }}</span>
          <NuxtLink
            :to="localePath('/login')"
            class="font-medium text-ink border-b border-line-strong pb-px transition-colors hover:border-ink"
          >
            {{ t('nav.signin') }}
          </NuxtLink>
        </template>
      </div>
    </header>

    <main id="auth-stage" class="flex flex-1 items-center justify-center px-6 pb-15 pt-5">
      <slot />
    </main>

    <footer class="text-center text-xs text-ink-muted px-6 py-6">
      {{ t('auth.footer_short', { year }) }} ·
      <a href="#" class="mx-2 text-ink-soft transition-colors hover:text-ink">{{ t('footer.links.privacy') }}</a>·
      <a href="#" class="mx-2 text-ink-soft transition-colors hover:text-ink">{{ t('footer.links.terms') }}</a>·
      <a href="#" class="mx-2 text-ink-soft transition-colors hover:text-ink">{{ t('footer.links.support') }}</a>
    </footer>
  </div>
</template>
