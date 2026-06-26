import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Settings } from '@/shared/lib/types'
import { DEFAULT_SETTINGS } from '@/shared/lib/constants'
import { applyTheme } from '@/shared/lib/designTokens'
import { createApiClient } from '@/shared/lib/apiClient'

const STORAGE_KEY = 'chaoxing-assistant-settings'
const api = createApiClient()

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    }
  } catch {
    // corrupted storage — fall through
  }
  return { ...DEFAULT_SETTINGS }
}

function saveToStorage(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSync(settings: Settings): void {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    api.setSettings(settings).catch(() => {
      // backend not available — localStorage is source of truth
    })
  }, 1000)
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(loadFromStorage())

  // Apply theme on load
  applyTheme(settings.value.theme)

  // Persist on change
  watch(
    settings,
    (val) => {
      saveToStorage(val)
      applyTheme(val.theme)
      debouncedSync(val)
    },
    { deep: false },
  )

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    // Replace the whole object to trigger shallow watcher — avoids the
    // performance cost and unnecessary localStorage writes of deep:true.
    settings.value = { ...settings.value, [key]: value }
  }

  function setTheme(theme: 'light' | 'dark'): void {
    settings.value = { ...settings.value, theme }
  }

  function resetSettings(): void {
    settings.value = { ...DEFAULT_SETTINGS }
  }

  return { settings, updateSetting, setTheme, resetSettings }
})
