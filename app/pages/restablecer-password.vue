<script setup lang="ts">
import { FetchError } from 'ofetch'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('auth.reset.page_title'),
  robots: 'noindex, nofollow'
})

const auth = useAuthStore()
const route = useRoute()

const token = computed(() => {
  const tk = route.query.token
  return typeof tk === 'string' ? tk : null
})

const newPassword = ref('')
const repeatPassword = ref('')
const loading = ref(false)
const errorMsg = ref<string | null>(null)

const passwordsMatch = computed(() => newPassword.value && newPassword.value === repeatPassword.value)
const strong = computed(() => scorePassword(newPassword.value) >= 2)
const canSubmit = computed(() => token.value && passwordsMatch.value && strong.value && !loading.value)

async function submit() {
  if (!canSubmit.value || !token.value) return
  loading.value = true
  errorMsg.value = null
  try {
    await auth.resetPassword({
      token: token.value,
      newPassword: newPassword.value,
      repeatPassword: repeatPassword.value
    })
    await navigateTo({ path: localePath('/login'), query: { reset: 'ok' } })
  } catch (e) {
    if (e instanceof FetchError && e.response?.status === 400) {
      errorMsg.value = t('auth.reset.errors.expired')
    } else {
      errorMsg.value = t('auth.reset.errors.generic')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthFormCard
    v-if="!token"
    :title="t('auth.reset.invalid_title')"
    :subtitle="t('auth.reset.invalid_subtitle')"
    :back="{ label: t('common.back'), to: localePath('/login') }"
  >
    <NuxtLink :to="localePath('/recuperar-password')" class="auth-cta-link">
      {{ t('auth.reset.request_new') }}
    </NuxtLink>
  </AuthFormCard>

  <AuthFormCard
    v-else
    :title="t('auth.reset.title')"
    :subtitle="t('auth.reset.subtitle')"
    :back="{ label: t('common.back'), to: localePath('/login') }"
  >
    <form class="flex flex-col gap-3.5" novalidate @submit.prevent="submit">
      <div
        v-if="errorMsg"
        role="alert"
        class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger"
      >
        {{ errorMsg }}
      </div>

      <AuthPasswordField
        id="new-password"
        v-model="newPassword"
        :label="t('auth.reset.new_password')"
        :placeholder="t('auth.reset.new_password_placeholder')"
        autocomplete="new-password"
        show-strength
        required
      />

      <AuthPasswordField
        id="repeat-password"
        v-model="repeatPassword"
        :label="t('auth.reset.repeat_password')"
        :placeholder="t('auth.reset.repeat_password_placeholder')"
        autocomplete="new-password"
        required
      />

      <p
        v-if="repeatPassword && !passwordsMatch"
        class="text-[12px] text-danger"
      >
        {{ t('auth.reset.mismatch') }}
      </p>

      <AuthSubmitButton :loading="loading" :disabled="!canSubmit">
        {{ t('auth.reset.submit') }}
      </AuthSubmitButton>
    </form>
  </AuthFormCard>
</template>

<style scoped>
.auth-cta-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  padding: 0 18px;
  border-radius: 10px;
  background: var(--c-ink);
  color: var(--c-bg-card);
  font-size: 14.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
  box-shadow: var(--shadow-sm);
  transition: background .15s, box-shadow .15s;
  margin-top: 4px;
}
.auth-cta-link:hover {
  background: color-mix(in oklab, var(--c-ink) 88%, #000);
  box-shadow: var(--shadow-md);
}
</style>
