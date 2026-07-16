<script setup lang="ts">
import { computed } from 'vue'
import type { ContactResponseDto, MemberResponseDto, OrganizationRole } from '~/types/api'

const props = defineProps<{
  contacts: ContactResponseDto[]
  members: MemberResponseDto[]
  loading?: boolean
  currentUserRole: OrganizationRole
}>()

const emit = defineEmits<{
  add: []
  edit: [contact: ContactResponseDto]
  link: [contact: ContactResponseDto]
  unlink: [contact: ContactResponseDto]
  remove: [contact: ContactResponseDto]
}>()

const { t } = useI18n()

// Cualquier rol con escritura puede añadir (igual que crear un artículo);
// editar/vincular/borrar es gestión del directorio: OWNER o MANAGER.
const canAdd = computed(() => props.currentUserRole !== 'SPECTATOR')
const canManage = computed(
  () => props.currentUserRole === 'OWNER' || props.currentUserRole === 'MANAGER'
)

function initials(c: ContactResponseDto): string {
  const a = (c.name || '').trim().charAt(0)
  const b = (c.lastName || '').trim().charAt(0)
  const out = (a + b).toUpperCase()
  return out || (c.email?.charAt(0).toUpperCase() ?? '?')
}

function linkedMember(c: ContactResponseDto): MemberResponseDto | undefined {
  if (c.linkedUserId == null) return undefined
  return props.members.find(m => m.userId === c.linkedUserId)
}
</script>

<template>
  <section class="rounded-[14px] border border-line bg-bg-card shadow-card">
    <header class="flex items-center justify-between px-5 pb-3 pt-5 sm:px-6">
      <div>
        <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {{ t('dashboard.contacts.title') }}
        </h2>
        <p class="mt-0.5 text-[12px] text-ink-muted">
          {{ t('dashboard.contacts.subtitle') }}
        </p>
      </div>
      <button v-if="canAdd" type="button" class="add-btn" @click="emit('add')">
        {{ t('dashboard.contacts.add') }}
      </button>
    </header>

    <div v-if="loading && contacts.length === 0" class="px-5 pb-6 pt-2 text-[13px] text-ink-muted sm:px-6">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="contacts.length === 0" class="px-5 pb-6 pt-2 text-[13px] text-ink-muted sm:px-6">
      {{ t('dashboard.contacts.empty') }}
    </div>

    <ul v-else class="divide-y divide-line border-t border-line">
      <li v-for="c in contacts" :key="c.id"
        class="flex flex-col gap-2.5 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-3.5 sm:px-6">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div class="avatar">{{ initials(c) }}</div>
          <div class="flex min-w-0 flex-1 flex-col">
            <div class="flex items-center gap-2 text-[13.5px] font-medium tracking-[-0.005em] text-ink">
              <span class="truncate">{{ c.name }} {{ c.lastName ?? '' }}</span>
              <span v-if="linkedMember(c)" class="linked-chip" :title="t('dashboard.contacts.linked_to', {
                name: `${linkedMember(c)!.name} ${linkedMember(c)!.lastName}`.trim()
              })">
                <DashboardIcon name="check" :size="11" />
                {{ t('dashboard.contacts.linked') }}
              </span>
            </div>
            <span class="truncate text-[12px] text-ink-muted">
              {{ [c.email, c.phone].filter(Boolean).join(' · ') || '—' }}
            </span>
          </div>
        </div>

        <div v-if="canManage" class="flex items-center justify-end gap-1.5">
          <button
            type="button"
            class="action-btn"
            :title="t('dashboard.contacts.edit')"
            :aria-label="t('dashboard.contacts.edit')"
            @click="emit('edit', c)"
          >
            <DashboardIcon name="edit" :size="14" />
          </button>
          <button
            v-if="c.linkedUserId == null"
            type="button"
            class="action-btn"
            :title="t('dashboard.contacts.link')"
            :aria-label="t('dashboard.contacts.link')"
            @click="emit('link', c)"
          >
            <DashboardIcon name="user" :size="14" />
          </button>
          <button
            v-else
            type="button"
            class="action-btn"
            :title="t('dashboard.contacts.unlink')"
            :aria-label="t('dashboard.contacts.unlink')"
            @click="emit('unlink', c)"
          >
            <DashboardIcon name="x" :size="14" />
          </button>
          <button
            type="button"
            class="action-btn action-btn-danger"
            :title="t('dashboard.contacts.delete')"
            :aria-label="t('dashboard.contacts.delete')"
            @click="emit('remove', c)"
          >
            <DashboardIcon name="trash" :size="14" />
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.avatar {
  display: flex;
  height: 36px;
  width: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px dashed var(--c-line-strong);
  background: var(--c-bg-soft);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--c-ink-soft);
}
.linked-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border-radius: 6px;
  border: 1px solid var(--c-line);
  background: var(--c-accent-soft);
  padding: 1px 6px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--c-accent-ink);
}
.add-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .15s;
}
.add-btn:hover { background: var(--c-bg-soft); }
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink-soft);
  transition: background .15s, border-color .15s, color .15s;
}
@media (min-width: 640px) {
  .action-btn {
    width: 30px;
    height: 30px;
  }
}
.action-btn:hover {
  background: var(--c-bg-soft);
  border-color: var(--c-line-strong);
  color: var(--c-ink);
}
.action-btn-danger:hover {
  background: var(--c-danger-soft);
  border-color: color-mix(in oklab, var(--c-danger) 35%, var(--c-line));
  color: var(--c-danger);
}
</style>
