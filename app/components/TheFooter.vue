<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

interface FooterLink { labelKey: string; href: string; internal?: boolean }

const productLinks: FooterLink[] = [
  { labelKey: 'footer.links.features', href: '#features' },
  { labelKey: 'footer.links.integrations', href: '#integrations' },
  { labelKey: 'footer.links.changelog', href: '#changelog' }
]

const companyLinks: FooterLink[] = [
  { labelKey: 'footer.links.about', href: '#about' },
  { labelKey: 'footer.links.blog', href: '#blog' },
  { labelKey: 'footer.links.contact', href: '#contact' },
  { labelKey: 'footer.links.support', href: '#support' }
]

const accountLinks: FooterLink[] = [
  { labelKey: 'footer.links.signin', href: '/login', internal: true },
  { labelKey: 'footer.links.signup', href: '/registro', internal: true },
  { labelKey: 'footer.links.forgot', href: '/recuperar-password', internal: true }
]

const legalLinks: FooterLink[] = [
  { labelKey: 'footer.links.privacy', href: '#privacy' },
  { labelKey: 'footer.links.terms', href: '#terms' },
  { labelKey: 'footer.links.cookies', href: '#cookies' }
]

const groups = computed(() => [
  { title: t('footer.product'), links: productLinks },
  { title: t('footer.company'), links: companyLinks },
  { title: t('footer.account'), links: accountLinks }
])

const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-line py-12 pb-8 text-[13.5px] text-ink-soft">
    <div class="wrap">
      <div
        class="mb-10 grid gap-10 max-lg:grid-cols-2 max-sm:grid-cols-1
               lg:grid-cols-[1.5fr_1fr_1fr_1fr]"
      >
        <div class="max-lg:col-span-full">
          <BrandLogo :size="22" />
          <p class="mt-3 max-w-[320px] text-[13.5px] leading-relaxed text-ink-soft">
            {{ t('footer.tagline') }}
          </p>
          <div class="mt-5">
            <LanguageSwitcher align="left" />
          </div>
        </div>

        <div v-for="group in groups" :key="group.title">
          <h3 class="mb-3.5 text-xs font-semibold uppercase tracking-[.08em] text-ink">
            {{ group.title }}
          </h3>
          <ul class="flex flex-col gap-2.5">
            <li v-for="link in group.links" :key="link.labelKey">
              <NuxtLink
                v-if="link.internal"
                :to="localePath(link.href)"
                class="text-[13.5px] text-ink-soft transition-colors hover:text-ink"
              >
                {{ t(link.labelKey) }}
              </NuxtLink>
              <a
                v-else
                :href="link.href"
                class="text-[13.5px] text-ink-soft transition-colors hover:text-ink"
              >
                {{ t(link.labelKey) }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div
        class="flex items-center justify-between border-t border-line pt-6 text-[12.5px] text-ink-muted
               max-md:flex-col max-md:items-start max-md:gap-3.5"
      >
        <small>{{ t('footer.copyright', { year }) }}</small>
        <nav :aria-label="t('footer.legal')" class="flex gap-5 max-md:gap-4">
          <a
            v-for="link in legalLinks"
            :key="link.labelKey"
            :href="link.href"
            class="text-ink-muted transition-colors hover:text-ink-soft"
          >
            {{ t(link.labelKey) }}
          </a>
        </nav>
      </div>
    </div>
  </footer>
</template>
