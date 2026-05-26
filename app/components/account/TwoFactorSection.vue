<script setup lang="ts">
import QRCode from 'qrcode'

const { t } = useI18n()
const auth = useAuthStore()
const tfa = useTwoFactorStore()
const toast = useToastStore()
const apiError = useApiError()

type Stage = 'idle' | 'qr' | 'codes' | 'disabling'
const stage = ref<Stage>('idle')
const enrollmentCode = ref('')
const disablePassword = ref('')
const disableCode = ref('')
const errorMsg = ref<string | null>(null)
const qrDataUrl = ref<string | null>(null)

const enabled = computed(() => auth.user?.twoFactorEnabled === true)

async function startEnrollment() {
  errorMsg.value = null
  try {
    const data = await tfa.startSetup()
    qrDataUrl.value = await QRCode.toDataURL(data.otpAuthUri, { margin: 1, width: 220 })
    stage.value = 'qr'
  } catch (e) {
    const view = apiError(e)
    errorMsg.value = view.description
  }
}

async function confirmEnrollment() {
  errorMsg.value = null
  if (enrollmentCode.value.trim().length < 6) {
    errorMsg.value = t('dashboard.account.two_factor.errors.code_too_short')
    return
  }
  try {
    await tfa.confirmSetup(enrollmentCode.value.trim())
    stage.value = 'codes'
    enrollmentCode.value = ''
    toast.push({ type: 'success', description: t('dashboard.account.two_factor.enabled') })
  } catch (e) {
    const view = apiError(e)
    errorMsg.value = view.description
  }
}

function finishEnrollment() {
  stage.value = 'idle'
  tfa.resetWizard()
  qrDataUrl.value = null
}

async function regenerateCodes() {
  errorMsg.value = null
  try {
    await tfa.regenerateCodes()
    stage.value = 'codes'
  } catch (e) {
    const view = apiError(e)
    errorMsg.value = view.description
  }
}

function startDisable() {
  errorMsg.value = null
  disablePassword.value = ''
  disableCode.value = ''
  stage.value = 'disabling'
}

async function confirmDisable() {
  errorMsg.value = null
  try {
    await tfa.disable(disablePassword.value, disableCode.value.trim())
    stage.value = 'idle'
    toast.push({ type: 'success', description: t('dashboard.account.two_factor.disabled') })
  } catch (e) {
    const view = apiError(e)
    errorMsg.value = view.description
  }
}

function copyCodes() {
  if (!tfa.recoveryCodes) return
  const text = tfa.recoveryCodes.join('\n')
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(text)
    toast.push({ type: 'success', description: t('dashboard.account.two_factor.codes_copied') })
  }
}

