<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { ContactResponseDto, LinkContactDto, MemberResponseDto, OrganizationRole } from '~/types/api'

const props = withDefaults(defineProps<{
  open: boolean
  loading?: boolean
  errorMsg?: string | null
  contact: ContactResponseDto | null
  members: MemberResponseDto[]
}>(), {
  loading: false,
  errorMsg: null
})

const emit = defineEmits<{
  submit: [payload: LinkContactDto]
  close: []
}>()

const { t } = useI18n()

// La migración de piezas exige que el miembro pueda ser propietario, así que
// los SPECTATOR quedan fuera del selector directamente.
const eligibleRoles: OrganizationRole[] = ['OWNER', 'MANAGER', 'USER']

const userId = ref<number | null>(null)
const migratePieces = ref(true)

watch(() => props.open, (open) => {
  if (open) {
    userId.value = null
    migratePieces.value = true
  }
})

const contactName = computed(() => {
  if (!props.contact) return ''
  return `${props.contact.name} ${props.contact.lastName ?? ''}`.trim()
})

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function submit() {
  if (userId.value == null || props.loading) return
  emit('submit', { userId: userId.value, migratePieces: migratePieces.value })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation"
      @click="onBackdropClick" @keydown="onKey">
      <div role="dialog" aria-modal="true" :aria-label="t('dashboard.contacts.link_dialog_title')"
        class="flex w-full max-w-[460px] max-h-[calc(100vh-24px)] flex-col rounded-[14px] border border-line bg-bg-card shadow-card">
        <header class="flex-shrink-0 border-b border-line px-5 py-4 sm:px-6">
          <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">
            {{ t('dashboard.contacts.link_dialog_title') }}
          </h2>
          <p class="mt-1 text-[12.5px] text-ink-muted">
            {{ t('dashboard.contacts.link_dialog_subtitle', { name: contactName }) }}
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
                <label for="link-member" class="field-label">
                  {{ t('dashboard.contacts.link_member_label') }}
                </label>
                <DashboardMemberSelect
                  input-id="link-member"
                  v-model="userId"
                  :members="members"
                  :eligible-roles="eligibleRoles"
                  :placeholder="t('dashboard.members.no_selection')"
                  :disabled="loading"
                />
              </div>

              <label class="migrate-row">
                <input v-model="migratePieces" type="checkbox" :disabled="loading">
                <span class="flex flex-col gap-0.5">
                  <span class="text-[13.5px] font-medium text-ink">
                    {{ t('dashboard.contacts.link_migrate_pieces') }}
                  </span>
                  <span class="text-[12px] leading-relaxed text-ink-muted">
                    {{ t('dashboard.contacts.link_migrate_help') }}
                  </span>
                </span>
              </label>
            </div>
          </div>

          <footer class="flex-shrink-0 border-t border-line px-5 py-4 sm:px-6">
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" class="dialog-btn" :disabled="loading" @click="emit('close')">
                {{ t('common.cancel') }}
              </button>
              <button type="submit" class="dialog-btn dialog-btn-primary"
                :disabled="userId == null || loading" :aria-busy="loading">
                {{ loading ? t('common.saving') : t('dashboard.contacts.link') }}
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
.field-label {
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: var(--c-ink-soft);
}
.migrate-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-soft);
  cursor: pointer;
}
.migrate-row input {
  margin-top: 3px;
  accent-color: var(--c-accent);
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
</style>
