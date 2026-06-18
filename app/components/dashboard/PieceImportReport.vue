<script setup lang="ts">
import type { PieceImportReportDto } from '~/types/api'

const props = defineProps<{ report: PieceImportReportDto }>()

const { t } = useI18n()

const errorRows = computed(() => props.report.rows.filter(r => r.action === 'ERROR'))

const statusNote = computed(() => {
  if (props.report.applied) return t('dashboard.pieces.import_export.report.applied')
  if (props.report.failed > 0) return t('dashboard.pieces.import_export.report.has_errors')
  return t('dashboard.pieces.import_export.report.will_apply')
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="chip">{{ t('dashboard.pieces.import_export.report.total', { n: report.totalRows }) }}</span>
      <span v-if="report.created > 0" class="chip chip-ok">
        {{ t('dashboard.pieces.import_export.report.created', { n: report.created }) }}
      </span>
      <span v-if="report.updated > 0" class="chip chip-ok">
        {{ t('dashboard.pieces.import_export.report.updated', { n: report.updated }) }}
      </span>
      <span v-if="report.skipped > 0" class="chip">
        {{ t('dashboard.pieces.import_export.report.skipped', { n: report.skipped }) }}
      </span>
      <span v-if="report.failed > 0" class="chip chip-error">
        {{ t('dashboard.pieces.import_export.report.failed', { n: report.failed }) }}
      </span>
    </div>

    <p class="text-[12.5px] leading-relaxed text-ink-soft">{{ statusNote }}</p>

    <div v-if="report.warnings.length" class="rounded-lg border border-line bg-warn-soft px-3 py-2">
      <p class="text-[12.5px] font-medium text-warn-ink">
        {{ t('dashboard.pieces.import_export.report.warnings_title') }}
      </p>
      <ul class="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px] text-ink-soft">
        <li v-for="(w, i) in report.warnings" :key="i">{{ w }}</li>
      </ul>
    </div>

    <div
      v-if="errorRows.length"
      class="max-h-[220px] overflow-y-auto rounded-lg border border-line bg-danger-soft px-3 py-2"
    >
      <p class="text-[12.5px] font-medium text-danger">
        {{ t('dashboard.pieces.import_export.report.errors_title') }}
      </p>
      <ul class="mt-1 space-y-1.5 text-[12.5px]">
        <li v-for="row in errorRows" :key="row.rowNumber">
          <span class="font-medium text-ink">
            {{ t('dashboard.pieces.import_export.report.row', { n: row.rowNumber }) }}
          </span>
          <span v-if="row.name" class="text-ink-soft"> · {{ row.name }}</span>
          <ul class="mt-0.5 list-disc space-y-0.5 pl-4 text-ink-soft">
            <li v-for="(e, i) in row.errors" :key="i">{{ e }}</li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-soft);
  color: var(--c-ink-soft);
}
.chip-ok {
  border-color: color-mix(in oklab, var(--c-accent) 35%, transparent);
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
}
.chip-error {
  border-color: color-mix(in oklab, var(--c-danger) 35%, transparent);
  background: var(--c-danger-soft);
  color: var(--c-danger);
}
</style>
