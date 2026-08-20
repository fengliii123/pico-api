// Settings store: simple localStorage-backed key/value settings.

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'eye'

export const useSettingsStore = defineStore('settings', () => {
  const autoSaveHistory = ref(load('autoSaveHistory', true))
  // When true, the background service worker reads the target URL's cookies
  // from the browser cookie jar (chrome.cookies API) and injects them as a
  // Cookie header on the outgoing request. Default ON — the whole point of
  // being a Chrome extension is that "logged-in API calls just work".
  const sendBrowserCookies = ref(load('sendBrowserCookies', true))
  // 'eye' = eye-care (豆沙绿); previously we had 'auto' which followed OS
  // preference but users said it looked identical to 'light' in most setups.
  // Migrate any stored 'auto' value to 'light' so the switch stays sane.
  const theme = ref<Theme>(migrateTheme(load<Theme>('theme', 'light')))

  watch(autoSaveHistory, () => save('autoSaveHistory', autoSaveHistory.value))
  watch(sendBrowserCookies, () => save('sendBrowserCookies', sendBrowserCookies.value))
  watch(theme, () => {
    save('theme', theme.value)
    applyTheme(theme.value)
  })

  function load<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`mp2:${key}`)
      if (v == null) return fallback
      return JSON.parse(v) as T
    } catch {
      return fallback
    }
  }

  function save(key: string, value: unknown) {
    try {
      localStorage.setItem(`mp2:${key}`, JSON.stringify(value))
    } catch {
      // ignore
    }
  }

  return { autoSaveHistory, sendBrowserCookies, theme }
})

function migrateTheme(v: Theme | 'auto'): Theme {
  // 'auto' is no longer offered — fall back to 'light' so old persisted
  // values don't render the segmented control without a selection.
  return v === 'auto' ? 'light' : v
}

// Apply the chosen theme to <html data-theme="…">. Called once on boot
// (in main.ts) and again whenever the store value changes (watcher).
export function applyTheme(setting: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = setting
}