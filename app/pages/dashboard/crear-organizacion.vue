<script setup lang="ts">
import { FetchError } from 'ofetch'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const localePath = useLocalePath()

const orgs = useOrganizationsStore()

const isFirstOrg = computed(() => orgs.list.length === 0)

const title = computed(() => isFirstOrg.value
  ? t('dashboard.create_org.first_title')
  : t('dashboard.create_org.title'))

const subtitle = computed(() => isFirstOrg.value
  ? t('dashboard.create_org.first_subtitle')
  : t('dashboard.create_org.subtitle'))

useSeoMeta({
  title: () => title.value,
  robots: 'noindex, nofollow'
})

const name = ref('')
const slug = ref('')
const slugTouched = ref(false)
const loading = ref(false)
const errorMsg = ref<string | null>(null)

watch(name, (newName) => {
  if (slugTouched.value) return
  slug.value = slugifyOrgName(newName)
})

function onSlugInput(value: string) {
  slugTouched.value = true
  slug.value = slugifyOrgName(value)
}

const slugFormatValid = (v: string) => /^[a-z0-9-]{3,40}$/.test(v)
const { status: slugStatus } = useAvailability(slug, {
  isFormatValid: slugFormatValid,
  fetcher: (v: string, signal: AbortSignal) => orgs.checkSlug(v, signal)
})

const canSubmit = computed(() => !!name.value.trim() && slugStatus.value === 'available' && !loading.value)

const slugHint = computed(() => {
  switch (slugStatus.value) {
    case 'available': return t('dashboard.create_org.slug_available')
    case 'checking':  return t('dashboard.create_org.slug_checking')
    case 'taken':     return t('dashboard.create_org.slug_taken')
    case 'reserved':  return t('dashboard.create_org.slug_reserved')
    case 'invalid':   return t('dashboard.create_org.slug_invalid')
    default:          return t('dashboard.create_org.slug_hint')
  }
})

const slugHintTone = computed<'ok' | 'danger' | 'muted'>(() => {
  switch (slugStatus.value) {
    case 'available': return 'ok'
    case 'taken':
    case 'reserved':
    case 'invalid':   return 'danger'
    default:          return 'muted'
  }
})

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  errorMsg.value = null
  try {
    await orgs.create({ name: name.value.trim(), slug: slug.value })
    await navigateTo(localePath('/dashboard'))
  } catch (e) {
    if (e instanceof FetchError && e.response?.status === 409) {
      errorMsg.value = t('dashboard.create_org.errors.conflict')
    } else {
      errorMsg.value = t('dashboard.create_org.errors.generic')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-7 px-8 pb-16 pt-7 max-md:px-4">
    <div>
      <h1 class="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
        {{ title }}
      </h1>
      <p class="mt-1 max-w-[640px] text-[14px] leading-relaxed text-ink-soft">
        {{ subtitle }}
      </p>
    </div>

    <div class="max-w-[520px] rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
      <form class="flex flex-col gap-3.5" novalidate @submit.prevent="submit">
        <div v-if="errorMsg" role="alert"
          class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {{ errorMsg }}
        </div>

        <AuthTextField id="org-name" v-model="name" :label="t('dashboard.create_org.name')"
          :placeholder="t('dashboard.create_org.name_placeholder')" autocomplete="organization" required />

        <AuthTextField id="org-slug" :model-value="slug" :label="t('dashboard.create_org.slug')"
          :placeholder="t('dashboard.create_org.slug_placeholder')" :spellcheck="false" prefix="stocka.es/"
          :hint="slugHint" :hint-tone="slugHintTone" @update:model-value="onSlugInput" />

        <AuthSubmitButton :loading="loading" :disabled="!canSubmit">
          {{ t('dashboard.create_org.submit') }}
        </AuthSubmitButton>

        <div v-if="!isFirstOrg" class="mt-1 text-center">
          <NuxtLink :to="localePath('/dashboard')"
            class="text-[13px] font-medium text-ink-soft transition-colors hover:text-ink">
            {{ t('dashboard.create_org.cancel') }}
          </NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>
