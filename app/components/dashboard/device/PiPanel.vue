<script setup lang="ts">
import type { DeviceResponseDto, OrganizationRole, PortResponseDto } from '~/types/api'
import type { FixtureProfile, HeadPosition } from '~/types/contract'
import { headPositionsOf, sameHeadPositionName } from '~/types/contract'

/**
 * Controls a player from the browser on the local network, with the same options as the belén app:
 * connection, state and commands, alerts, ports with their pieces and hardware tests, sensors,
 * shows, network and system. Read-only without the PIN (a SPECTATOR, or none saved).
 */
const props = defineProps<{
  device: DeviceResponseDto
  orgSlug: string
  role: OrganizationRole | null
}>()

const { t } = useI18n()
const pi = usePiControl(() => props.device)
const ports = usePortsStore()
const contract = useContractStore()
const toast = useToastStore()
const apiError = useApiError()

const isSpectator = computed(() => props.role === 'SPECTATOR')
/** Why the ports cannot be tested now, when it is worth saying. */
const testBlocked = computed(() => (pi.status.value?.rehearsal ? 'rehearsal' : pi.playing.value ? 'playing' : null))

// ---- moving heads: their Stocka ports (saved positions) and profiles (slider ranges) ----
onMounted(() => {
  // Best effort: without the ports or the catalog the page still controls the Pi, only the positions are missing.
  void ports.fetchAll(props.orgSlug).catch(() => {})
  void contract.load().catch(() => {})
})

/** The organization's heads by name: the show's targets carry the same names as the ports. */
const headPorts = computed<Record<string, PortResponseDto>>(() =>
  Object.fromEntries(ports.list.filter(p => p.kind === 'moving_head').map(p => [p.name, p])))

const headProfiles = computed<Record<string, FixtureProfile>>(() => {
  const out: Record<string, FixtureProfile> = {}
  for (const [name, port] of Object.entries(headPorts.value)) {
    const profile = contract.movingHeadProfile(port.config.profile)
    if (profile) out[name] = profile
  }
  return out
})

const canSavePositions = computed(() => props.role === 'OWNER' || props.role === 'MANAGER')

/** Saves a position on the head's port (replacing one with the same name), so every editor and device sees it. */
async function savePosition(portName: string, position: HeadPosition) {
  const port = headPorts.value[portName]
  if (!port) return
  const existing = headPositionsOf(port.config)
  const index = existing.findIndex(p => sameHeadPositionName(p.name, position.name))
  const positions = index >= 0 ? existing.map((p, i) => (i === index ? position : p)) : [...existing, position]
  try {
    await ports.update(props.orgSlug, port.id, { config: { ...port.config, positions } })
    toast.push({ type: 'success', description: t(index >= 0 ? 'dashboard.device.pi.test.head.replaced' : 'dashboard.device.pi.test.head.saved', { name: position.name, port: portName }) })
  } catch (err) {
    const view = apiError(err)
    toast.push({ type: 'error', title: t('dashboard.device.pi.test.head.save_failed'), description: view.description })
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <DashboardDevicePiConnection
      :device="device"
      :connection="pi.connection.value"
      :info="pi.info.value"
      :can-control="pi.canControl.value"
      :is-spectator="isSpectator"
      @retry="pi.connect()"
    />

    <template v-if="pi.connected.value && pi.status.value">
      <DashboardDevicePiAlerts
        v-if="pi.status.value.alerts?.length"
        :alerts="pi.status.value.alerts"
        :motors="pi.status.value.motors ?? {}"
        :can-control="pi.canControl.value"
        :busy="pi.busy.value"
        @clear="pi.clearAlerts()"
        @unlock="pi.unlockMotor($event)"
      />

      <div class="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div class="flex min-w-0 flex-col gap-4">
          <DashboardDevicePiStatus
            :status="pi.status.value"
            :info="pi.info.value"
            :can-control="pi.canControl.value"
            :busy="pi.busy.value"
            @play="pi.play()"
            @stop="pi.stop()"
            @panic="pi.panic()"
            @end-rehearsal="pi.endRehearsal()"
          />
          <DashboardDevicePiSensors :sensors="pi.status.value.sensors ?? {}" />
          <DashboardDevicePiShows
            :org-slug="orgSlug"
            :bundles="pi.bundles.value"
            :upload="pi.upload.value"
            :can-control="pi.canControl.value"
            :busy="pi.busy.value"
            :active-timeline-id="pi.status.value.showTimelineId ?? device.lastShowTimelineId ?? null"
            @send="(name, download, activate) => pi.sendShow(name, download, activate)"
            @cancel="pi.cancelUpload()"
            @dismiss="pi.dismissUpload()"
            @activate="pi.activate($event)"
            @remove="pi.deleteBundle($event)"
            @rollback="pi.rollback()"
          />
          <DashboardDevicePiSystem
            :net="pi.net.value"
            :info="pi.info.value"
            :can-control="pi.canControl.value"
            :busy="pi.busy.value"
            @net-mode="pi.setNetMode($event)"
            @hotspot="pi.hotspotNow()"
            @reboot="pi.reboot()"
          />
        </div>

        <DashboardDevicePiPorts
          :hardware="pi.hardware.value"
          :motors="pi.status.value.motors ?? {}"
          :sensors="pi.status.value.sensors ?? {}"
          :busy="pi.busy.value"
          :can-control="pi.canControl.value"
          :can-test="pi.canTest.value"
          :test-blocked="testBlocked"
          :test-targets="pi.testTargets.value"
          :held-motor="pi.heldMotor.value"
          :audio-files="pi.audioFiles.value"
          :head-ports="headPorts"
          :head-profiles="headProfiles"
          :can-save-positions="canSavePositions"
          @save-position="(port, position) => savePosition(port, position)"
          @toggle="pi.toggleOverride($event)"
          @clear="pi.clearOverrides()"
          @unlock="pi.unlockMotor($event)"
          @test-on="(name, params) => pi.testOn(name, params)"
          @test-live="(name, params) => pi.testLive(name, params)"
          @test-off="pi.testOff($event)"
          @test-off-all="pi.testOffAll()"
          @motor-hold="(name, direction) => pi.motorHold(name, direction)"
          @motor-release="pi.motorRelease()"
        />
      </div>
    </template>

    <p v-else-if="pi.connection.value === 'connecting'" class="dp-hint">{{ t('dashboard.device.pi.connecting_hint') }}</p>
  </div>
</template>
