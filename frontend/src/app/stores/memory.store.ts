import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MemoryEvent, MemoryPlan } from '@/shared/lib/types'
import { createApiClient } from '@/shared/lib/apiClient'

export const useMemoryStore = defineStore('memory', () => {
  const latest = ref<MemoryEvent | null>(null)
  const plan = ref<MemoryPlan | null>(null)
  const running = ref(false)
  const api = createApiClient()
  let cleanup: (() => void) | null = null

  function start(): void {
    if (cleanup) return
    running.value = true
    cleanup = api.onMemory((e) => { latest.value = e })
  }

  function stop(): void {
    cleanup?.()
    cleanup = null
    running.value = false
  }

  function setPlan(value: MemoryPlan | null): void {
    plan.value = value
  }

  async function refreshPlan(): Promise<void> {
    try {
      plan.value = await api.getMemoryPlan()
    } catch {
      // Backend unavailable — keep the last known plan.
    }
  }

  return { latest, plan, running, start, stop, setPlan, refreshPlan }
})
