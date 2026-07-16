<script setup lang="ts">
import { FetchError } from 'ofetch'
import type {
  AttributeValueInputDto,
  ContactResponseDto,
  CreateContactDto,
  LocationResponseDto,
  MemberResponseDto,
  OrganizationPieceAttributeResponseDto,
  OrganizationRole,
  PieceResponseDto,
  PieceTypeAttributeResponseDto,
  PieceTypeResponseDto,
  UpdatePieceDto
} from '~/types/api'
import type { OwnerRef } from '~/components/dashboard/OwnerSelect.vue'

const ownerEligibleRoles: OrganizationRole[] = ['OWNER', 'MANAGER', 'USER']

const props = withDefaults(defineProps<{
  orgSlug: string
  piece: PieceResponseDto
  pieceTypes: PieceTypeResponseDto[]
  locations: LocationResponseDto[]
  members: MemberResponseDto[]
  contacts?: ContactResponseDto[]
  orgAttributes?: OrganizationPieceAttributeResponseDto[]
  canWrite: boolean
  saving?: boolean
  errorMsg?: string | null
}>(), { saving: false, errorMsg: null, orgAttributes: () => [], contacts: () => [] })

const emit = defineEmits<{
  save: [payload: UpdatePieceDto]
}>()

const { t } = useI18n()

const editing = ref(false)

const editName = ref('')
const editSerialNumber = ref('')
const editDescription = ref('')
const editLocationId = ref<number | null>(null)
const editOwner = ref<OwnerRef | null>(null)
const editTypeIds = ref<Set<number>>(new Set())
const editAttributes = ref<Record<number, string | null>>({})
const editOrgAttributes = ref<Record<number, string | null>>({})

const sortedAvailableTypes = computed(() =>
  [...props.pieceTypes].sort((a, b) => a.name.localeCompare(b.name))
)

const currentTypeIds = computed<Set<number>>(() => new Set(props.piece.pieceTypes.map(t => t.id)))

const currentTypesSorted = computed(() =>
  [...props.piece.pieceTypes].sort((a, b) => a.name.localeCompare(b.name))
)

interface AttributeGroup {
  typeId: number
  typeName: string
  attributes: PieceTypeAttributeResponseDto[]
}

