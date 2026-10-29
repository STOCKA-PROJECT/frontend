<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()

/** Set by `resolve-org-slug.global.ts`: the link may belong to another account. */
interface ErrorData {
  switchAccount?: boolean
  next?: string
}
const data = computed(() => (props.error.data ?? {}) as ErrorData)

const isNotFound = computed(() => props.error.statusCode === 404)
const title = computed(() => isNotFound.value ? t('errors.page.not_found_title') : t('errors.page.generic_title'))
const message = computed(() => props.error.statusMessage
  || (isNotFound.value ? t('errors.page.not_found_message') : t('errors.page.generic_message')))
const canSwitchAccount = computed(() => data.value.switchAccount === true && auth.isAuthenticated)

useSeoMeta({ title: title.value, robots: 'noindex' })

const handleHome = () => clearError({ redirect: '/' })

// `clearError` is the only way out of the error page, so the redirect is built by hand.
async function switchAccount() {
  await auth.endSession()
  const { path, query } = withNext(localePath('/login'), data.value.next)
  clearError({ redirect: query.next ? `${path}?next=${encodeURIComponent(query.next)}` : path })
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg">
    <main class="wrap flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p class="mb-3 font-mono text-sm tracking-[.08em] text-accent-ink">
        ERROR · {{ error.statusCode }}
      </p>
      <h1 class="mb-4 font-semibold tracking-tighter2" style="font-size: clamp(32px, 4.5vw, 56px);">
        {{ title }}
      </h1>
      <p class="mb-8 max-w-[480px] text-base leading-relaxed text-ink-soft">
        {{ message }}
      </p>
      <div class="flex flex-wrap items-center justify-center gap-3">
        <button type="button" class="btn btn-primary btn-lg" @click="handleHome">
          {{ t('errors.page.home') }}
        </button>
        <button v-if="canSwitchAccount" type="button" class="btn btn-outline btn-lg" @click="switchAccount">
          {{ t('errors.page.switch_account') }}
        </button>
      </div>
    </main>
  </div>
</template>
