import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  tone: 'default' | 'error'
  action?: { label: string; run: () => void }
}

const toasts = ref<Toast[]>([])
let nextId = 0

export function toast(
  message: string,
  options: { tone?: Toast['tone']; action?: Toast['action']; duration?: number } = {},
): number {
  const id = ++nextId
  toasts.value = [
    ...toasts.value.slice(-2),
    { id, message, tone: options.tone ?? 'default', action: options.action },
  ]
  setTimeout(() => dismissToast(id), options.duration ?? 5000)
  return id
}

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function useToasts() {
  return toasts
}
