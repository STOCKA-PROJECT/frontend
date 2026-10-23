<script setup lang="ts">
import type { DeviceCreatedDto, DeviceResponseDto, OrganizationRole } from '~/types/api'

/**
 * Registered Raspberry Pi players of an organization with the last state each one reported.
 * The list is reloaded every {@link REFRESH_INTERVAL_MS} while the tab is visible; managers
 * can register, rename, delete and rotate the heartbeat token (shown once in a dialog).
 */
const props = defineProps<{
  orgSlug: string
  role: OrganizationRole | null
}>()

const { t } = useI18n()
const devices = useDevicesStore()
const timelines = useTimelinesStore()
/** The timelines list arrived: a device id missing from it is a deleted timeline. */
const timelinesLoaded = ref(false)
const toast = useToastStore()
const apiError = useApiError()

/** Heartbeats arrive about once a minute; half of that keeps «online» badges honest. */
const REFRESH_INTERVAL_MS = 30_000

const canWrite = computed(() => props.role === 'OWNER' || props.role === 'MANAGER')

// ---- load + polling ----
/** Instant the rows measure «last heartbeat» against; bumped on every refresh. */
const now = shallowRef(Date.now())
const loadError = ref<string | null>(null)

/** Which timeline the device's active show comes from, by its current name. */
function timelineLabel(device: DeviceResponseDto): string | null {
  const id = device.lastShowTimelineId
  if (id == null || !timelinesLoaded.value) return null
  const timeline = timelines.list.find(tl => tl.id === id)
  return timeline
    ? t('dashboard.devices.list.show_timeline', { name: timeline.name })
    : t('dashboard.devices.list.show_timeline_deleted')
}

async function refresh() {
  if (!timelinesLoaded.value) {
    // Best effort: without it the row just shows the show name.
    timelines.fetchList(props.orgSlug).then(() => { timelinesLoaded.value = true }).catch(() => {})
  }
  try {
    await devices.load(props.orgSlug)
    loadError.value = null
  } catch (e) {
    // The first load shows the backend's reason; a failed background refresh shows one fixed
    // line so the alert does not change wording every 30 s.
    loadError.value = devices.loaded ? t('dashboard.devices.list.refresh_failed') : apiError(e).description
  } finally {
    now.value = Date.now()
  }
}

watch(() => props.orgSlug, (next, prev) => {
  if (prev !== undefined && next !== prev) devices.reset()
  void refresh()
}, { immediate: true })

useVisiblePolling(refresh, REFRESH_INTERVAL_MS)

function notifyError(e: unknown) {
  const view = apiError(e)
  toast.push({ type: 'error', title: view.title, description: view.description })
}

// ---- register / rename dialog ----
const formDialog = ref<{
  open: boolean
  mode: 'register' | 'rename'
  target: DeviceResponseDto | null
  loading: boolean
  error: string | null
}>({ open: false, mode: 'register', target: null, loading: false, error: null })

function openRegister() {
  formDialog.value = { open: true, mode: 'register', target: null, loading: false, error: null }
}

function openRename(device: DeviceResponseDto) {
  formDialog.value = { open: true, mode: 'rename', target: device, loading: false, error: null }
}

function closeForm() {
  formDialog.value = { ...formDialog.value, open: false, error: null, loading: false }
}

async function submitForm(name: string) {
  formDialog.value.loading = true
  formDialog.value.error = null
  try {
    if (formDialog.value.mode === 'register') {
      const created = await devices.create(props.orgSlug, { name })
      closeForm()
      showToken('register', created)
    } else if (formDialog.value.target) {
      await devices.rename(props.orgSlug, formDialog.value.target.id, name)
      closeForm()
    }
  } catch (e) {
    formDialog.value.error = apiError(e).description
  } finally {
    formDialog.value.loading = false
  }
}

// ---- token dialog (register / rotate result) ----
const tokenDialog = ref<{
  open: boolean
  mode: 'register' | 'rotate'
  result: DeviceCreatedDto | null
}>({ open: false, mode: 'register', result: null })

function showToken(mode: 'register' | 'rotate', result: DeviceCreatedDto) {
  tokenDialog.value = { open: true, mode, result }
}

function closeToken() {
  // The token is shown once: do not keep it around after the dialog is dismissed.
  tokenDialog.value = { ...tokenDialog.value, open: false, result: null }
}

// ---- confirm (rotate token / delete) ----
type ConfirmKind = 'rotate' | 'delete'

const confirmDialog = ref<{
  open: boolean
  kind: ConfirmKind
  target: DeviceResponseDto | null
  loading: boolean
}>({ open: false, kind: 'delete', target: null, loading: false })

