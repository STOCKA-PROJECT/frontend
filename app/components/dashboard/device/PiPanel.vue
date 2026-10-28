<script setup lang="ts">
import type { DeviceResponseDto, OrganizationRole } from '~/types/api'

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

const isSpectator = computed(() => props.role === 'SPECTATOR')
/** Why the ports cannot be tested now, when it is worth saying. */
const testBlocked = computed(() => (pi.status.value?.rehearsal ? 'rehearsal' : pi.playing.value ? 'playing' : null))
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