/** Per-type groups of attributes, in alphabetical order by type name. */
function groupAttributesByType(typeIds: Set<number>): AttributeGroup[] {
  const sortedTypes = [...props.pieceTypes]
    .filter(pt => typeIds.has(pt.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  return sortedTypes
    .map(pt => ({
      typeId: pt.id,
      typeName: pt.name,
      attributes: [...pt.attributes].sort((a, b) => a.position - b.position)
    }))
    .filter(group => group.attributes.length > 0)
}

const currentAttributeGroups = computed<AttributeGroup[]>(() => groupAttributesByType(currentTypeIds.value))
const editAttributeGroups = computed<AttributeGroup[]>(() => groupAttributesByType(editTypeIds.value))

const editAttributeIds = computed<Set<number>>(() => {
  const ids = new Set<number>()
  for (const g of editAttributeGroups.value) for (const a of g.attributes) ids.add(a.id)
  return ids
})

const typeAttributeValueByAttrId = computed(() => {
  const map = new Map<number, string | null>()
  for (const v of props.piece.attributeValues) {
    if (v.scope !== 'ORG') map.set(v.attributeId, v.value)
  }
  return map
})

const orgAttributeValueByAttrId = computed(() => {
  const map = new Map<number, string | null>()
  for (const v of props.piece.attributeValues) {
    if (v.scope === 'ORG') map.set(v.attributeId, v.value)
  }
  return map
})

const sortedOrgAttributes = computed(() =>
  [...props.orgAttributes].sort((a, b) => a.position - b.position || a.id - b.id)
)

const hasOrgAttributes = computed(() => sortedOrgAttributes.value.length > 0)

function startEdit() {
  editName.value = props.piece.name
  editSerialNumber.value = props.piece.serialNumber ?? ''
  editDescription.value = props.piece.description ?? ''
  editLocationId.value = props.piece.locationId ?? null
  editOwner.value = currentOwnerRef()
  editTypeIds.value = new Set(currentTypeIds.value)
  const typeAttrs: Record<number, string | null> = {}
  const orgAttrs: Record<number, string | null> = {}
  for (const v of props.piece.attributeValues) {
    if (v.scope === 'ORG') orgAttrs[v.attributeId] = v.value
    else typeAttrs[v.attributeId] = v.value
  }
  editAttributes.value = typeAttrs
  editOrgAttributes.value = orgAttrs
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

function toggleType(id: number) {
  const next = new Set(editTypeIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  editTypeIds.value = next
}

watch(editTypeIds, () => {
  // Drop cached values whose attribute is no longer covered by the selected types.
  const valid = editAttributeIds.value
  const next: Record<number, string | null> = {}
  for (const [k, v] of Object.entries(editAttributes.value)) {
    if (valid.has(Number(k))) next[Number(k)] = v
  }
  editAttributes.value = next
}, { deep: true })

function setAttrValue(attrId: number, value: string | null) {
  editAttributes.value = { ...editAttributes.value, [attrId]: value }
}

function setOrgAttrValue(attrId: number, value: string | null) {
  editOrgAttributes.value = { ...editOrgAttributes.value, [attrId]: value }
}

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

function submit() {
  const payload: UpdatePieceDto = {}

  const trimmedName = editName.value.trim()
  if (trimmedName !== props.piece.name) payload.name = trimmedName

  const newSerial = editSerialNumber.value.trim()
  const oldSerial = props.piece.serialNumber ?? ''
  if (newSerial !== oldSerial) {
    payload.serialNumber = newSerial === '' ? '' : newSerial
  }

  const newDesc = editDescription.value.trim()
  const oldDesc = props.piece.description ?? ''
  if (newDesc !== oldDesc) payload.description = newDesc

  if (!setsEqual(editTypeIds.value, currentTypeIds.value)) {
    payload.pieceTypeIds = [...editTypeIds.value]
  }

  if ((editLocationId.value ?? null) !== (props.piece.locationId ?? null)) {
    if (editLocationId.value == null) {
      payload.clearLocation = true
    } else {
      payload.locationId = editLocationId.value
    }
  }

  const currentOwner = currentOwnerRef()
  const nextOwner = editOwner.value
  if (currentOwner?.kind !== nextOwner?.kind || currentOwner?.id !== nextOwner?.id) {
    if (nextOwner == null) {
      payload.clearOwner = true
    } else if (nextOwner.kind === 'USER') {
      payload.ownerUserId = nextOwner.id
    } else {
      payload.ownerContactId = nextOwner.id
    }
  }

  const attrChanges: AttributeValueInputDto[] = []
  for (const group of editAttributeGroups.value) {
    for (const attr of group.attributes) {
      const oldVal = typeAttributeValueByAttrId.value.get(attr.id) ?? null
      const newRaw = editAttributes.value[attr.id]
      const newVal = newRaw == null || newRaw === '' ? null : newRaw
      if (newVal !== oldVal) {
        attrChanges.push({ attributeId: attr.id, scope: 'TYPE', value: newVal })
      }
    }
  }
  for (const attr of sortedOrgAttributes.value) {
    const oldVal = orgAttributeValueByAttrId.value.get(attr.id) ?? null
    const newRaw = editOrgAttributes.value[attr.id]
    const newVal = newRaw == null || newRaw === '' ? null : newRaw
    if (newVal !== oldVal) {
      attrChanges.push({ attributeId: attr.id, scope: 'ORG', value: newVal })
    }
  }
  if (attrChanges.length > 0) payload.attributeValues = attrChanges

  emit('save', payload)
}

watch(() => props.saving, (saving, prev) => {
  if (prev && !saving && !props.errorMsg) {
    editing.value = false
  }
})

const hasAttributesInRead = computed(() => currentAttributeGroups.value.length > 0)
const hasAttributesInEdit = computed(() => editAttributeGroups.value.length > 0)

function locationLabel(id?: number): string {
  if (id == null) return t('dashboard.pieces.unassigned_location')
  return props.locations.find(l => l.id === id)?.name ?? `#${id}`
}
/** Referencia {kind,id} del propietario actual de la pieza, o null si no tiene. */
function currentOwnerRef(): OwnerRef | null {
  if (props.piece.ownerUserId != null) return { kind: 'USER', id: props.piece.ownerUserId }
  if (props.piece.ownerContactId != null) return { kind: 'CONTACT', id: props.piece.ownerContactId }
  return null
}

/**
 * Nombre visible del propietario: el backend ya lo resuelve en `piece.owner`,
 * con fallback a la lista de miembros para respuestas antiguas cacheadas.
 */
const ownerDisplay = computed(() => {
  if (props.piece.owner) return props.piece.owner.displayName
  if (props.piece.ownerUserId != null) return ownerLabel(props.piece.ownerUserId)
  return t('dashboard.pieces.no_owner')
})

// Se mantiene para renderizar atributos de tipo MEMBER (siempre miembros).
function ownerLabel(id?: number): string {
  if (id == null) return t('dashboard.pieces.no_owner')
  const m = props.members.find(x => x.userId === id)
  return m ? `${m.name} ${m.lastName}`.trim() : `#${id}`
}

// Alta de contacto al vuelo desde el selector de propietario en edición.
const contactsStore = useContactsStore()
const contactDialogOpen = ref(false)
const contactDialogLoading = ref(false)
const contactDialogError = ref<string | null>(null)
const contactInitialName = ref('')

function openCreateContact(query: string) {
  contactInitialName.value = query
  contactDialogError.value = null
  contactDialogOpen.value = true
}

async function submitCreateContact(payload: CreateContactDto) {
  contactDialogLoading.value = true
  contactDialogError.value = null
  try {
    const created = await contactsStore.createContact(props.orgSlug, payload)
    editOwner.value = { kind: 'CONTACT', id: created.id }
    contactDialogOpen.value = false
  } catch (e) {
    contactDialogError.value = extractErrorMessage(e, t('dashboard.contacts.errors.save'))
  } finally {
    contactDialogLoading.value = false
  }
}

function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof FetchError) {
    const data = e.response?._data as { message?: string; detail?: string } | undefined
    return data?.message ?? data?.detail ?? fallback
  }
  return fallback
}

function renderValue(
  attrId: number,
  type: PieceTypeAttributeResponseDto['type'],
  scope: 'TYPE' | 'ORG' = 'TYPE'
): string {
  const v = scope === 'ORG'
    ? orgAttributeValueByAttrId.value.get(attrId)
    : typeAttributeValueByAttrId.value.get(attrId)
  if (v == null || v === '') return '—'
  if (type === 'BOOLEAN') return v === 'true' ? t('common.yes') : t('common.no')
  if (type === 'MULTI_SELECT') {
    try {
      const arr = JSON.parse(v) as unknown
      if (Array.isArray(arr)) return arr.join(', ')
    } catch { /* ignore */ }
    return v
  }
  if (type === 'MEMBER') {
    const n = Number(v)
    if (!Number.isFinite(n)) return v
    return ownerLabel(n)
  }
  return v
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="errorMsg" role="alert"
      class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {{ errorMsg }}
    </div>

    <div class="flex items-center justify-between">
      <h3 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {{ t('dashboard.pieces.info.section_basic') }}
      </h3>
      <div class="flex gap-2">
        <template v-if="!editing">
          <button
            v-if="canWrite"
            type="button"
            class="ghost-btn"
            @click="startEdit"
          >
            {{ t('dashboard.pieces.actions.edit') }}
          </button>
        </template>
        <template v-else>
          <button type="button" class="ghost-btn" :disabled="saving" @click="cancelEdit">
            {{ t('common.cancel') }}
          </button>
          <button type="button" class="primary-btn" :disabled="saving" :aria-busy="saving" @click="submit">
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
        </template>
      </div>
    </div>

    <dl v-if="!editing" class="info-grid">
      <div class="info-row">
        <dt>{{ t('dashboard.pieces.form.field_name') }}</dt>
        <dd>{{ piece.name }}</dd>
      </div>
      <div class="info-row">
        <dt>{{ t('dashboard.pieces.form.field_serial_number') }}</dt>
        <dd>{{ piece.serialNumber || '—' }}</dd>
      </div>
      <div class="info-row info-row-full">
        <dt>{{ t('dashboard.pieces.form.field_description') }}</dt>
        <dd class="whitespace-pre-line">{{ piece.description || '—' }}</dd>
      </div>
      <div class="info-row info-row-full">
        <dt>{{ t('dashboard.pieces.form.field_types') }}</dt>
        <dd>
          <div v-if="currentTypesSorted.length > 0" class="flex flex-wrap gap-1.5">
            <span v-for="pt in currentTypesSorted" :key="pt.id" class="type-chip">{{ pt.name }}</span>
          </div>
          <span v-else>—</span>
        </dd>
      </div>
      <div class="info-row">
        <dt>{{ t('dashboard.pieces.form.field_location') }}</dt>
        <dd>{{ locationLabel(piece.locationId) }}</dd>
      </div>
      <div class="info-row">
        <dt>{{ t('dashboard.pieces.form.field_owner') }}</dt>
        <dd class="flex items-center gap-2">
          <span>{{ ownerDisplay }}</span>
          <span v-if="piece.owner?.kind === 'CONTACT'" class="contact-badge">
            {{ t('dashboard.contacts.badge') }}
          </span>
        </dd>
      </div>
    </dl>

    <div v-else class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <span class="form-label">
          {{ t('dashboard.pieces.form.field_types') }}
          <span class="text-ink-muted text-[11.5px] font-normal">
            ({{ t('dashboard.pieces.form.optional') }})
          </span>
        </span>
        <div class="flex flex-wrap gap-2 rounded-lg border border-line bg-field px-3 py-2.5">
          <label
            v-for="pt in sortedAvailableTypes"
            :key="pt.id"
            class="type-pill"
            :class="{ 'is-selected': editTypeIds.has(pt.id) }"
          >
            <input
              type="checkbox"
              class="sr-only"
              :checked="editTypeIds.has(pt.id)"
              :disabled="saving"
              @change="toggleType(pt.id)"
            >
            <span aria-hidden="true" class="type-pill-dot" />
            {{ pt.name }}
          </label>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <div class="flex flex-col gap-1.5">
          <label for="edit-name" class="form-label">
            {{ t('dashboard.pieces.form.field_name') }} <span class="text-danger">*</span>
          </label>
          <input id="edit-name" v-model="editName" type="text" maxlength="255" class="form-input" :disabled="saving">
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="edit-serial" class="form-label">
            {{ t('dashboard.pieces.form.field_serial_number') }}
            <span class="text-ink-muted text-[11.5px] font-normal">
              ({{ t('dashboard.pieces.form.optional') }})
            </span>
          </label>
          <input
            id="edit-serial"
            v-model="editSerialNumber"
            type="text"
            maxlength="100"
            class="form-input"
            :disabled="saving"
            :placeholder="t('dashboard.pieces.form.serial_placeholder')"
          >
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="edit-description" class="form-label">
          {{ t('dashboard.pieces.form.field_description') }}
        </label>
        <textarea
          id="edit-description"
          v-model="editDescription"
          class="form-input form-textarea"
          rows="2"
          :disabled="saving"
        />
      </div>
      <div class="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <div class="flex flex-col gap-1.5">
          <label for="edit-location" class="form-label">
            {{ t('dashboard.pieces.form.field_location') }}
          </label>
          <select id="edit-location" v-model.number="editLocationId" class="form-input" :disabled="saving">
            <option :value="null">{{ t('dashboard.pieces.form.unassigned') }}</option>
            <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="edit-owner" class="form-label">
            {{ t('dashboard.pieces.form.field_owner') }}
          </label>
          <DashboardOwnerSelect
            input-id="edit-owner"
            v-model="editOwner"
            :members="members"
            :contacts="contacts"
            :eligible-roles="ownerEligibleRoles"
            :placeholder="t('dashboard.pieces.form.no_owner')"
            :disabled="saving"
            can-create-contact
            @create-contact="openCreateContact"
          />
        </div>
      </div>
    </div>

    <DashboardContactFormDialog
      :open="contactDialogOpen"
      :loading="contactDialogLoading"
      :error-msg="contactDialogError"
      :initial-name="contactInitialName"
      @submit="submitCreateContact"
      @close="contactDialogOpen = false"
    />

    <div v-if="!editing && hasOrgAttributes" class="border-t border-line pt-4">
      <h3 class="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {{ t('dashboard.pieces.form.org_attributes_section') }}
      </h3>
      <dl class="info-grid">
        <div v-for="attr in sortedOrgAttributes" :key="attr.id" class="info-row">
          <dt>{{ attr.displayName }}</dt>
          <dd>{{ renderValue(attr.id, attr.type, 'ORG') }}</dd>
        </div>
      </dl>
    </div>

    <div v-else-if="editing && hasOrgAttributes" class="border-t border-line pt-4">
      <h3 class="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {{ t('dashboard.pieces.form.org_attributes_section') }}
      </h3>
      <div class="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <DashboardPieceAttributeField
          v-for="attr in sortedOrgAttributes"
          :key="attr.id"
          :attribute="(attr as unknown as PieceTypeAttributeResponseDto)"
          :model-value="editOrgAttributes[attr.id] ?? null"
          :members="members"
          :disabled="saving"
          @update:model-value="(v) => setOrgAttrValue(attr.id, v)"
        />
      </div>
    </div>

    <div v-if="!editing && hasAttributesInRead" class="border-t border-line pt-4">
      <h3 class="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {{ t('dashboard.pieces.info.section_attributes') }}
      </h3>
      <div class="flex flex-col gap-5">
        <section v-for="group in currentAttributeGroups" :key="group.typeId" class="attr-group">
          <h4 class="attr-group-title">{{ group.typeName }}</h4>
          <dl class="info-grid">
            <div v-for="attr in group.attributes" :key="attr.id" class="info-row">
              <dt>{{ attr.displayName }}</dt>
              <dd>{{ renderValue(attr.id, attr.type, 'TYPE') }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>

    <div v-else-if="editing && hasAttributesInEdit" class="border-t border-line pt-4">
      <h3 class="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {{ t('dashboard.pieces.info.section_attributes') }}
      </h3>
      <div class="flex flex-col gap-5">
        <section v-for="group in editAttributeGroups" :key="group.typeId" class="attr-group">
          <h4 class="attr-group-title">{{ group.typeName }}</h4>
          <div class="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <DashboardPieceAttributeField
              v-for="attr in group.attributes"
              :key="attr.id"
              :attribute="attr"
              :model-value="editAttributes[attr.id] ?? null"
              :members="members"
              :disabled="saving"
              @update:model-value="(v) => setAttrValue(attr.id, v)"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px 24px;
}
@media (min-width: 768px) {
  .info-grid { grid-template-columns: 1fr 1fr; }
}
.info-row { display: flex; flex-direction: column; gap: 3px; }
.info-row-full { grid-column: 1 / -1; }
.info-row dt {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--c-ink-muted);
  text-transform: uppercase;
  letter-spacing: .04em;
}
.info-row dd {
  font-size: 14px;
  color: var(--c-ink);
  margin: 0;
}
.form-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--c-ink-soft);
  letter-spacing: .02em;
}
.form-input {
  height: 38px;
  padding: 0 12px;
  width: 100%;
  border: 1px solid var(--c-line);
  border-radius: 9px;
  background: var(--c-field);
  color: var(--c-ink);
  font-size: 14px;
}
.form-input:focus { outline: none; border-color: var(--c-accent); background: var(--c-bg-card); }
.form-textarea { height: auto; min-height: 64px; padding: 9px 12px; resize: vertical; }