function openConfirm(kind: ConfirmKind, device: DeviceResponseDto) {
  confirmDialog.value = { open: true, kind, target: device, loading: false }
}

function closeConfirm() {
  confirmDialog.value = { ...confirmDialog.value, open: false }
}

const confirmTexts = computed(() => {
  const name = confirmDialog.value.target?.name ?? ''
  if (confirmDialog.value.kind === 'rotate') {
    return {
      title: t('dashboard.devices.confirm.rotate_title'),
      message: t('dashboard.devices.confirm.rotate_message', { name }),
      label: t('dashboard.devices.confirm.rotate_label'),
      tone: 'default' as const
    }
  }
  return {
    title: t('dashboard.devices.confirm.delete_title'),
    message: t('dashboard.devices.confirm.delete_message', { name }),
    label: t('dashboard.devices.confirm.delete_label'),
    tone: 'danger' as const
  }
})

async function runConfirm() {
  const { kind, target } = confirmDialog.value
  if (!target) return
  confirmDialog.value.loading = true
  try {
    if (kind === 'rotate') {
      const rotated = await devices.rotateToken(props.orgSlug, target.id)
      closeConfirm()
      showToken('rotate', rotated)
    } else {
      await devices.remove(props.orgSlug, target.id)
      closeConfirm()
      toast.push({ type: 'success', description: t('dashboard.devices.toasts.deleted') })
    }
  } catch (e) {
    notifyError(e)
  } finally {
    confirmDialog.value.loading = false
  }
}

const showInitialLoading = computed(() => devices.loading && !devices.loaded)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="loadError" role="alert" class="alert-danger">{{ loadError }}</div>

    <div class="flex items-center justify-between gap-3">
      <span class="text-[13px] text-ink-muted">
        {{ t('dashboard.devices.list.count', devices.list.length, { n: devices.list.length }) }}
      </span>
      <button v-if="canWrite" type="button" class="new-btn" @click="openRegister">
        <DashboardIcon name="plus" :size="14" />
        <span>{{ t('dashboard.devices.list.new') }}</span>
      </button>
    </div>

    <p v-if="showInitialLoading" class="rounded-[12px] border border-line bg-bg-card px-4 py-10 text-center text-[13.5px] text-ink-muted">
      {{ t('dashboard.devices.list.loading') }}
    </p>

    <template v-else-if="devices.loaded">
      <div v-if="!devices.list.length" class="rounded-[12px] border border-dashed border-line bg-bg-soft px-5 py-12 text-center">
        <h2 class="text-[15px] font-semibold text-ink">{{ t('dashboard.devices.list.empty_title') }}</h2>
        <p class="mx-auto mt-1.5 max-w-[520px] text-[13.5px] leading-relaxed text-ink-soft">
          {{ t('dashboard.devices.list.empty') }}
        </p>
      </div>

      <ul v-else class="flex flex-col gap-2">
        <DashboardDeviceRow
          v-for="device in devices.list"
          :key="device.id"
          :device="device"
          :timeline-label="timelineLabel(device)"
          :can-write="canWrite"
          :now="now"
          @rename="openRename(device)"
          @rotate="openConfirm('rotate', device)"
          @delete="openConfirm('delete', device)"
        />
      </ul>
    </template>

    <DashboardDeviceFormDialog
      :open="formDialog.open"
      :mode="formDialog.mode"
      :initial="formDialog.target"
      :loading="formDialog.loading"
      :error-msg="formDialog.error"
      @close="closeForm"
      @submit="submitForm"
    />

    <DashboardDeviceTokenDialog
      :open="tokenDialog.open"
      :mode="tokenDialog.mode"
      :result="tokenDialog.result"
      @close="closeToken"
    />

    <DashboardConfirmDialog
      :open="confirmDialog.open"
      :title="confirmTexts.title"
      :message="confirmTexts.message"
      :confirm-label="confirmTexts.label"
      :loading="confirmDialog.loading"
      :tone="confirmTexts.tone"
      @close="closeConfirm"
      @confirm="runConfirm"
    />
  </div>
</template>

<style scoped>
/* Brandbook: l'acció principal de la vista en brand, control-md. */
.new-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--c-accent);
  background: var(--c-accent);
  color: var(--c-on-accent, #fff);
  transition: background .12s, border-color .12s;
}
.new-btn:hover { border-color: var(--c-accent-ink); background: var(--c-accent-ink); }
.alert-danger {
  border-radius: 6px;
  background: var(--c-danger-soft);
  padding: 8px 12px;
  font-size: 13px;
  line-height: 18px;
  color: var(--c-danger);
}
</style>
