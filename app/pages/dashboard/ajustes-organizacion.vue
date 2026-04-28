<script setup lang="ts">
import { FetchError } from 'ofetch'
import type { AvailabilityResponse, UpdateOrganizationDto } from '~/types/api'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const localePath = useLocalePath()

const orgs = useOrganizationsStore()

if (orgs.list.length === 0) {
  await orgs.fetchList()
}
if (!orgs.current) {
  await navigateTo(localePath('/dashboard'))
}

const isOwner = computed(() => orgs.current?.currentUserRole === 'OWNER')

useSeoMeta({
  title: () => t('dashboard.org_settings.title'),
  robots: 'noindex, nofollow'
})

const initialName = computed(() => orgs.current?.name ?? '')
const initialSlug = computed(() => orgs.current?.slug ?? '')

const name = ref(initialName.value)
const slug = ref(initialSlug.value)
const slugTouched = ref(false)
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const successVisible = ref(false)

watch(() => orgs.current?.id, () => {
  name.value = initialName.value
  slug.value = initialSlug.value
  slugTouched.value = false
  errorMsg.value = null
  successVisible.value = false
})

const slugFormatValid = (v: string) => /^[a-z0-9-]{3,40}$/.test(v)

async function slugFetcher(v: string, signal: AbortSignal): Promise<AvailabilityResponse> {
  if (v === initialSlug.value) {
    return { available: true, reason: null }
  }
  return await orgs.checkSlug(v, signal)
}

const { status: slugStatus } = useAvailability(slug, {
  isFormatValid: slugFormatValid,
  fetcher: slugFetcher
})

const nameChanged = computed(() => name.value.trim() !== initialName.value.trim())
const slugChanged = computed(() => slug.value !== initialSlug.value)
const hasChanges = computed(() => nameChanged.value || slugChanged.value)

const canSubmit = computed(() => {
  if (!isOwner.value || loading.value) return false
  if (!name.value.trim()) return false
  if (!hasChanges.value) return false
  if (slugChanged.value && slugStatus.value !== 'available') return false
  return true
})

const slugHint = computed(() => {
  switch (slugStatus.value) {
    case 'available': return slugChanged.value
      ? t('dashboard.create_org.slug_available')
      : t('dashboard.org_settings.slug_current')
    case 'checking':  return t('dashboard.create_org.slug_checking')
    case 'taken':     return t('dashboard.create_org.slug_taken')
    case 'reserved':  return t('dashboard.create_org.slug_reserved')
    case 'invalid':   return t('dashboard.create_org.slug_invalid')
    default:          return t('dashboard.create_org.slug_hint')
  }
})

const slugHintTone = computed<'ok' | 'danger' | 'muted'>(() => {
  switch (slugStatus.value) {
    case 'available': return slugChanged.value ? 'ok' : 'muted'
    case 'taken':
    case 'reserved':
    case 'invalid':   return 'danger'
    default:          return 'muted'
  }
})

function onSlugInput(value: string) {
  slugTouched.value = true
  slug.value = slugifyOrgName(value)
}

async function submit() {
  if (!canSubmit.value || !orgs.current) return
  loading.value = true
  errorMsg.value = null
  successVisible.value = false

  const payload: UpdateOrganizationDto = {}
  if (nameChanged.value) payload.name = name.value.trim()
  if (slugChanged.value) payload.slug = slug.value

  try {
    await orgs.update(orgs.current.id, payload)
    slugTouched.value = false
    successVisible.value = true
  } catch (e) {
    if (e instanceof FetchError) {
      if (e.response?.status === 409) {
        errorMsg.value = t('dashboard.create_org.errors.conflict')
      } else if (e.response?.status === 403) {
        errorMsg.value = t('dashboard.org_settings.errors.forbidden')
      } else {
        errorMsg.value = t('dashboard.org_settings.errors.generic')
      }
    } else {
      errorMsg.value = t('dashboard.org_settings.errors.generic')
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
        {{ t('dashboard.org_settings.title') }}
      </h1>
      <p class="mt-1 max-w-[640px] text-[14px] leading-relaxed text-ink-soft">
        {{ t('dashboard.org_settings.subtitle') }}
      </p>
    </div>

    <div v-if="!isOwner" role="status"
      class="max-w-[520px] rounded-lg border border-line bg-bg-soft px-4 py-3 text-[13.5px] text-ink-soft">
      {{ t('dashboard.org_settings.not_owner') }}
    </div>

    <div class="max-w-[520px] rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
      <form class="flex flex-col gap-3.5" novalidate @submit.prevent="submit">
        <div v-if="errorMsg" role="alert"
          class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {{ errorMsg }}
        </div>

        <div v-if="successVisible" role="status"
          class="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-[13px] text-accent-ink">
          {{ t('dashboard.org_settings.saved') }}
        </div>

        <AuthTextField id="org-name" v-model="name"
          :label="t('dashboard.create_org.name')"
          :placeholder="t('dashboard.create_org.name_placeholder')"
          autocomplete="organization"
          :disabled="!isOwner"
          required />

        <AuthTextField id="org-slug" :model-value="slug"
          :label="t('dashboard.create_org.slug')"
          :placeholder="t('dashboard.create_org.slug_placeholder')"
          :spellcheck="false"
          prefix="stocka.es/"
          :disabled="!isOwner"
          :hint="slugHint"
          :hint-tone="slugHintTone"
          @update:model-value="onSlugInput" />

        <AuthSubmitButton :loading="loading" :disabled="!canSubmit">
          {{ t('dashboard.org_settings.save') }}
        </AuthSubmitButton>
      </form>
    </div>
  </div>
</template>
