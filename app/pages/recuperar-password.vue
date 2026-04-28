<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('auth.forgot.page_title'),
  robots: 'noindex, nofollow'
})

const auth = useAuthStore()

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const errorMsg = ref<string | null>(null)

const canSubmit = computed(() => email.value.trim() && !loading.value)

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  errorMsg.value = null
  try {
    await auth.forgotPassword({ email: email.value.trim() })
    sent.value = true
  } catch {
    errorMsg.value = t('auth.forgot.errors.generic')
  } finally {
    loading.value = false
  }
}

function retry() {
  sent.value = false
}
</script>

<template>
  <AuthFormCard
    v-if="!sent"
    :title="t('auth.forgot.title')"
    :subtitle="t('auth.forgot.subtitle')"
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

      <AuthTextField
        id="email-forgot"
        v-model="email"
        :label="t('auth.login.email')"
        type="email"
        :placeholder="t('auth.login.email_placeholder')"
        autocomplete="email"
        required
      />

      <AuthSubmitButton :loading="loading" :disabled="!canSubmit">
        {{ t('auth.forgot.submit') }}
      </AuthSubmitButton>
    </form>

    <template #foot>
      {{ t('auth.forgot.remember_q') }}
      <NuxtLink
        :to="localePath('/login')"
        class="font-medium text-ink border-b border-line-strong pb-px transition-colors hover:border-ink"
      >
        {{ t('auth.forgot.back_signin') }}
      </NuxtLink>
    </template>
  </AuthFormCard>

  <AuthFormCard
    v-else
    :title="t('auth.forgot.sent_title')"
  >
    <template #icon>
      <div class="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 12V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10" />
          <path d="m2 7 10 6 10-6" />
          <path d="m16 19 2 2 4-4" />
        </svg>
      </div>
    </template>
    <template #subtitle>
      <i18n-t keypath="auth.forgot.sent_subtitle" tag="span">
        <template #email>
          <strong class="font-medium text-ink">{{ email }}</strong>
        </template>
      </i18n-t>
    </template>

    <NuxtLink :to="localePath('/login')" class="auth-cta-link">
      {{ t('auth.forgot.sent_back') }}
    </NuxtLink>

    <template #foot>
      {{ t('auth.forgot.no_email') }}
      <button
        type="button"
        class="font-medium text-ink border-b border-line-strong pb-px transition-colors hover:border-ink"
        @click="retry"
      >
        {{ t('auth.forgot.retry') }}
      </button>
    </template>
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
  transition: background .15s, box-shadow .15s, transform .08s;
  margin-top: 4px;
}
.auth-cta-link:hover {
  background: color-mix(in oklab, var(--c-ink) 88%, #000);
  box-shadow: var(--shadow-md);
}
</style>
