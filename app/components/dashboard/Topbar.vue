<script setup lang="ts">
const { t } = useI18n()
const orgs = useOrganizationsStore()
const route = useRoute()

const segments = computed(() => route.path.split('/').filter(Boolean))
const lastSegment = computed(() => segments.value[segments.value.length - 1])

function labelFor(segment: string): string {
  if (segment === 'dashboard') return t('dashboard.summary')
  if (segment === 'crear-organizacion') return t('dashboard.create_organization')
  if (segment === 'ajustes-organizacion') return t('dashboard.org_settings.breadcrumb')
  if (segment === 'ubicaciones') return t('dashboard.nav.locations')
  if (segment === 'equipo') return t('dashboard.nav.team')
  if (segment === 'tipos-articulos') return t('dashboard.nav.types')
  if (segment === 'articulos') return t('dashboard.nav.items')
  if (segment === 'nuevo') return t('dashboard.pieces.new_breadcrumb')
  return ''
}

const here = computed<string[]>(() => {
  const segs = segments.value
  // Filtra prefijos de locale (en, ca) y la raíz "dashboard"
  const startIdx = segs[0] === 'en' || segs[0] === 'ca' ? 1 : 0
  if (segs[startIdx] !== 'dashboard') return []
  const rest = segs.slice(startIdx + 1)
  if (rest.length === 0) return [t('dashboard.summary')]

  const parts: string[] = []
  for (let i = 0; i < rest.length; i++) {
    const seg = rest[i]!
    const lbl = labelFor(seg)
    if (lbl) {
      parts.push(lbl)
      continue
    }
    // Segmento dinámico (id numérico): no aporta label
  }
  return parts
})

const showOrg = computed(() => lastSegment.value !== 'crear-organizacion')
</script>

<template>
  <header class="sticky top-0 z-20 flex h-topbar items-center gap-4 border-b border-line bg-bg/85 px-6 backdrop-blur-md max-md:px-4">
    <nav :aria-label="t('dashboard.main_label')" class="flex min-w-0 items-center gap-1.5 text-[13.5px] text-ink-soft">
      <span v-if="showOrg && orgs.current" class="hover:text-ink truncate">{{ orgs.current.name }}</span>
      <template v-for="(part, idx) in here" :key="`${idx}-${part}`">
        <span aria-hidden="true" class="text-ink-muted">/</span>
        <span :class="idx === here.length - 1 ? 'font-medium text-ink truncate' : 'truncate'">{{ part }}</span>
      </template>
    </nav>

    <div class="ml-auto flex h-9 w-[280px] items-center gap-2 rounded-[9px] border border-line bg-field px-3 text-[13.5px] transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--c-accent)_16%,transparent)] max-lg:w-[200px] max-md:hidden">
      <DashboardIcon name="search" :size="14" />
      <input
        type="search"
        :placeholder="t('dashboard.search_placeholder')"
        disabled
        class="w-full flex-1 cursor-not-allowed bg-transparent text-ink outline-none placeholder:text-ink-muted disabled:opacity-70"
      >
      <kbd class="rounded-md border border-line bg-bg-soft px-1.5 py-px text-[11px] text-ink-muted">⌘K</kbd>
    </div>

    <LanguageSwitcher variant="ghost" />

    <button
      type="button"
      class="icon-btn relative"
      :aria-label="t('dashboard.notifications')"
      :title="t('common.comingSoon')"
      disabled
    >
      <DashboardIcon name="bell" :size="16" />
    </button>
    <button
      type="button"
      class="icon-btn"
      :aria-label="t('dashboard.help')"
      disabled
    >
      <DashboardIcon name="help" :size="16" />
    </button>
  </header>
</template>

<style scoped>
.icon-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--c-line);
  border-radius: 9px;
  color: var(--c-ink-soft);
  transition: border-color .15s, color .15s, background .15s;
  cursor: not-allowed;
  opacity: .65;
}
</style>
