<script setup lang="ts">
const { t } = useI18n()
const config = useRuntimeConfig()

const mcpUrl = computed(() => String(config.public.mcpUrl ?? ''))
const claudeCodeCommand = computed(() => `claude mcp add --transport http stocka ${mcpUrl.value}`)

const copied = ref<'url' | 'command' | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copy(text: string, what: 'url' | 'command') {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = what
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = null }, 2000)
  } catch {
    copied.value = null
  }
}
</script>

<template>
  <section class="rounded-[14px] border border-line bg-bg-card p-6 max-md:p-5">
    <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">
      {{ t('dashboard.account.assistant.section_title') }}
    </h2>
    <p class="mb-4 mt-1 max-w-[720px] text-[12.5px] leading-relaxed text-ink-muted">
      {{ t('dashboard.account.assistant.subtitle') }}
    </p>

    <label class="mb-1 block text-[12px] font-medium text-ink-soft">
      {{ t('dashboard.account.assistant.url_label') }}
    </label>
    <div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
      <code class="flex-1 truncate rounded-md border border-line bg-bg-soft px-3 py-2 text-[13px] text-ink">{{ mcpUrl }}</code>
      <button type="button"
        class="shrink-0 rounded-md border border-line px-3 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-bg-elevated"
        @click="copy(mcpUrl, 'url')">
        {{ copied === 'url' ? t('dashboard.account.assistant.copied') : t('dashboard.account.assistant.copy') }}
      </button>
    </div>

    <h3 class="mb-2 text-[12px] font-medium uppercase tracking-[0.04em] text-ink-muted">
      {{ t('dashboard.account.assistant.steps_title') }}
    </h3>
    <ol class="flex list-decimal flex-col gap-2 pl-5 text-[13px] leading-relaxed text-ink-soft">
      <li>{{ t('dashboard.account.assistant.step_claude_web') }}</li>
      <li>
        {{ t('dashboard.account.assistant.step_claude_code') }}
        <div class="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code class="flex-1 truncate rounded-md border border-line bg-bg-soft px-3 py-1.5 text-[12.5px] text-ink">{{ claudeCodeCommand }}</code>
          <button type="button"
            class="shrink-0 rounded-md border border-line px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-bg-elevated"
            @click="copy(claudeCodeCommand, 'command')">
            {{ copied === 'command' ? t('dashboard.account.assistant.copied') : t('dashboard.account.assistant.copy') }}
          </button>
        </div>
      </li>
      <li>{{ t('dashboard.account.assistant.step_claude_desktop') }}</li>
    </ol>

    <p class="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
      {{ t('dashboard.account.assistant.scopes_hint') }}
      {{ t('dashboard.account.assistant.revoke_hint') }}
    </p>
  </section>
</template>
