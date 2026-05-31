<script setup lang="ts">
const { t } = useI18n()
const loading = ref(false)
const error = ref<string | null>(null)

defineProps<{
  /** Optional label override, e.g. "Continuar con Google" vs "Registrarse con Google". */
  label?: string
}>()

interface AuthorizeResponse {
  authorizationUrl: string
}

async function start() {
  if (loading.value) return
  loading.value = true
  error.value = null
  try {
    const api = useApi()
    const data = await api<AuthorizeResponse>('/auth/oauth/google/authorize')
    if (typeof window !== 'undefined') {
      window.location.href = data.authorizationUrl
    }
  } catch {
    error.value = t('auth.oauth.errors.start_failed')
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <button type="button"
      class="inline-flex h-11 w-full items-center justify-center gap-3 rounded-[10px] border border-line bg-bg-card px-4 text-[14px] font-medium text-ink transition-colors hover:bg-bg-elevated disabled:opacity-60"
      :disabled="loading" @click="start">
      <!-- Inline Google G logo so we don't ship an extra asset. -->
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2a10.18 10.18 0 0 0-.16-1.84H9v3.48h4.84a4.13 4.13 0 0 1-1.79 2.7v2.26h2.9c1.7-1.56 2.69-3.86 2.69-6.6z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.27-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
      </svg>
      <span>{{ label ?? t('auth.oauth.continue_with_google') }}</span>
    </button>
    <span v-if="error" role="alert" class="text-[12px] text-danger">{{ error }}</span>
  </div>
</template>
