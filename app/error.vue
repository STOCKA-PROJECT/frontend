<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error.statusCode === 404)
const title = computed(() => isNotFound.value ? 'Página no encontrada' : 'Algo ha salido mal')
const message = computed(() => isNotFound.value
  ? 'La página que buscas ya no existe o nunca existió.'
  : props.error.statusMessage || 'Ha ocurrido un error inesperado. Inténtalo de nuevo.')

useSeoMeta({ title: title.value, robots: 'noindex' })

const handleHome = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg">
    <main class="wrap flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p class="mb-3 font-mono text-sm tracking-[.08em] text-accent-ink">
        ERROR · {{ error.statusCode }}
      </p>
      <h1 class="mb-4 font-semibold tracking-tighter2" style="font-size: clamp(32px, 4.5vw, 56px);">
        {{ title }}
      </h1>
      <p class="mb-8 max-w-[480px] text-base leading-relaxed text-ink-soft">
        {{ message }}
      </p>
      <button type="button" class="btn btn-primary btn-lg" @click="handleHome">
        Volver al inicio
      </button>
    </main>
  </div>
</template>