function downloadCodes() {
  if (!tfa.recoveryCodes) return
  const blob = new Blob([tfa.recoveryCodes.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'stocka-recovery-codes.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {{ t('dashboard.account.two_factor.section_title') }}
        </h2>
        <p class="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
          {{ t('dashboard.account.two_factor.subtitle') }}
        </p>
      </div>
      <span :class="['inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-medium',
        enabled ? 'bg-success-soft text-success' : 'bg-bg-elevated text-ink-soft border border-line']">
        {{ enabled ? t('dashboard.account.two_factor.status_on') : t('dashboard.account.two_factor.status_off') }}
      </span>
    </div>

    <div v-if="errorMsg" role="alert"
      class="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <!-- Stage: idle, 2FA off -->
    <div v-if="stage === 'idle' && !enabled" class="mt-4">
      <button type="button" class="rounded-md bg-accent px-4 py-2 text-[13.5px] font-medium text-accent-ink hover:bg-accent/90 disabled:opacity-50"
        :disabled="tfa.loading" @click="startEnrollment">
        {{ t('dashboard.account.two_factor.activate') }}
      </button>
    </div>

    <!-- Stage: idle, 2FA on -->
    <div v-else-if="stage === 'idle' && enabled" class="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:bg-bg-elevated"
        :disabled="tfa.loading" @click="regenerateCodes">
        {{ t('dashboard.account.two_factor.regenerate_codes') }}
      </button>
      <button type="button" class="rounded-md border border-danger/40 px-3 py-1.5 text-[12.5px] font-medium text-danger hover:bg-danger-soft"
        :disabled="tfa.loading" @click="startDisable">
        {{ t('dashboard.account.two_factor.disable') }}
      </button>
    </div>

    <!-- Stage: QR + verify -->
    <div v-else-if="stage === 'qr'" class="mt-4 flex flex-col gap-3">
      <p class="text-[13px] text-ink-soft">{{ t('dashboard.account.two_factor.scan_instructions') }}</p>
      <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <img v-if="qrDataUrl" :src="qrDataUrl" :alt="t('dashboard.account.two_factor.qr_alt')"
          class="rounded-md border border-line bg-white p-2">
        <div class="flex flex-col gap-1">
          <span class="text-[12px] text-ink-muted">{{ t('dashboard.account.two_factor.manual_entry_label') }}</span>
          <code class="break-all rounded-md bg-bg-elevated px-2 py-1.5 text-[12px] text-ink">{{ tfa.setup?.secret }}</code>
        </div>
      </div>

      <form class="mt-2 flex flex-col gap-3" novalidate @submit.prevent="confirmEnrollment">
        <AuthTextField id="enroll-code" v-model="enrollmentCode"
          :label="t('dashboard.account.two_factor.code_label')"
          :placeholder="t('dashboard.account.two_factor.code_placeholder')"
          autocomplete="one-time-code" :maxlength="10" required />
        <div class="flex items-center gap-2">
          <button type="submit"
            class="rounded-md bg-accent px-4 py-2 text-[13.5px] font-medium text-accent-ink hover:bg-accent/90 disabled:opacity-50"
            :disabled="tfa.loading">
            {{ t('dashboard.account.two_factor.confirm') }}
          </button>
          <button type="button"
            class="rounded-md border border-line px-3 py-2 text-[13px] text-ink-soft hover:bg-bg-elevated"
            @click="finishEnrollment">
            {{ t('dashboard.account.two_factor.cancel') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Stage: recovery codes -->
    <div v-else-if="stage === 'codes'" class="mt-4 flex flex-col gap-3">
      <div class="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-[12.5px] text-ink">
        {{ t('dashboard.account.two_factor.codes_warning') }}
      </div>
      <ul class="grid grid-cols-2 gap-1.5 rounded-md bg-bg-elevated p-3 text-[13px] font-mono text-ink sm:grid-cols-3">
        <li v-for="code in tfa.recoveryCodes ?? []" :key="code">{{ code }}</li>
      </ul>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button"
          class="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-bg-elevated"
          @click="copyCodes">
          {{ t('dashboard.account.two_factor.copy') }}
        </button>
        <button type="button"
          class="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-bg-elevated"
          @click="downloadCodes">
          {{ t('dashboard.account.two_factor.download') }}
        </button>
        <button type="button"
          class="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-ink hover:bg-accent/90"
          @click="finishEnrollment">
          {{ t('dashboard.account.two_factor.done') }}
        </button>
      </div>
    </div>

    <!-- Stage: disabling -->
    <form v-else-if="stage === 'disabling'" class="mt-4 flex flex-col gap-3" novalidate @submit.prevent="confirmDisable">
      <p class="text-[13px] text-ink-soft">{{ t('dashboard.account.two_factor.disable_instructions') }}</p>
      <AuthPasswordField id="disable-password" v-model="disablePassword"
        :label="t('dashboard.account.two_factor.current_password')"
        autocomplete="current-password" required />
      <AuthTextField id="disable-code" v-model="disableCode"
        :label="t('dashboard.account.two_factor.code_label')"
        :placeholder="t('dashboard.account.two_factor.code_placeholder')"
        autocomplete="one-time-code" :maxlength="10" required />
      <div class="flex items-center gap-2">
        <button type="submit"
          class="rounded-md bg-danger px-4 py-2 text-[13.5px] font-medium text-white hover:bg-danger/90 disabled:opacity-50"
          :disabled="tfa.loading">
          {{ t('dashboard.account.two_factor.confirm_disable') }}
        </button>
        <button type="button"
          class="rounded-md border border-line px-3 py-2 text-[13px] text-ink-soft hover:bg-bg-elevated"
          @click="stage = 'idle'">
          {{ t('dashboard.account.two_factor.cancel') }}
        </button>
      </div>
    </form>
  </section>
</template>
