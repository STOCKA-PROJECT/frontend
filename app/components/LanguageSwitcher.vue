<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

withDefaults(defineProps<{
  variant?: 'default' | 'ghost'
  align?: 'left' | 'right'
}>(), {
  variant: 'default',
  align: 'right'
})

const { locale, locales, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const open = shallowRef(false)
const rootRef = ref<HTMLElement | null>(null)

const available = computed(() => {
  const list = (locales.value as Array<{ code: string; name?: string }>)
  return list.map(l => ({ code: l.code, name: l.name ?? l.code.toUpperCase() }))
})

const currentName = computed(() => {
  return available.value.find(l => l.code === locale.value)?.name ?? locale.value
})

const currentCode = computed(() => locale.value.toUpperCase())

function onDocClick(e: MouseEvent) {
  if (!rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootRef" class="lang-switcher relative inline-flex">
    <button
      type="button"
      class="lang-trigger"
      :class="variant === 'ghost' ? 'lang-trigger-ghost' : 'lang-trigger-default'"
      :aria-label="t('common.change_language')"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :title="t('common.change_language')"
      @click="open = !open"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <span class="lang-trigger-code">{{ currentCode }}</span>
      <span class="sr-only">· {{ currentName }}</span>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        :class="['lang-caret', open ? 'lang-caret-open' : '']"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      leave-active-class="transition duration-100 ease-in"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <ul
        v-if="open"
        role="listbox"
        :aria-label="t('common.language')"
        class="lang-menu"
        :class="align === 'right' ? 'right-0' : 'left-0'"
      >
        <li v-for="opt in available" :key="opt.code">
          <NuxtLink
            :to="switchLocalePath(opt.code as 'es' | 'ca' | 'en')"
            role="option"
            :aria-selected="opt.code === locale"
            class="lang-option"
            :class="opt.code === locale ? 'lang-option-active' : ''"
            :hreflang="opt.code"
            @click="open = false"
          >
            <span class="lang-option-code">{{ opt.code.toUpperCase() }}</span>
            <span class="lang-option-name">{{ opt.name }}</span>
            <svg
              v-if="opt.code === locale"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="ml-auto"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </NuxtLink>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.lang-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: var(--c-ink-soft);
  background: transparent;
  border: 1px solid var(--c-line);
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
}
.lang-trigger:hover {
  color: var(--c-ink);
  border-color: var(--c-line-strong);
  background: color-mix(in oklab, var(--c-ink) 4%, transparent);
}
.lang-trigger-ghost {
  border-color: transparent;
}
.lang-trigger-ghost:hover {
  border-color: var(--c-line);
}
.lang-trigger-code {
  font-variant: small-caps;
  letter-spacing: .03em;
}
.lang-caret {
  transition: transform .18s ease;
}
.lang-caret-open {
  transform: rotate(180deg);
}

.lang-menu {
  position: absolute;
  top: calc(100% + 6px);
  z-index: 80;
  min-width: 180px;
  padding: 4px;
  background: var(--c-bg-card);
  border: 1px solid var(--c-line);
  border-radius: 10px;
  box-shadow: var(--shadow-md, 0 8px 24px rgba(0, 0, 0, .08));
  list-style: none;
  margin: 0;
}

.lang-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 7px;
  color: var(--c-ink-soft);
  font-size: 13.5px;
  text-decoration: none;
  transition: background .12s, color .12s;
}
.lang-option:hover {
  background: color-mix(in oklab, var(--c-ink) 5%, transparent);
  color: var(--c-ink);
}
.lang-option-active {
  background: color-mix(in oklab, var(--c-accent) 10%, transparent);
  color: var(--c-ink);
}
.lang-option-code {
  display: inline-flex;
  min-width: 28px;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .04em;
  color: var(--c-ink-muted);
  background: var(--c-bg-soft, color-mix(in oklab, var(--c-ink) 4%, transparent));
  border-radius: 5px;
  padding: 2px 6px;
}
.lang-option-active .lang-option-code {
  color: var(--c-accent-ink);
  background: color-mix(in oklab, var(--c-accent) 18%, transparent);
}
.lang-option-name {
  font-weight: 500;
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
