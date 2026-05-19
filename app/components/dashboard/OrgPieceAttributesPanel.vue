<script setup lang="ts">
import { FetchError } from 'ofetch'
import type {
  CreateOrganizationPieceAttributeDto,
  CreatePieceTypeAttributeDto,
  OrganizationPieceAttributeResponseDto,
  PieceTypeAttributeResponseDto,
  UpdateOrganizationPieceAttributeDto,
  UpdatePieceTypeAttributeDto
} from '~/types/api'

const props = defineProps<{
  orgSlug: string
  canWrite: boolean
}>()

const { t } = useI18n()
const store = useOrganizationPieceAttributesStore()

const errorMsg = ref<string | null>(null)
const dialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editing = ref<OrganizationPieceAttributeResponseDto | null>(null)
const submitting = ref(false)
const dialogError = ref<string | null>(null)

const items = computed(() => store.listFor(props.orgSlug))

watchEffect(async () => {
  if (!props.orgSlug) return
  if (!store.loadedOrgSlugs.has(props.orgSlug)) {
    try {
      await store.fetchAll(props.orgSlug)
    } catch {
      errorMsg.value = t('dashboard.org_settings.attributes.errors.load')
    }
  }
})

function openCreate() {
  dialogMode.value = 'create'
  editing.value = null
  dialogError.value = null
  dialogOpen.value = true
}

function openEdit(attrId: number) {
  const attr = items.value.find(a => a.id === attrId)
  if (!attr) return
  dialogMode.value = 'edit'
  editing.value = attr
  dialogError.value = null
  dialogOpen.value = true
}

async function onSubmit(payload: CreatePieceTypeAttributeDto | UpdatePieceTypeAttributeDto) {
  submitting.value = true
  dialogError.value = null
  try {
    if (dialogMode.value === 'create') {
      await store.create(props.orgSlug, payload as CreateOrganizationPieceAttributeDto)
    } else if (editing.value) {
      await store.update(props.orgSlug, editing.value.id, payload as UpdateOrganizationPieceAttributeDto)
    }
    dialogOpen.value = false
  } catch (e) {
    if (e instanceof FetchError && e.response?.status === 409) {
      dialogError.value = t('dashboard.org_settings.attributes.errors.duplicate')
    } else {
      dialogError.value = t('dashboard.org_settings.attributes.errors.generic')
    }
  } finally {
    submitting.value = false
  }
}

const confirmDeleteId = ref<number | null>(null)
const confirmDeleteName = computed(() => {
  if (confirmDeleteId.value == null) return ''
  return items.value.find(a => a.id === confirmDeleteId.value)?.displayName ?? ''
})
const deletingAttr = ref(false)
const deleteError = ref<string | null>(null)

function askDelete(attrId: number) {
  confirmDeleteId.value = attrId
  deleteError.value = null
}

async function confirmDelete() {
  if (confirmDeleteId.value == null) return
  deletingAttr.value = true
  deleteError.value = null
  try {
    await store.softDelete(props.orgSlug, confirmDeleteId.value)
    confirmDeleteId.value = null
  } catch {
    deleteError.value = t('dashboard.org_settings.attributes.errors.delete')
  } finally {
    deletingAttr.value = false
  }
}

function cancelDelete() {
  confirmDeleteId.value = null
}
</script>

<template>
  <section class="rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
    <div class="mb-3 flex items-center justify-between gap-2">
      <div class="min-w-0">
        <h2 class="text-[16px] font-semibold leading-tight tracking-[-0.015em] text-ink">
          {{ t('dashboard.org_settings.attributes.title') }}
        </h2>
        <p class="mt-1 text-[13px] text-ink-soft">
          {{ t('dashboard.org_settings.attributes.subtitle') }}
        </p>
      </div>
      <button v-if="canWrite" type="button" class="action-btn" @click="openCreate">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>{{ t('dashboard.org_settings.attributes.add') }}</span>
      </button>
    </div>

    <div v-if="errorMsg" role="alert"
      class="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <div v-if="!items.length"
      class="rounded-[10px] border border-dashed border-line bg-bg-soft px-4 py-8 text-center">
      <p class="text-[13px] text-ink-muted">
        {{ t('dashboard.org_settings.attributes.empty') }}
      </p>
    </div>

    <ul v-else class="flex flex-col gap-1.5">
      <li v-for="attr in items" :key="attr.id">
        <DashboardPieceTypeAttributeRow
          :attr="(attr as unknown as PieceTypeAttributeResponseDto)"
          :can-write="canWrite"
          @edit="openEdit(attr.id)"
          @delete="askDelete(attr.id)" />
      </li>
    </ul>

    <DashboardPieceTypeAttributeFormDialog
      :open="dialogOpen"
      :mode="dialogMode"
      :type-name="t('dashboard.org_settings.attributes.scope_label')"
      :initial="(editing as unknown as PieceTypeAttributeResponseDto | null)"
      :loading="submitting"
      :error-msg="dialogError"
      @submit="onSubmit"
      @close="dialogOpen = false" />

    <DashboardConfirmDialog
      :open="confirmDeleteId !== null"
      :title="t('dashboard.org_settings.attributes.delete_title')"
      :message="deleteError ?? t('dashboard.org_settings.attributes.delete_message', { name: confirmDeleteName })"
      :confirm-label="t('dashboard.org_settings.attributes.delete_confirm')"
      :loading="deletingAttr"
      tone="danger"
      @confirm="confirmDelete"
      @close="cancelDelete" />
  </section>
</template>

<style scoped>
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .12s, border-color .12s, color .12s;
}
.action-btn:hover { background: var(--c-bg-soft); border-color: var(--c-line-strong); }
</style>
