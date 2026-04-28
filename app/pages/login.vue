<script setup lang="ts">
import { FetchError } from 'ofetch'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('auth.login.page_title'),
  robots: 'noindex, nofollow'
})

const auth = useAuthStore()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const successMsg = computed(() => route.query.reset === 'ok' ? t('auth.login.reset_ok') : null)

const canSubmit = computed(() => email.value.trim() && password.value && !loading.value)

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  errorMsg.value = null
  try {
    await auth.login({ email: email.value.trim(), password: password.value })
  } catch (e) {
    if (e instanceof FetchError && e.response?.status === 401) {
      errorMsg.value = t('auth.login.errors.invalid')
    } else {
      errorMsg.value = t('auth.login.errors.generic')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthFormCard
    :title="t('auth.login.title')"
    :subtitle="t('auth.login.subtitle')"
  >
    <form class="flex flex-col gap-3.5" novalidate @submit.prevent="submit">
      <div
        v-if="successMsg"
        role="status"
        class="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-[13px] text-accent-ink"
      >
        {{ successMsg }}
      </div>

      <div
        v-if="errorMsg"
        role="alert"
        class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger"
      >
        {{ errorMsg }}
      </div>

      <AuthTextField
        id="email"
        v-model="email"
        :label="t('auth.login.email')"
        type="email"
        :placeholder="t('auth.login.email_placeholder')"
        autocomplete="email"
        required
      />

      <AuthPasswordField
        id="password"
        v-model="password"
        :label="t('auth.login.password')"
        :placeholder="t('auth.login.password_placeholder')"
        autocomplete="current-password"
        required
      >
        <template #right-link>
          <NuxtLink
            :to="localePath('/recuperar-password')"
            class="text-[12.5px] font-medium text-ink hover:underline"
          >
            {{ t('auth.login.forgot') }}
          </NuxtLink>
        </template>
      </AuthPasswordField>

      <AuthSubmitButton :loading="loading" :disabled="!canSubmit">
        {{ t('auth.login.submit') }}
      </AuthSubmitButton>
    </form>

    <template #foot>
      {{ t('auth.login.no_account') }}
      <NuxtLink
        :to="localePath('/registro')"
        class="font-medium text-ink border-b border-line-strong pb-px transition-colors hover:border-ink"
      >
        {{ t('auth.login.create_free') }}
      </NuxtLink>
    </template>
  </AuthFormCard>
</template>
