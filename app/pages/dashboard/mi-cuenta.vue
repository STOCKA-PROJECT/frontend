<script setup lang="ts">
import type { ChangePasswordDto, Language, UpdateUserProfileDto } from '~/types/api'

definePageMeta({ layout: 'dashboard' })

const { t, locale, setLocale } = useI18n()
const auth = useAuthStore()
const toast = useToastStore()
const apiError = useApiError()

useSeoMeta({
  title: () => t('dashboard.account.title'),
  robots: 'noindex, nofollow'
})

// ----- profile state -----
const initialName = computed(() => auth.user?.name ?? '')
const initialLastName = computed(() => auth.user?.lastName ?? '')
const initialEmail = computed(() => auth.user?.email ?? '')
const initialLanguage = computed<Language>(() => auth.user?.language ?? 'ES')

const name = ref(initialName.value)
const lastName = ref(initialLastName.value)
const email = ref(initialEmail.value)
const language = ref<Language>(initialLanguage.value)
const profileLoading = ref(false)
const profileError = ref<string | null>(null)

watch(() => auth.user?.id, () => {
  name.value = initialName.value
  lastName.value = initialLastName.value
  email.value = initialEmail.value
  language.value = initialLanguage.value
})

const emailRegex = /.+@.+\..+/
const emailValid = computed(() => emailRegex.test(email.value))
const profileChanged = computed(() =>
  name.value.trim() !== initialName.value
  || lastName.value.trim() !== initialLastName.value
  || email.value.trim() !== initialEmail.value
  || language.value !== initialLanguage.value
)
const canSubmitProfile = computed(() =>
  !profileLoading.value
  && profileChanged.value
  && name.value.trim().length > 0
  && emailValid.value
)
const emailWillChange = computed(() => email.value.trim() !== initialEmail.value)

async function submitProfile() {
  if (!canSubmitProfile.value) return
  profileLoading.value = true
  profileError.value = null

  const payload: UpdateUserProfileDto = {}
  if (name.value.trim() !== initialName.value) payload.name = name.value.trim()
  if (lastName.value.trim() !== initialLastName.value) payload.lastName = lastName.value.trim()
  if (email.value.trim() !== initialEmail.value) payload.email = email.value.trim()
  if (language.value !== initialLanguage.value) payload.language = language.value

  try {
    const updated = await auth.updateProfile(payload)
    if (payload.language) {
      const target = payload.language.toLowerCase() as 'es' | 'ca' | 'en'
      if (locale.value !== target) await setLocale(target)
    }
    toast.push({ type: 'success', description: t('dashboard.account.profile.saved') })
    name.value = updated.name
    lastName.value = updated.lastName
    email.value = updated.email
    language.value = updated.language
  } catch (e) {
    const view = apiError(e)
    profileError.value = view.description || t('dashboard.account.profile.errors.generic')
  } finally {
    profileLoading.value = false
  }
}

// ----- change password state -----
const currentPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const passwordLoading = ref(false)
const passwordError = ref<string | null>(null)
const currentPasswordError = ref<string | null>(null)

const newPasswordScore = computed(() => scorePassword(newPassword.value))
const newPasswordLongEnough = computed(() => newPassword.value.length >= 8)
const passwordsMatch = computed(() =>
  repeatPassword.value.length === 0 || newPassword.value === repeatPassword.value
)
const newPasswordDifferent = computed(() =>
  newPassword.value.length === 0 || currentPassword.value.length === 0
  || newPassword.value !== currentPassword.value
)

const canSubmitPassword = computed(() =>
  !passwordLoading.value
  && currentPassword.value.length > 0
  && newPasswordLongEnough.value
  && newPasswordScore.value >= 1
  && newPassword.value === repeatPassword.value
  && newPassword.value !== currentPassword.value
)

const repeatPasswordHint = computed(() => {
  if (repeatPassword.value.length === 0) return ''
  if (newPassword.value !== repeatPassword.value) {
    return t('dashboard.account.change_password.errors.passwords_mismatch')
  }
  return ''
})
const repeatPasswordHintTone = computed<'danger' | 'muted'>(() =>
  repeatPasswordHint.value ? 'danger' : 'muted'
)
const newPasswordHint = computed(() => {
  if (newPassword.value.length === 0) return ''
  if (!newPasswordLongEnough.value) return t('dashboard.account.change_password.errors.too_short')
  return ''
})
const newPasswordHintTone = computed<'danger' | 'muted'>(() =>
  newPasswordHint.value ? 'danger' : 'muted'
)

watch(currentPassword, () => { currentPasswordError.value = null })

