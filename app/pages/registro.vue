<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('auth.signup.page_title'),
  robots: 'noindex, nofollow'
})

const auth = useAuthStore()
const apiError = useApiError()

const firstName = ref('')
const lastName = ref('')
const username = ref('')
const usernameTouched = ref(false)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const acceptTerms = ref(false)
const loading = ref(false)
const errorMsg = ref<string | null>(null)

const passwordsMatch = computed(() => !!password.value && password.value === confirmPassword.value)

watch([firstName, lastName], ([fn, ln]) => {
  if (usernameTouched.value) return
  username.value = slugify(fn) + (ln ? slugify(ln).slice(0, 1) : '')
})

function onUsernameInput(value: string) {
  usernameTouched.value = true
  username.value = slugify(value)
}

const usernameFormatValid = (v: string) => /^[a-z0-9]{3,24}$/.test(v)
const { status: usernameStatus } = useAvailability(username, {
  isFormatValid: usernameFormatValid,
  fetcher: (v: string, signal: AbortSignal) => auth.checkUsername(v, signal)
})

const passwordStrong = computed(() => scorePassword(password.value) >= 2)
const emailLooksValid = computed(() => /.+@.+\..+/.test(email.value.trim()))

const canSubmit = computed(() =>
  firstName.value.trim()
  && lastName.value.trim()
  && usernameStatus.value === 'available'
  && emailLooksValid.value
  && passwordStrong.value
  && passwordsMatch.value
  && acceptTerms.value
  && !loading.value
)

const usernameHint = computed(() => {
  switch (usernameStatus.value) {
    case 'available': return t('auth.signup.username_available', { username: username.value })
    case 'checking':  return t('auth.signup.username_checking')
    case 'taken':     return t('auth.signup.username_taken')
    case 'reserved':  return t('auth.signup.username_reserved')
    case 'invalid':   return t('auth.signup.username_invalid')
    default:          return t('auth.signup.username_hint')
  }
})

const usernameHintTone = computed<'ok' | 'danger' | 'muted'>(() => {
  switch (usernameStatus.value) {
    case 'available': return 'ok'
    case 'taken':
    case 'reserved':
    case 'invalid':   return 'danger'
    default:          return 'muted'
  }
})

const backendLanguage = computed(() => {
  const l = locale.value as string
  return l === 'ca' ? 'CA' : l === 'en' ? 'EN' : 'ES'
})

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  errorMsg.value = null
  try {
    await auth.signup({
      username: username.value,
      name: firstName.value.trim(),
      lastName: lastName.value.trim(),
      email: email.value.trim(),
      password: password.value,
      repeatPassword: confirmPassword.value,
      language: backendLanguage.value
    })
  } catch (e) {
    errorMsg.value = apiError(e).description
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthFormCard
    :title="t('auth.signup.title')"
    :subtitle="t('auth.signup.subtitle')"
  >
    <form class="flex flex-col gap-3.5" novalidate @submit.prevent="submit">
      <div
        v-if="errorMsg"
        role="alert"
        class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger"
      >
        {{ errorMsg }}
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AuthTextField
          id="firstName"
          v-model="firstName"
          :label="t('auth.signup.first_name')"
          :placeholder="t('auth.signup.first_name_placeholder')"
          autocomplete="given-name"
          required
        />
        <AuthTextField
          id="lastName"
          v-model="lastName"
          :label="t('auth.signup.last_name')"
          :placeholder="t('auth.signup.last_name_placeholder')"
          autocomplete="family-name"
          required
        />
      </div>

      <AuthTextField
        id="username"
        :model-value="username"
        :label="t('auth.signup.username')"
        :placeholder="t('auth.signup.username_placeholder')"
        autocomplete="username"
        prefix="@"
        :spellcheck="false"
        :maxlength="24"
        :hint="usernameHint"
        :hint-tone="usernameHintTone"
        @update:model-value="onUsernameInput"
      />

      <AuthTextField
        id="email-signup"
        v-model="email"
        :label="t('auth.signup.email')"
        type="email"
        :placeholder="t('auth.signup.email_placeholder')"
        autocomplete="email"
        required
      />

      <AuthPasswordField
        id="password-signup"
        v-model="password"
        :label="t('auth.signup.password')"
        :placeholder="t('auth.signup.password_placeholder')"
        autocomplete="new-password"
        show-strength
        required
      />

      <AuthPasswordField
        id="confirm-password-signup"
        v-model="confirmPassword"
        :label="t('auth.signup.confirm_password')"
        :placeholder="t('auth.signup.confirm_password_placeholder')"
        autocomplete="new-password"
        required
      />

      <p
        v-if="confirmPassword && !passwordsMatch"
        class="text-[12px] text-danger"
      >
        {{ t('auth.signup.passwords_mismatch') }}
      </p>

      <AuthCheckbox id="terms" v-model="acceptTerms">
        {{ t('auth.signup.accept_pre') }}
        <a href="#" class="text-ink border-b border-line-strong pb-px transition-colors hover:border-ink">{{ t('auth.signup.terms') }}</a>
        {{ t('auth.signup.accept_mid') }}
        <a href="#" class="text-ink border-b border-line-strong pb-px transition-colors hover:border-ink">{{ t('auth.signup.privacy') }}</a>
        {{ t('auth.signup.accept_post') }}
      </AuthCheckbox>

      <AuthSubmitButton :loading="loading" :disabled="!canSubmit">
        {{ t('auth.signup.submit') }}
      </AuthSubmitButton>
    </form>

    <template #foot>
      {{ t('auth.signup.have_account') }}
      <NuxtLink
        :to="localePath('/login')"
        class="font-medium text-ink border-b border-line-strong pb-px transition-colors hover:border-ink"
      >
        {{ t('auth.signup.signin') }}
      </NuxtLink>
    </template>
  </AuthFormCard>
</template>
