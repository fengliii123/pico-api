// Capture store: bridges the background service worker's capture engine
// to the Vue side. The store owns the live list of captured requests in
// the side panel / options page; the SW broadcasts each new request and
// each update so we don't have to poll.
//
// `tabId` is the tab being captured — usually the active tab the user
// was on when they hit "Start capture". We resolve it once at start
// time via chrome.tabs.query and stash it.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CapturedRequest, CaptureStatus } from '@/core/types'
import { useSettingsStore } from '@/stores/settings'
import { hasDebugger } from '@/core/permissions'

declare const chrome: any | undefined

interface BridgeReply<T> {
  id: string
  ok: true
  result: T
}
interface BridgeError {
  id: string
  ok: false
  error: { message: string; errorKind?: string }
}

let messageSeq = 0
async function send<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  const id = `cap-${++messageSeq}`
  return new Promise<T>((resolve, reject) => {
    try {
      const message = { type, id, ...payload }
      chrome.runtime.sendMessage(message, (response: BridgeReply<T> | BridgeError) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message ?? 'bridge error'))
          return
        }
        if (response && response.ok) resolve(response.result)
        else reject(new Error(response?.error?.message ?? 'unknown error'))
      })
    } catch (e: any) {
      reject(e)
    }
  })
}

// Resolve the currently-active tab in the focused window. Used at start
// time so the user doesn't have to know the tabId themselves.
//
// When called from the options page, `currentWindow` is the window the
// options tab lives in, and `active: true` returns the options page
// itself — debugger would attach to the options tab and capture nothing
// useful. In that case fall back to the most recently focused non-
// internal tab in the same window so the user gets the page they
// actually want to debug.
function isInternalTabUrl(url: string | undefined): boolean {
  if (!url) return false
  return (
    url.startsWith('chrome-extension://') ||
    url.startsWith('chrome://') ||
    url.startsWith('devtools://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')
  )
}

async function activeTabId(): Promise<number> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const active = tabs?.[0]
  if (active?.id && !isInternalTabUrl(active.url)) return active.id

  // active tab is the options page itself (or another internal page) —
  // fall back to the most recently activated real tab in this window.
  const allTabs = await chrome.tabs.query({ currentWindow: true })
  const fallback = [...allTabs]
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
    .find((t) => t.id != null && !isInternalTabUrl(t.url))
  if (fallback?.id) return fallback.id

  throw new Error('No active tab found')
}

export const useCaptureStore = defineStore('capture', () => {
  const status = ref<CaptureStatus>('idle')
  const tabId = ref<number | null>(null)
  const requests = ref<CapturedRequest[]>([])
  const error = ref<string>('')

  // One-shot listener registration on first store use. Subsequent calls
  // reuse the same listener.
  let listening = false
  function ensureListener() {
    if (listening) return
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return
    listening = true
    chrome.runtime.onMessage.addListener((msg: any) => {
      if (msg?.type !== 'capture:event') return
      if (msg.tabId !== tabId.value) return
      const ev = msg.event
      if (!ev) return
      if (ev.kind === 'added' && ev.request) {
        requests.value.push(ev.request)
      } else if (ev.kind === 'updated' && ev.request) {
        const idx = requests.value.findIndex(r => r.cdpRequestId === ev.request.cdpRequestId)
        if (idx >= 0) {
          requests.value.splice(idx, 1, ev.request)
        } else {
          // Update event for a request we missed the "added" for — just
          // append rather than lose it.
          requests.value.push(ev.request)
        }
      } else if (ev.kind === 'session-end') {
        // SW killed the session without us asking (tab closed, SW
        // suspended, another debugger stole the target). Flip our status
        // so the UI's status pill reflects reality.
        status.value = 'stopped'
      }
    })
  }

  async function start() {
    error.value = ''
    try {
      // Defensive check: the CapturePanel click handler is the real gate
      // (chrome.permissions.request must run inside a user gesture), but
      // we re-check here so a stray call from elsewhere fails cleanly
      // rather than hitting chrome.debugger.attach with a confusing error.
      const granted = await hasDebugger()
      if (!granted) {
        error.value = 'Capture requires the debugger permission.'
        status.value = 'idle'
        return
      }

      const tid = await activeTabId()
      // Pull the filter at call time rather than capturing it in the closure —
      // the user may change the setting between two captures and we want the
      // latest value each time start() runs.
      const settings = useSettingsStore()
      const result = await send<{ status: CaptureStatus }>('capture:start', {
        tabId: tid,
        filterMode: settings.captureFilterMode
      })
      tabId.value = tid
      status.value = result.status
      requests.value = []
      ensureListener()
    } catch (e: any) {
      error.value = String(e?.message ?? e)
      status.value = 'error'
    }
  }

  async function stop() {
    error.value = ''
    try {
      if (tabId.value == null) return
      await send('capture:stop', { tabId: tabId.value })
      status.value = 'stopped'
    } catch (e: any) {
      error.value = String(e?.message ?? e)
      status.value = 'error'
    }
  }

  async function refresh() {
    if (tabId.value == null) return
    try {
      const result = await send<{ requests: CapturedRequest[]; status: CaptureStatus }>('capture:list', { tabId: tabId.value })
      requests.value = result.requests
      status.value = result.status
    } catch (e: any) {
      error.value = String(e?.message ?? e)
    }
  }

  async function clear() {
    if (tabId.value == null) return
    try {
      await send('capture:clear', { tabId: tabId.value })
      requests.value = []
    } catch (e: any) {
      error.value = String(e?.message ?? e)
    }
  }

  return {
    status,
    tabId,
    requests,
    error,
    start,
    stop,
    refresh,
    clear
  }
})
