<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('auth.login.page_title'),
  robots: 'noindex, nofollow'
})

const auth = useAuthStore()
const route = useRoute()
const apiError = useApiError()

const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const errorCode = ref<string | null>(null)
const resendingVerification = ref(false)
const verificationResent = ref(false)

// 2FA challenge state
const mfaToken = ref<string | null>(null)
const totpCode = ref('')
const totpError = ref<string | null>(null)
const verifyingTotp = ref(false)

const successMsg = computed(() => {
  if (route.query.verified === 'ok') return t('auth.login.verified_ok')
  if (route.query.registered === 'ok') {
    const e = typeof route.query.email === 'string' ? route.query.email : ''
    return t('auth.login.registered_ok', { email: e })
  }
  if (route.query.reset === 'ok') return t('auth.login.reset_ok')
  return null
})

const showResendVerification = computed(() =>
  errorCode.value === 'auth.email_not_verified' && !!email.value.trim()
)

const canSubmit = computed(() => email.value.trim() && password.value && !loading.value)
const canSubmitTotp = computed(() => totpCode.value.replace(/\s+/g, '').length >= 6 && !verifyingTotp.value)

function safeNextPath(): string | null {
  const raw = route.query.next
  if (typeof raw !== 'string') return null
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null
  return decoded
}

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  errorMsg.value = null
  errorCode.value = null
  verificationResent.value = false
  try {
    const payload = {
      email: email.value.trim(),
      password: password.value,
      rememberMe: rememberMe.value
    }
    const next = safeNextPath()
    const challenge = next
      ? await auth.loginNoRedirect(payload)
      : await auth.login(payload)
    if (challenge) {
      mfaToken.value = challenge.mfaToken
    } else if (next) {
      await navigateTo(next)
    }
  } catch (e) {
    console.error('[login] error:', e)
    const view = apiError(e)
    errorMsg.value = view.description
    errorCode.value = view.code
  } finally {
    loading.value = false
  }
}

async function submitTotp() {
  if (!canSubmitTotp.value || !mfaToken.value) return
  verifyingTotp.value = true
  totpError.value = null
  try {
    await auth.submit2faChallenge(mfaToken.value, totpCode.value.trim(), rememberMe.value)
    const next = safeNextPath()
    if (next) {
      await navigateTo(next)
    } else {
      await auth.routeAfterAuth()
    }
  } catch (e) {
    const view = apiError(e)
    totpError.value = view.description
    if (view.code === 'auth.2fa_mfa_token_expired') {
      mfaToken.value = null
      errorMsg.value = view.description
    }
  } finally {
    verifyingTotp.value = false
  }
}

function cancelTotp() {
  mfaToken.value = null
  totpCode.value = ''
  totpError.value = null
}

async function resendVerification() {
  if (!email.value.trim() || resendingVerification.value) return
  resendingVerification.value = true
  try {
    await auth.resendVerification({ email: email.value.trim() })
    verificationResent.value = true
  } catch {
    // silent — anti-enumeration: backend always returns 204 anyway
  } finally {
    resendingVerification.value = false
  }
}
</script>

<template>
  <AuthFormCard :title="t('auth.login.title')" :subtitle="t('auth.login.subtitle')">
    <!-- Step 2: 2FA challenge -->
    <form v-if="mfaToken" class="flex flex-col gap-3.5" novalidate @submit.prevent="submitTotp">
      <div v-if="totpError" role="alert"
        class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
        {{ totpError }}
      </div>
      <p class="text-[13px] text-ink-soft">{{ t('auth.login.totp_prompt') }}</p>
      <AuthTextField id="totp" v-model="totpCode" :label="t('auth.login.totp_label')"
        :placeholder="t('auth.login.totp_placeholder')" autocomplete="one-time-code"
        :maxlength="10" required />
      <AuthSubmitButton :loading="verifyingTotp" :disabled="!canSubmitTotp">
        {{ t('auth.login.totp_submit') }}
      </AuthSubmitButton>
      <button type="button" class="self-center text-[12.5px] text-ink-muted underline-offset-2 hover:underline"
        @click="cancelTotp">
        {{ t('auth.login.totp_back') }}
      </button>
    </form>

    <!-- Step 1: email + password -->
    <form v-else class="flex flex-col gap-3.5" novalidate @submit.prevent="submit">
      <div v-if="successMsg" role="status"
        class="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-[13px] text-accent-ink">
        {{ successMsg }}
      </div>

      <AuthGoogleSignInButton />
      <div class="flex items-center gap-3">
        <hr class="flex-1 border-line">
        <span class="text-[11.5px] uppercase tracking-wider text-ink-muted">{{ t('auth.oauth.or_separator') }}</span>
        <hr class="flex-1 border-line">
      </div>

      <div v-if="errorMsg" role="alert"
        class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
        <p>{{ errorMsg }}</p>
        <button
          v-if="showResendVerification && !verificationResent"
          type="button"
          class="mt-1 inline-flex font-medium underline underline-offset-2 hover:opacity-80 disabled:opacity-60"
          :disabled="resendingVerification"
          @click="resendVerification"
        >
          {{ t('auth.login.resend_verification') }}
        </button>
        <p v-if="verificationResent" class="mt-1 text-accent-ink">
          {{ t('auth.login.resend_verification_sent') }}
        </p>
      </div>

      <AuthTextField id="email" v-model="email" :label="t('auth.login.email')" type="email"
        :placeholder="t('auth.login.email_placeholder')" autocomplete="email" required />

      <AuthPasswordField id="password" v-model="password" :label="t('auth.login.password')"
        :placeholder="t('auth.login.password_placeholder')" autocomplete="current-password" required>
        <template #right-link>
          <NuxtLink :to="localePath('/recuperar-password')" class="text-[12.5px] font-medium text-ink hover:underline">
            {{ t('auth.login.forgot') }}
          </NuxtLink>
        </template>
      </AuthPasswordField>

      <AuthCheckbox id="remember-me" v-model="rememberMe">
        {{ t('auth.login.remember_me') }}
      </AuthCheckbox>

      <AuthSubmitButton :loading="loading" :disabled="!canSubmit">
        {{ t('auth.login.submit') }}
      </AuthSubmitButton>
    </form>

    <template #foot>
      {{ t('auth.login.no_account') }}
      <NuxtLink :to="localePath('/registro')"
        class="font-medium text-ink border-b border-line-strong pb-px transition-colors hover:border-ink">
        {{ t('auth.login.create_free') }}
      </NuxtLink>
    </template>
  </AuthFormCard>
</template>
