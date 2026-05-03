<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('auth.verify.page_title'),
  robots: 'noindex, nofollow'
})

const auth = useAuthStore()
const route = useRoute()

const token = computed(() => {
  const tk = route.query.token
  return typeof tk === 'string' ? tk : null
})

type Status = 'pending' | 'success' | 'error' | 'no-token'
const status = ref<Status>(token.value ? 'pending' : 'no-token')

const resendEmail = ref('')
const resending = ref(false)
const resent = ref(false)
const resendErrorMsg = ref<string | null>(null)

const emailLooksValid = computed(() => /.+@.+\..+/.test(resendEmail.value.trim()))
const canResend = computed(() => emailLooksValid.value && !resending.value && !resent.value)

onMounted(async () => {
  if (!token.value) return
  try {
    await auth.verifyEmail({ token: token.value })
    status.value = 'success'
    await navigateTo({ path: localePath('/login'), query: { verified: 'ok' } })
  } catch {
    status.value = 'error'
  }
})

async function resend() {
  if (!canResend.value) return
  resending.value = true
  resendErrorMsg.value = null
  try {
    await auth.resendVerification({ email: resendEmail.value.trim() })
    resent.value = true
  } catch {
    resendErrorMsg.value = t('auth.verify.errors.generic')
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <AuthFormCard
    v-if="status === 'no-token'"
    :title="t('auth.verify.invalid_title')"
    :subtitle="t('auth.verify.invalid_subtitle')"
    :back="{ label: t('common.back'), to: localePath('/login') }"
  >
    <NuxtLink :to="localePath('/login')" class="auth-cta-link">
      {{ t('auth.verify.back_to_login') }}
    </NuxtLink>
  </AuthFormCard>

  <AuthFormCard
    v-else-if="status === 'pending' || status === 'success'"
    :title="t('auth.verify.title')"
    :subtitle="t('auth.verify.subtitle')"
  >
    <div class="flex justify-center py-4">
      <span
        class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink"
        aria-hidden="true"
      />
    </div>
  </AuthFormCard>

  <AuthFormCard
    v-else
    :title="t('auth.verify.invalid_title')"
    :subtitle="t('auth.verify.invalid_subtitle')"
    :back="{ label: t('common.back'), to: localePath('/login') }"
  >
    <div
      role="alert"
      class="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger"
    >
      {{ t('auth.verify.errors.expired') }}
    </div>

    <section class="mt-2 border-t border-line pt-5">
      <h2 class="text-[15px] font-medium text-ink">
        {{ t('auth.verify.resend_title') }}
      </h2>
      <p class="mt-1 mb-3 text-[13.5px] text-ink-soft">
        {{ t('auth.verify.resend_subtitle') }}
      </p>

      <form
        v-if="!resent"
        class="flex flex-col gap-3.5"
        novalidate
        @submit.prevent="resend"
      >
        <div
          v-if="resendErrorMsg"
          role="alert"
          class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger"
        >
          {{ resendErrorMsg }}
        </div>

        <AuthTextField
          id="resend-email"
          v-model="resendEmail"
          :label="t('auth.verify.resend_email_label')"
          type="email"
          :placeholder="t('auth.verify.resend_email_placeholder')"
          autocomplete="email"
          required
        />

        <AuthSubmitButton :loading="resending" :disabled="!canResend">
          {{ t('auth.verify.resend_submit') }}
        </AuthSubmitButton>
      </form>

      <div
        v-else
        role="status"
        class="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-[13px] text-accent-ink"
      >
        {{ t('auth.verify.resend_sent', { email: resendEmail }) }}
      </div>
    </section>
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
