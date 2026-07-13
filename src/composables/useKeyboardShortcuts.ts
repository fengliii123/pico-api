// Keyboard shortcuts composable: centralized shortcut handling with
// command palette integration.

import { onMounted, onBeforeUnmount, ref, readonly } from 'vue'

export interface Shortcut {
  key: string           // display label like "⌘K"
  description: string
  action: () => void
  /** Key combo as detected by onKeyDown, e.g. "meta+k" or "ctrl+shift+k" */
  combo: string
  /** Internal ID for tracking */
  id: string
  /** Whether this shortcut is currently enabled */
  enabled?: boolean
  /** Category for grouping in help UI */
  category?: 'navigation' | 'request' | 'collection' | 'environment' | 'general'
}

const shortcuts = ref<Shortcut[]>([])
const isCommandPaletteOpen = ref(false)
const isQuickSwitchOpen = ref(false)

function getCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('meta')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

function onKeyDown(e: KeyboardEvent) {
  // Don't intercept when typing in input/textarea/select elements
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
    // Allow Cmd+P for quick switch even in input (useful for fuzzy search)
    const combo = getCombo(e)
    if (combo !== 'meta+p' && combo !== 'ctrl+p') return
  }

  const combo = getCombo(e)

  // Cmd+K / Ctrl+K: Command palette
  if (combo === 'meta+k' || combo === 'ctrl+k') {
    e.preventDefault()
    isCommandPaletteOpen.value = !isCommandPaletteOpen.value
    return
  }

  // Cmd+P / Ctrl+P: Quick switch request
  if (combo === 'meta+p' || combo === 'ctrl+p') {
    e.preventDefault()
    isQuickSwitchOpen.value = !isQuickSwitchOpen.value
    return
  }

  // Cmd+D / Ctrl+D: Duplicate current request
  if (combo === 'meta+d' || combo === 'ctrl+d') {
    e.preventDefault()
    const duplicate = shortcuts.value.find(s => s.id === 'duplicate-request')
    if (duplicate?.enabled !== false) duplicate?.action()
    return
  }

  // Cmd+Shift+K / Ctrl+Shift+K: Quick switch environment
  if (combo === 'meta+shift+k' || combo === 'ctrl+shift+k') {
    e.preventDefault()
    const switchEnv = shortcuts.value.find(s => s.id === 'switch-environment')
    if (switchEnv?.enabled !== false) switchEnv?.action()
    return
  }

  // Cmd+Shift+H / Ctrl+Shift+H: Open history
  if (combo === 'meta+shift+h' || combo === 'ctrl+shift+h') {
    e.preventDefault()
    const history = shortcuts.value.find(s => s.id === 'open-history')
    if (history?.enabled !== false) history?.action()
    return
  }

  // Esc: Close modals/command palette
  if (e.key === 'Escape') {
    if (isCommandPaletteOpen.value) {
      isCommandPaletteOpen.value = false
      return
    }
    if (isQuickSwitchOpen.value) {
      isQuickSwitchOpen.value = false
      return
    }
  }

  // Other registered shortcuts
  for (const shortcut of shortcuts.value) {
    if (shortcut.combo === combo && shortcut.enabled !== false) {
      e.preventDefault()
      shortcut.action()
      return
    }
  }
}

export function registerShortcut(shortcut: Shortcut) {
  const existing = shortcuts.value.findIndex(s => s.id === shortcut.id)
  if (existing >= 0) {
    shortcuts.value[existing] = shortcut
  } else {
    shortcuts.value = [...shortcuts.value, shortcut]
  }
}

export function useKeyboardShortcuts() {
  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
  })

  return {
    shortcuts: readonly(shortcuts),
    isCommandPaletteOpen: readonly(isCommandPaletteOpen),
    isQuickSwitchOpen: readonly(isQuickSwitchOpen),
    openCommandPalette: () => { isCommandPaletteOpen.value = true },
    closeCommandPalette: () => { isCommandPaletteOpen.value = false },
    toggleCommandPalette: () => { isCommandPaletteOpen.value = !isCommandPaletteOpen.value },
    openQuickSwitch: () => { isQuickSwitchOpen.value = true },
    closeQuickSwitch: () => { isQuickSwitchOpen.value = false }
  }
}
