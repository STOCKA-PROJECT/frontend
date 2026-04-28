<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl as string
const siteName = config.public.siteName as string

const title = computed(() => t('site.name'))
const description = computed(() => t('site.description'))
const canonical = computed(() => `${siteUrl}${localePath('/')}`.replace(/\/+$/, '') || siteUrl)

useSeoMeta({
  title,
  ogTitle: title,
  twitterTitle: title,
  description,
  ogDescription: description,
  twitterDescription: description,
  ogUrl: canonical,
  ogImage: () => `${siteUrl}/og-image.png`,
  twitterImage: () => `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
  ogLocale: () => {
    const l = locale.value as string
    return l === 'ca' ? 'ca_ES' : l === 'en' ? 'en_US' : 'es_ES'
  }
})

useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        'name': siteName,
        'applicationCategory': 'BusinessApplication',
        'operatingSystem': 'Web',
        'description': description.value,
        'inLanguage': locale.value,
        'url': canonical.value,
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'EUR'
        }
      })
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': siteName,
        'url': siteUrl,
        'logo': `${siteUrl}/favicon.ico`
      })
    }
  ]
}))
</script>

<template>
  <div>
    <HeroSection />
    <FeaturesSection />
    <HowSection />
    <TestimonialSection />
    <CtaSection />
  </div>
</template>
