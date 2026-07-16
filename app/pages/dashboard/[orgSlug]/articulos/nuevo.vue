<script setup lang="ts">
import { FetchError } from 'ofetch'
import type { CreatePieceDto, LocationResponseDto, LocationTreeNodeDto } from '~/types/api'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { orgPath } = useOrgPath()

const pieces = usePiecesStore()
const pieceTypes = usePieceTypesStore()
const orgAttributes = useOrganizationPieceAttributesStore()
const locations = useLocationsStore()
const team = useTeamStore()
const contactsStore = useContactsStore()

// `resolve-org-slug.global.ts` already guarantees the org exists in the store
// and the user is a member.
const { slug: orgSlug, id: orgId, org } = useCurrentOrg()

useSeoMeta({
  title: () => t('dashboard.pieces.form.title_create'),
  robots: 'noindex, nofollow'
})

const role = computed(() => org.value?.currentUserRole ?? null)
const canWrite = computed(() => role.value === 'OWNER' || role.value === 'MANAGER' || role.value === 'USER')

if (!canWrite.value) {
  await navigateTo(orgPath('/articulos'))
}

function flattenTree(nodes: LocationTreeNodeDto[], parents: string[] = []): LocationResponseDto[] {
  const out: LocationResponseDto[] = []
  for (const n of nodes) {
    const path = [...parents, n.name]
    out.push({
      id: n.id,
      // organizationId is legacy in the flattened payload — backend is now slug-scoped.
      organizationId: orgId.value ?? 0,
      name: path.join(' / '),
      description: n.description,
      breadcrumb: []
    } as unknown as LocationResponseDto)
    if (n.children?.length) out.push(...flattenTree(n.children, path))
  }
  return out
}
const flatLocations = computed(() => flattenTree(locations.tree))
const members = computed(() => (orgSlug.value && team.getMembers(orgSlug.value)) || [])
const contacts = computed(() => (orgSlug.value && contactsStore.getContacts(orgSlug.value)) || [])

const loading = ref(true)
const saving = ref(false)
const errorMsg = ref<string | null>(null)

function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof FetchError) {
    const data = e.response?._data as { message?: string; detail?: string } | undefined
    return data?.message ?? data?.detail ?? fallback
  }
  return fallback
}

async function loadDeps() {
  if (!orgSlug.value) return
  const slug = orgSlug.value
  loading.value = true
  try {
    await Promise.all([
      pieceTypes.list.length > 0
        ? Promise.resolve()
        : pieceTypes.fetchAll(slug).catch(() => undefined),
      locations.tree.length > 0
        ? Promise.resolve()
        : locations.fetchTree(slug).catch(() => undefined),
      team.getMembers(slug)
        ? Promise.resolve()
        : team.fetchMembers(slug).catch(() => undefined),
      contactsStore.getContacts(slug)
        ? Promise.resolve()
        : contactsStore.fetchContacts(slug).catch(() => undefined),
      orgAttributes.loadedOrgSlugs.has(slug)
        ? Promise.resolve()
        : orgAttributes.fetchAll(slug).catch(() => undefined)
    ])
  } finally {
    loading.value = false
  }
}

await loadDeps()

async function onSubmit(payload: CreatePieceDto, coverFile: File | null) {
  if (!orgSlug.value) return
  const slug = orgSlug.value
  saving.value = true
  errorMsg.value = null
  try {
    const created = await pieces.create(slug, payload)
    if (coverFile) {
      try {
        await pieces.uploadAttachment(slug, created.id, coverFile, 'IMAGE')
      } catch {
        // Non-fatal: the piece is created. Surface a softer warning and let the user retry from
        // the detail page. We still navigate so they can manage attachments there.
        errorMsg.value = t('dashboard.pieces.errors.cover_upload')
      }
    }
    void navigateTo(orgPath(`/articulos/${created.id}`))
  } catch (e) {
    errorMsg.value = extractErrorMessage(e, t('dashboard.pieces.errors.save'))
    saving.value = false
  }
}

function onCancel() {
  void navigateTo(orgPath('/articulos'))
}
</script>

<template>
  <div class="page flex flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 sm:pt-7 lg:px-8">
    <NuxtLink :to="orgPath('/articulos')" class="back-link">
      ← {{ t('dashboard.pieces.back_to_list') }}
    </NuxtLink>

    <div>
      <h1 class="text-[22px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[26px]">
        {{ t('dashboard.pieces.form.title_create') }}
      </h1>
      <p class="mt-1 max-w-[680px] text-[14px] leading-relaxed text-ink-soft">
        {{ t('dashboard.pieces.form.subtitle') }}
      </p>
    </div>

    <div v-if="loading" class="h-[280px] animate-pulse rounded-xl bg-bg-soft" />
    <div v-else class="rounded-[14px] border border-line bg-bg-card px-6 py-6 max-md:px-4">
      <DashboardPieceForm
        v-if="orgSlug"
        :org-slug="orgSlug"
        :piece-types="pieceTypes.list"
        :locations="flatLocations"
        :members="members"
        :contacts="contacts"
        :org-attributes="orgAttributes.listFor(orgSlug)"
        :loading="saving"
        :error-msg="errorMsg"
        @submit="onSubmit"
        @cancel="onCancel"
      />
    </div>
  </div>
</template>

<style scoped>
.page { min-height: calc(100vh - var(--topbar-h, 60px)); }
.back-link {
  align-self: flex-start;
  font-size: 12.5px;
  color: var(--c-ink-soft);
  padding: 4px 0;
  transition: color .12s;
}
.back-link:hover { color: var(--c-ink); }
</style>
