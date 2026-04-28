<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import type { OrganizationRole } from '~/types/api'

const { t } = useI18n()
const localePath = useLocalePath()
const router = useRouter()
const orgs = useOrganizationsStore()
const locations = useLocationsStore()
const pieces = usePiecesStore()

const open = shallowRef(false)
const rootRef = ref<HTMLElement | null>(null)

const hasOrgs = computed(() => orgs.list.length >= 1)

const orgInitials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(w => w.charAt(0).toUpperCase())
  .join('') || '?'

function roleLabel(role: OrganizationRole): string {
  return t(`dashboard.org.roles.${role}`)
}

function pickOrg(id: number) {
  open.value = false
  if (orgs.currentId === id) return
  orgs.setCurrent(id)
  locations.reset()
  pieces.reset()
  router.push(localePath('/dashboard'))
}

function closeMenu() {
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (!rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-bg-soft px-3 py-2.5 text-left transition-[border-color,background] duration-150 hover:border-line-strong"
      :aria-expanded="open"
      :aria-haspopup="hasOrgs"
      :title="hasOrgs ? t('dashboard.org.switch_label') : ''"
      @click="hasOrgs && (open = !open)"
    >
      <div
        v-if="orgs.current"
        class="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg bg-accent text-[13px] font-semibold tracking-[-0.01em] text-white"
      >
        {{ orgInitials(orgs.current.name) }}
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-[13.5px] font-semibold tracking-[-0.005em] text-ink">
          {{ orgs.current?.name ?? t('dashboard.org.no_org') }}
        </span>
        <span class="truncate text-[11.5px] text-ink-muted">
          {{ orgs.current ? roleLabel(orgs.current.currentUserRole) : '—' }}
        </span>
      </div>
      <svg v-if="hasOrgs" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 text-ink-muted" aria-hidden="true">
        <path d="m7 9 5-5 5 5" />
        <path d="m7 15 5 5 5-5" />
      </svg>
    </button>

    <div
      v-if="open"
      role="menu"
      class="absolute left-0 right-0 top-full z-30 mt-1 rounded-[10px] border border-line bg-bg-card p-1 shadow-card"
    >
      <button
        v-for="o in orgs.list"
        :key="o.id"
        type="button"
        role="menuitemradio"
        :aria-checked="o.id === orgs.currentId"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13.5px] transition-colors hover:bg-bg-soft"
        :class="{ 'bg-bg-soft': o.id === orgs.currentId }"
        @click="pickOrg(o.id)"
      >
        <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-white">
          {{ orgInitials(o.name) }}
        </div>
        <span class="flex-1 truncate font-medium text-ink">{{ o.name }}</span>
        <svg
          v-if="o.id === orgs.currentId"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-accent-ink"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>

      <div class="my-1 h-px bg-line" aria-hidden="true" />

      <NuxtLink
        :to="localePath('/dashboard/crear-organizacion')"
        role="menuitem"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13.5px] text-ink-soft transition-colors hover:bg-bg-soft hover:text-ink"
        @click="closeMenu"
      >
        <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong text-ink-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span class="flex-1 truncate font-medium">{{ t('dashboard.org.create_new') }}</span>
      </NuxtLink>
    </div>
  </div>
</template>
