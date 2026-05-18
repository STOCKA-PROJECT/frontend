<script setup lang="ts">
import { FetchError } from 'ofetch'
import type { AvailabilityResponse, UpdateOrganizationDto } from '~/types/api'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { orgPath } = useOrgPath()

const orgs = useOrganizationsStore()

// `resolve-org-slug.global.ts` already guarantees the org exists in the store
// and the user is a member.
const { slug: orgSlug, org } = useCurrentOrg()

const isOwner = computed(() => org.value?.currentUserRole === 'OWNER')

useSeoMeta({
  title: () => t('dashboard.org_settings.title'),
  robots: 'noindex, nofollow'
})

const initialName = computed(() => org.value?.name ?? '')
const initialSlug = computed(() => org.value?.slug ?? '')

const name = ref(initialName.value)
const slug = ref(initialSlug.value)
const slugTouched = ref(false)
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const successVisible = ref(false)

// Re-seed local form state when the active org changes (org switcher) or its
// slug rotates after a rename — the watcher key is the org id (stable across
// renames) so renames refresh form state once the response arrives.
watch(() => org.value?.id, () => {
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
  if (!canSubmit.value || !orgSlug.value) return
  loading.value = true
  errorMsg.value = null
  successVisible.value = false

  const payload: UpdateOrganizationDto = {}
  if (nameChanged.value) payload.name = name.value.trim()
  if (slugChanged.value) payload.slug = slug.value

  const previousSlug = orgSlug.value

  try {
    const updated = await orgs.update(previousSlug, payload)
    slugTouched.value = false
    successVisible.value = true
    // If the slug changed, the URL must follow or all subsequent requests
    // (and the resolve-org-slug middleware) will keep using the stale slug.
    if (updated.slug !== previousSlug) {
      await navigateTo(orgPath('/ajustes-organizacion', updated.slug), { replace: true })
    }
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
  <div class="flex flex-col gap-7 px-4 pb-10 pt-5 sm:px-5 sm:pb-16 sm:pt-7 lg:px-8">
    <div>
      <h1 class="text-[22px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[26px]">
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

    <DashboardOrgPieceAttributesPanel
      v-if="orgSlug"
      class="max-w-[760px]"
      :org-slug="orgSlug"
      :can-write="isOwner" />
  </div>
</template>