.ghost-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12.5px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .12s;
}
.ghost-btn:hover:not(:disabled) { background: var(--c-bg-soft); }
.ghost-btn:disabled { opacity: .5; cursor: not-allowed; }

.primary-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  background: var(--c-ink);
  color: var(--c-bg-card);
  border: 1px solid var(--c-ink);
  transition: background .12s;
}
.primary-btn:hover:not(:disabled) { background: color-mix(in oklab, var(--c-ink) 90%, transparent); }
.primary-btn:disabled { opacity: .5; cursor: not-allowed; }

.tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}
.tag-ok { background: var(--c-accent-soft); color: var(--c-accent-ink); }
.tag-warn { background: var(--c-warn-soft); color: #8a6324; }

.type-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-line);
  font-size: 12px;
  color: var(--c-ink-soft);
}

.contact-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-soft);
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--c-ink-soft);
  white-space: nowrap;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  font-size: 12.5px;
  color: var(--c-ink-soft);
  cursor: pointer;
  user-select: none;
  transition: background .12s, border-color .12s, color .12s;
}
.type-pill:hover { background: var(--c-bg-soft); color: var(--c-ink); }
.type-pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--c-line-strong);
  background: transparent;
  transition: background .12s, border-color .12s;
}
.type-pill.is-selected {
  background: var(--c-ink);
  color: var(--c-bg-card);
  border-color: var(--c-ink);
}
.type-pill.is-selected .type-pill-dot {
  background: var(--c-bg-card);
  border-color: var(--c-bg-card);
}

.attr-group { display: flex; flex-direction: column; gap: 10px; }
.attr-group-title {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 3px 11px;
  border-radius: 999px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-line);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: .02em;
  color: var(--c-ink-soft);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
