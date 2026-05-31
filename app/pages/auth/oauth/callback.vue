<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const auth = useAuthStore()
const apiError = useApiError()

const status = ref<'loading' | 'error'>('loading')
const errorMsg = ref<string | null>(null)

useSeoMeta({
  title: () => t('auth.oauth.callback.page_title'),
  robots: 'noindex, nofollow'
})

interface CallbackResponse {
  user: import('~/types/api').User
  expiresIn: number
}

onMounted(async () => {
  const code = typeof route.query.code === 'string' ? route.query.code : ''
  const state = typeof route.query.state === 'string' ? route.query.state : ''
  if (!code || !state) {
    errorMsg.value = t('auth.oauth.callback.errors.invalid_redirect')
    status.value = 'error'
    return
  }
  try {
    const api = useApi()
    const data = await api<CallbackResponse>('/auth/oauth/google/callback', {
      method: 'POST',
      body: { code, state }
    })
    auth.setSession(data)
    await auth.routeAfterAuth()
  } catch (e) {
    const view = apiError(e)
    errorMsg.value = view.description
    status.value = 'error'
  }
})
</script>

<template>
  <AuthFormCard :title="t('auth.oauth.callback.title')" :subtitle="t('auth.oauth.callback.subtitle')">
    <div v-if="status === 'loading'" class="flex flex-col items-center gap-3 py-6">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
      <p class="text-[13px] text-ink-soft">{{ t('auth.oauth.callback.loading') }}</p>
    </div>
    <div v-else class="flex flex-col gap-3">
      <div role="alert" class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
        {{ errorMsg }}
      </div>
      <NuxtLink :to="localePath('/login')"
        class="self-start rounded-md border border-line px-3 py-1.5 text-[13px] text-ink-soft hover:bg-bg-elevated">
        {{ t('auth.oauth.callback.back_to_login') }}
      </NuxtLink>
    </div>
  </AuthFormCard>
</template>
