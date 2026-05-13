<script setup lang="ts">
import type { LifecycleAction, NotificationPreferenceResponseDto, PieceScope } from '~/types/api'

const props = defineProps<{
  preference: NotificationPreferenceResponseDto
  saving: boolean
}>()

const emit = defineEmits<{
  (e: 'update', payload: NotificationPreferenceResponseDto): void
}>()

const { t } = useI18n()

const RESOURCES: Array<{
  key: 'pieces' | 'locations' | 'pieceTypes'
  labelKey: string
}> = [
  { key: 'pieces', labelKey: 'dashboard.account.notifications.resource.pieces' },
  { key: 'locations', labelKey: 'dashboard.account.notifications.resource.locations' },
  { key: 'pieceTypes', labelKey: 'dashboard.account.notifications.resource.pieceTypes' }
]
const ACTIONS: LifecycleAction[] = ['CREATED', 'EDITED', 'DELETED']

function has(actions: LifecycleAction[], action: LifecycleAction): boolean {
  return actions.includes(action)
}

function toggle(resource: 'pieces' | 'locations' | 'pieceTypes', action: LifecycleAction) {
  const current = props.preference[resource] ?? []
  const next = current.includes(action)
    ? current.filter(a => a !== action)
    : [...current, action]
  emit('update', { ...props.preference, [resource]: next })
}

function setScope(scope: PieceScope) {
  emit('update', { ...props.preference, pieceScope: scope })
}

const piecesEnabled = computed(() => (props.preference.pieces?.length ?? 0) > 0)
</script>

<template>
  <article class="rounded-[12px] border border-line bg-bg p-4 max-md:p-3.5">
    <header class="mb-3 flex items-baseline justify-between gap-3">
      <h3 class="text-[14px] font-semibold tracking-[-0.005em] text-ink">
        {{ preference.organizationName }}
      </h3>
      <span class="text-[12px] text-ink-muted">{{ preference.organizationSlug }}</span>
    </header>

    <ul class="flex flex-col gap-3">
      <li v-for="resource in RESOURCES" :key="resource.key"
          class="flex flex-col gap-1.5 max-sm:items-start sm:flex-row sm:items-center sm:justify-between">
        <span class="text-[13px] font-medium text-ink">
          {{ t(resource.labelKey) }}
        </span>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <label v-for="action in ACTIONS" :key="action"
                 class="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-soft">
            <input type="checkbox" :checked="has(preference[resource.key] ?? [], action)"
                   :disabled="saving"
                   class="h-4 w-4 cursor-pointer rounded border border-line accent-accent disabled:cursor-progress"
                   @change="toggle(resource.key, action)">
            {{ t(`dashboard.account.notifications.action.${action}`) }}
          </label>
        </div>
      </li>

      <li v-if="piecesEnabled"
          class="flex flex-col gap-1.5 border-t border-line/70 pt-3 max-sm:items-start sm:flex-row sm:items-center sm:justify-between">
        <span class="text-[12.5px] text-ink-soft">
          {{ t('dashboard.account.notifications.scope_label') }}
        </span>
        <select :value="preference.pieceScope"
                :disabled="saving"
                class="h-9 rounded-[8px] border border-line bg-field px-2.5 text-[13px] text-ink outline-none transition-[border-color,background,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:bg-field-focus disabled:cursor-progress"
                @change="setScope(($event.target as HTMLSelectElement).value as PieceScope)">
          <option value="ALL">{{ t('dashboard.account.notifications.scope.ALL') }}</option>
          <option value="OWNED_ONLY">{{ t('dashboard.account.notifications.scope.OWNED_ONLY') }}</option>
        </select>
      </li>
    </ul>
  </article>
</template>
