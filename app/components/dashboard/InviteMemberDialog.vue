<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import type { OrganizationRole } from '~/types/api'

const props = withDefaults(defineProps<{
  open: boolean
  loading?: boolean
  errorMsg?: string | null
  currentUserRole: OrganizationRole
}>(), {
  loading: false,
  errorMsg: null
})

const emit = defineEmits<{
  submit: [payload: { email: string; role: OrganizationRole }]
  close: []
}>()

const { t } = useI18n()

const email = ref('')
const role = ref<OrganizationRole>('USER')
const emailInput = ref<HTMLInputElement | null>(null)

const availableRoles = computed<OrganizationRole[]>(() => {
  if (props.currentUserRole === 'OWNER') {
    return ['OWNER', 'MANAGER', 'USER', 'SPECTATOR']
  }
  return ['USER', 'SPECTATOR']
})

watch(() => props.open, (open) => {
  if (open) {
    email.value = ''
    role.value = 'USER'
    nextTick(() => emailInput.value?.focus())
  }
})

onMounted(() => {
  if (props.open) nextTick(() => emailInput.value?.focus())
})

const emailLooksValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function submit() {
  const trimmed = email.value.trim()
  if (!trimmed || !emailLooksValid.value || props.loading) return
  emit('submit', { email: trimmed, role: role.value })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation"
      @click="onBackdropClick" @keydown="onKey">
      <div role="dialog" aria-modal="true" :aria-label="t('dashboard.team.invite_dialog_title')"
        class="flex w-[460px] max-h-[calc(100vh-24px)] max-w-[calc(100vw-24px)] flex-col rounded-[14px] border border-line bg-bg-card shadow-card">
        <header class="flex-shrink-0 border-b border-line px-5 py-4 sm:px-6">
          <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">
            {{ t('dashboard.team.invite_dialog_title') }}
          </h2>
          <p class="mt-1 text-[12.5px] text-ink-muted">
            {{ t('dashboard.team.invite_dialog_subtitle') }}
          </p>
        </header>

        <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="submit">
          <div class="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <div v-if="errorMsg" role="alert"
              class="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {{ errorMsg }}
            </div>

            <div class="flex flex-col gap-3.5">
              <div class="flex flex-col gap-1.5">
                <label for="invite-email" class="text-[12.5px] font-medium tracking-[-0.005em] text-ink-soft">
                  {{ t('dashboard.team.email_label') }}
                </label>
                <input id="invite-email" ref="emailInput" v-model="email" type="email" autocomplete="email"
                  required maxlength="255"
                  :placeholder="t('dashboard.team.email_placeholder')"
                  class="h-11 w-full rounded-[10px] border border-line bg-field px-3.5 text-[14.5px] text-ink outline-none transition-[border-color,background,box-shadow] duration-150 placeholder:text-ink-muted hover:border-line-strong focus:border-accent focus:bg-field-focus">
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="invite-role" class="text-[12.5px] font-medium tracking-[-0.005em] text-ink-soft">
                  {{ t('dashboard.team.role_label') }}
                </label>
                <DashboardRoleSelect id="invite-role" v-model="role" :available-roles="availableRoles" />
              </div>
            </div>
          </div>

          <footer class="flex-shrink-0 border-t border-line px-5 py-4 sm:px-6">
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" class="dialog-btn" :disabled="loading" @click="emit('close')">
                {{ t('dashboard.team.cancel') }}
              </button>
              <button type="submit" class="dialog-btn dialog-btn-primary"
                :disabled="!emailLooksValid || loading" :aria-busy="loading">
                {{ t('dashboard.team.send_invite') }}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--c-ink) 30%, transparent);
  backdrop-filter: blur(2px);
  padding: 12px;
}
.dialog-btn {
  height: 40px;
  padding: 0 16px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .15s, border-color .15s;
}
.dialog-btn:hover:not(:disabled) { background: var(--c-bg-soft); }
.dialog-btn:disabled { opacity: .5; cursor: not-allowed; }
.dialog-btn-primary {
  background: var(--c-ink);
  color: var(--c-bg-card);
  border-color: var(--c-ink);
}
.dialog-btn-primary:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-ink) 90%, transparent);
}
input:focus {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c-accent) 18%, transparent);
}
</style>
