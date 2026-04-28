<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'

const { t } = useI18n()
const head = useLocaleHead({
  dir: true,
  lang: true,
  seo: true
})
const getRouteBaseName = useRouteBaseName()

useHead(() => ({
  htmlAttrs: {
    lang: head.value.htmlAttrs?.lang,
    dir: head.value.htmlAttrs?.dir as 'ltr' | 'rtl' | 'auto' | undefined
  },
  link: head.value.link ?? [],
  meta: head.value.meta ?? []
}))

useSeoMeta({
  description: () => t('site.description'),
  ogDescription: () => t('site.description'),
  twitterDescription: () => t('site.description')
})

function pageKey(route: RouteLocationNormalizedLoaded): string {
  return getRouteBaseName(route) ?? route.path
}
</script>

<template>
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage :page-key="pageKey" />
  </NuxtLayout>
</template>
