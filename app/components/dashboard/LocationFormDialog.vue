<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  mode: 'create-root' | 'create-child' | 'rename'
  parentName?: string
  initialName?: string
  initialDescription?: string
  loading?: boolean
  errorMsg?: string | null
}>(), {
  loading: false,
  errorMsg: null,
  initialName: '',
  initialDescription: ''
})

const emit = defineEmits<{
  submit: [payload: { name: string; description?: string }]
  close: []
}>()

const { t } = useI18n()

const name = ref(props.initialName)
const description = ref(props.initialDescription)
const nameInput = ref<HTMLInputElement | null>(null)

watch(() => props.open, (open) => {
  if (open) {
    name.value = props.initialName
    description.value = props.initialDescription
    nextTick(() => nameInput.value?.focus())
  }
})

onMounted(() => {
  if (props.open) nextTick(() => nameInput.value?.focus())
})

const title = computed(() => {
  if (props.mode === 'rename') return t('dashboard.locations.rename_title')
  if (props.mode === 'create-child') return t('dashboard.locations.new_child_title', { parent: props.parentName ?? '' })
  return t('dashboard.locations.new_root_title')
})

const submitLabel = computed(() => props.mode === 'rename'
  ? t('dashboard.locations.save')
  : t('dashboard.locations.create'))

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed || props.loading) return
  emit('submit', {
    name: trimmed,
    description: description.value.trim() ? description.value.trim() : undefined
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" role="presentation"
      @click="onBackdropClick" @keydown="onKey">
      <div role="dialog" aria-modal="true" :aria-label="title"
        class="flex w-full max-w-[440px] max-h-[calc(100vh-24px)] flex-col rounded-[14px] border border-line bg-bg-card shadow-card">
        <header class="flex-shrink-0 border-b border-line px-5 py-4 sm:px-6">
          <h2 class="text-[17px] font-semibold tracking-[-0.015em] text-ink">{{ title }}</h2>
          <p v-if="mode === 'create-child'" class="mt-1 text-[12.5px] text-ink-muted">
            {{ t('dashboard.locations.new_child_subtitle') }}
          </p>
        </header>

        <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="submit">
          <div class="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <div v-if="errorMsg" role="alert"
              class="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {{ errorMsg }}
            </div>

            <div class="flex flex-col gap-3.5">
              <div class="flex flex-col gap-1.5">
                <label for="loc-name" class="text-[12.5px] font-medium tracking-[-0.005em] text-ink-soft">
                  {{ t('dashboard.locations.field_name') }}
                </label>
                <input id="loc-name" ref="nameInput" v-model="name" type="text" required maxlength="255"
                  :placeholder="t('dashboard.locations.field_name_placeholder')"
                  class="h-11 w-full rounded-[10px] border border-line bg-field px-3.5 text-[14.5px] text-ink outline-none transition-[border-color,background,box-shadow] duration-150 placeholder:text-ink-muted hover:border-line-strong focus:border-accent focus:bg-field-focus">
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="loc-desc" class="text-[12.5px] font-medium tracking-[-0.005em] text-ink-soft">
                  {{ t('dashboard.locations.field_description') }}
                </label>
                <textarea id="loc-desc" v-model="description" rows="3"
                  :placeholder="t('dashboard.locations.field_description_placeholder')"
                  class="rounded-[10px] border border-line bg-field px-3.5 py-2.5 text-[14px] text-ink outline-none transition-[border-color,background,box-shadow] duration-150 placeholder:text-ink-muted hover:border-line-strong focus:border-accent focus:bg-field-focus" />
              </div>
            </div>
          </div>

          <footer class="flex-shrink-0 border-t border-line px-5 py-4 sm:px-6">
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" class="dialog-btn" :disabled="loading" @click="emit('close')">
                {{ t('common.close') }}
              </button>
              <button type="submit" class="dialog-btn dialog-btn-primary"
                :disabled="!name.trim() || loading" :aria-busy="loading">
                {{ submitLabel }}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--c-ink) 30%, transparent);
  backdrop-filter: blur(2px);
  padding: 12px;
}
.dialog-btn {
  height: 40px;
  padding: 0 16px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 500;
  border: 1px solid var(--c-line);
  background: var(--c-bg-card);
  color: var(--c-ink);
  transition: background .15s, border-color .15s;
}
.dialog-btn:hover:not(:disabled) { background: var(--c-bg-soft); }
.dialog-btn:disabled { opacity: .5; cursor: not-allowed; }
.dialog-btn-primary {
  background: var(--c-ink);
  color: var(--c-bg-card);
  border-color: var(--c-ink);
}
.dialog-btn-primary:hover:not(:disabled) {
  background: color-mix(in oklab, var(--c-ink) 90%, transparent);
}
</style>