async function submitPassword() {
  if (!canSubmitPassword.value) return
  passwordLoading.value = true
  passwordError.value = null
  currentPasswordError.value = null

  const payload: ChangePasswordDto = {
    currentPassword: currentPassword.value,
    newPassword: newPassword.value,
    repeatPassword: repeatPassword.value
  }

  try {
    await auth.changePassword(payload)
    toast.push({ type: 'success', description: t('dashboard.account.change_password.success') })
    currentPassword.value = ''
    newPassword.value = ''
    repeatPassword.value = ''
  } catch (e) {
    const view = apiError(e)
    if (view.code === 'auth.current_password_invalid') {
      currentPasswordError.value = view.description
    } else {
      passwordError.value = view.description || t('dashboard.account.change_password.errors.generic')
    }
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-7 px-4 pb-10 pt-5 sm:px-5 sm:pb-16 sm:pt-7 lg:px-8">
    <div>
      <h1 class="text-[22px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[26px]">
        {{ t('dashboard.account.title') }}
      </h1>
      <p class="mt-1 max-w-[640px] text-[14px] leading-relaxed text-ink-soft">
        {{ t('dashboard.account.subtitle') }}
      </p>
    </div>

    <!-- Profile -->
    <section class="max-w-[520px] rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
      <h2 class="mb-4 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {{ t('dashboard.account.profile.section_title') }}
      </h2>
      <form class="flex flex-col gap-3.5" novalidate @submit.prevent="submitProfile">
        <div v-if="profileError" role="alert"
          class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {{ profileError }}
        </div>

        <AuthTextField id="account-name" v-model="name"
          :label="t('dashboard.account.profile.name')"
          :placeholder="t('dashboard.account.profile.name_placeholder')"
          autocomplete="given-name" required />

        <AuthTextField id="account-last-name" v-model="lastName"
          :label="t('dashboard.account.profile.last_name')"
          :placeholder="t('dashboard.account.profile.last_name_placeholder')"
          autocomplete="family-name" />

        <AuthTextField id="account-email" v-model="email"
          type="email"
          :label="t('dashboard.account.profile.email')"
          :placeholder="t('dashboard.account.profile.email_placeholder')"
          autocomplete="email"
          :hint="emailWillChange ? t('dashboard.account.profile.email_change_warning') : ''"
          hint-tone="muted"
          required />

        <div class="flex flex-col gap-1.5">
          <label for="account-language" class="text-[12.5px] font-medium tracking-[-0.005em] text-ink-soft">
            {{ t('dashboard.account.profile.language') }}
          </label>
          <select id="account-language" v-model="language"
            class="h-11 w-full rounded-[10px] border border-line bg-field px-3.5 text-[14.5px] text-ink outline-none transition-[border-color,background,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:bg-field-focus">
            <option value="ES">{{ t('dashboard.account.profile.language_options.ES') }}</option>
            <option value="CA">{{ t('dashboard.account.profile.language_options.CA') }}</option>
            <option value="EN">{{ t('dashboard.account.profile.language_options.EN') }}</option>
          </select>
        </div>

        <AuthSubmitButton :loading="profileLoading" :disabled="!canSubmitProfile">
          {{ t('dashboard.account.profile.submit') }}
        </AuthSubmitButton>
      </form>
    </section>

    <!-- Change password -->
    <section class="max-w-[520px] rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
      <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {{ t('dashboard.account.change_password.section_title') }}
      </h2>
      <p class="mb-4 mt-1 text-[12.5px] leading-relaxed text-ink-muted">
        {{ t('dashboard.account.change_password.subtitle') }}
      </p>
      <form class="flex flex-col gap-3.5" novalidate @submit.prevent="submitPassword">
        <div v-if="passwordError" role="alert"
          class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {{ passwordError }}
        </div>

        <AuthPasswordField id="current-password" v-model="currentPassword"
          :label="t('dashboard.account.change_password.current_password')"
          :placeholder="t('dashboard.account.change_password.current_password_placeholder')"
          autocomplete="current-password"
          required />
        <span v-if="currentPasswordError" class="-mt-2.5 text-[11.5px] text-danger" role="alert">
          {{ currentPasswordError }}
        </span>

        <div class="flex flex-col gap-1">
          <AuthPasswordField id="new-password" v-model="newPassword"
            :label="t('dashboard.account.change_password.new_password')"
            :placeholder="t('dashboard.account.change_password.new_password_placeholder')"
            autocomplete="new-password"
            :show-strength="true"
            required />
          <span v-if="newPasswordHint" class="text-[11.5px]"
            :class="{ 'text-danger': newPasswordHintTone === 'danger', 'text-ink-muted': newPasswordHintTone === 'muted' }">
            {{ newPasswordHint }}
          </span>
        </div>

        <div class="flex flex-col gap-1">
          <AuthPasswordField id="repeat-password" v-model="repeatPassword"
            :label="t('dashboard.account.change_password.repeat_password')"
            :placeholder="t('dashboard.account.change_password.repeat_password_placeholder')"
            autocomplete="new-password"
            required />
          <span v-if="repeatPasswordHint" class="text-[11.5px]"
            :class="{ 'text-danger': repeatPasswordHintTone === 'danger', 'text-ink-muted': repeatPasswordHintTone === 'muted' }">
            {{ repeatPasswordHint }}
          </span>
        </div>

        <AuthSubmitButton :loading="passwordLoading" :disabled="!canSubmitPassword">
          {{ t('dashboard.account.change_password.submit') }}
        </AuthSubmitButton>
      </form>
    </section>
  </div>
</template>
