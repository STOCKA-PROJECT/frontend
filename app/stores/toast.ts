import { defineStore } from 'pinia'

export type ToastType = 'error' | 'success' | 'info'

export interface Toast {
  id: number
  type: ToastType
  title: string
  description: string
  /** ms hasta auto-dismiss; 0 desactiva el cierre automático. */
  timeout: number
}

export interface ToastInput {
  type?: ToastType
  title?: string
  description: string
  timeout?: number
}

const DEFAULT_TIMEOUT = 5000

export const useToastStore = defineStore('toast', () => {
  const items = ref<Toast[]>([])
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  let nextId = 1

  function dismiss(id: number) {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    items.value = items.value.filter(t => t.id !== id)
  }

  function push(input: ToastInput): number {
    const id = nextId++
    const toast: Toast = {
      id,
      type: input.type ?? 'info',
      title: input.title ?? '',
      description: input.description,
      timeout: input.timeout ?? DEFAULT_TIMEOUT
    }
    items.value = [...items.value, toast]
    if (toast.timeout > 0) {
      timers.set(id, setTimeout(() => dismiss(id), toast.timeout))
    }
    return id
  }

  function clear() {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    items.value = []
  }

  return { items, push, dismiss, clear }
})
