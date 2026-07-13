// Capture engine: attaches chrome.debugger to a target tab and collects
// every network request the page makes into an in-memory list.
//
// Lifecycle:
//   startCapture(tabId)  → attach + Network.enable + register onEvent
//   (events stream in)   → onEvent dispatches Network.requestWillBeSent
//                          / responseReceived / loadingFinished
//   stopCapture(tabId)   → Network.disable + detach + unregister
//
// Each batch gets a fresh captureId so the UI can clear or save as a
// group. SW restart loses the in-memory state — that's intentional,
// capture is a transient session.
//
// The "another client is debugging this tab" error is the common failure
// mode (the user has DevTools open). We surface that as a typed error
// the UI can render specifically.

import type { CapturedRequest } from '../core/types'
import { uid } from '../utils/id'

export type CaptureFilterMode = 'api-only' | 'all'

// URL schemes we consider "real network traffic" worth surfacing to the
// user. CDP will happily report Fetch/XHR to a number of in-page schemes
// (`chrome-extension://`, `data:`, `blob:`, `file:`, `chrome://`,
// `devtools://`) that are framework/internal noise, not APIs the user is
// trying to debug. When `api-only` is on, we keep just http(s) and drop
// the rest. When `all` is on we still drop the ones that are never useful
// (see shouldAlwaysDrop).
const API_ONLY_SCHEMES = new Set(['http:', 'https:'])

// Schemes that should never appear in the captured list, regardless of
// filter mode. These are Chrome-internal pseudo-URLs that show up in
// CDP when the browser itself fails to load a popup / extension
// resource — e.g. `chrome-extension://invalid/<stack trace>` is what
// Chrome's error reporter shows up as. There is no real request the
// user can replay; surfacing it just confuses the export. The same
// reasoning applies to browser chrome / devtools / file pages.
const ALWAYS_DROP_SCHEMES = new Set([
  'chrome-extension:',
  'data:',
  'blob:',
  'file:',
  'chrome:',
  'chrome-search:',
  'chrome-untrusted:',
  'devtools:'
])

// `chrome-extension://invalid/...` is a synthetic URL Chrome emits for
// internal errors (e.g. the toolbar popup failed to load). The user has
// no way to inspect or replay it — drop it everywhere.
const SYNTHETIC_INVALID_EXTENSION = /^chrome-extension:\/\/invalid\//i

/**
 * Pure decision function: should this CDP request be tracked, given the
 * locked-in filter mode for this capture session?
 *
 * Extracted as a free function so it can be unit-tested in isolation
 * without touching chrome.debugger or the global `tabs` map.
 */
export function shouldCapture(
  url: string | undefined,
  resourceType: string | undefined,
  filterMode: CaptureFilterMode
): boolean {
  if (!url) return false
  if (SYNTHETIC_INVALID_EXTENSION.test(url)) return false

  let scheme = ''
  try {
    // URL parsing can throw for malformed URLs; treat those as drop.
    scheme = new URL(url).protocol
  } catch {
    return false
  }

  if (ALWAYS_DROP_SCHEMES.has(scheme)) return false

  if (filterMode === 'api-only') {
    // CDP occasionally reports a request with no `type` — typically a
    // preflight or a non-standard initiator. Err on the side of
    // capturing in 'all' mode, but in api-only we require an explicit
    // type match so the list stays focused.
    if (!resourceType) return false
    if (resourceType !== 'Fetch' && resourceType !== 'XHR') return false
    if (!API_ONLY_SCHEMES.has(scheme)) return false
  }

  return true
}

// Tab-scoped state. `current` is the batch being filled; once the user
// stops, the list stays around so the UI can keep showing it until they
// start again or close the side panel.
interface TabCapture {
  tabId: number
  captureId: string
  status: 'capturing' | 'stopped'
  requests: CapturedRequest[]
  // CDP requestId → index into requests[]. Lets response/finished events
  // find their originating request in O(1) without rescanning.
  indexByRequestId: Map<string, number>
  // Filter locked in at startCapture time. 'api-only' keeps Fetch/XHR
  // only; 'all' lets every resource type through. Locked per-session so
  // toggling the global setting mid-capture doesn't change what the user
  // is already looking at.
  filterMode: CaptureFilterMode
}

const tabs = new Map<number, TabCapture>()

// chrome global typed narrowly. The full @types/chrome package would
// give us better fidelity but adding a dev-only dep just for this file
// isn't worth the footprint.
const c = (globalThis as any).chrome as
  | undefined
  | {
      debugger?: {
        attach: (target: { tabId: number }, version: string) => Promise<void>
        detach: (target: { tabId: number }) => Promise<void>
        sendCommand: (target: { tabId: number }, method: string, params?: any) => Promise<any>
        onEvent: {
          addListener: (cb: (source: any, method: string, params?: any) => void) => void
          removeListener: (cb: (cb: any) => void) => void
        }
      }
      tabs?: {
        onRemoved?: { addListener: (cb: (tabId: number) => void) => void }
      }
      runtime?: {
        id?: string
        sendMessage: (msg: any) => void
        onSuspend?: { addListener: (cb: () => void) => void }
      }
    }

const ALL_LISTENERS_REGISTERED = '_capture_listeners_registered'

function ensureGlobalListeners(): void {
  if (!c) return
  if ((c as any)[ALL_LISTENERS_REGISTERED]) return
  ;(c as any)[ALL_LISTENERS_REGISTERED] = true

  // Network events arrive on this single global callback; we filter by
  // tabId ourselves (every attached tab fires through here).
  c.debugger?.onEvent.addListener((source: any, method: string, params?: any) => {
    const tabId = source?.tabId
    if (typeof tabId !== 'number') return
    handleCdpEvent(tabId, method, params)
  })

  // Auto-detach when a tab is closed mid-capture so we don't leave a
  // dangling debugger session.
  c.tabs?.onRemoved?.addListener((tabId: number) => {
    const tc = tabs.get(tabId)
    if (!tc) return
    void cleanupTab(tabId)
  })

  // SW is about to be killed (Chrome's 30s idle policy). Detach cleanly
  // so the user doesn't see the "extension is debugging this tab" banner
  // stick around forever.
  c.runtime?.onSuspend?.addListener(() => {
    for (const tabId of Array.from(tabs.keys())) {
      void cleanupTab(tabId)
    }
  })
}

function handleCdpEvent(tabId: number, method: string, params: any): void {
  const tc = tabs.get(tabId)
  if (!tc || tc.status !== 'capturing') return

  if (method === 'Network.requestWillBeSent') {
    const req = params?.request
    if (!req) return
    const resourceType = params?.type as string | undefined
    // Dropped requests are simply not tracked; any later responseReceived
    // event for them will hit `idx == null` and return cleanly. The
    // filter itself lives in `shouldCapture` and is unit-tested in
    // isolation — see capture.spec.ts.
    if (!shouldCapture(req.url, resourceType, tc.filterMode)) {
      return
    }
    const captured: CapturedRequest = {
      captureId: tc.captureId,
      cdpRequestId: params.requestId,
      tabId,
      timestamp: params.timestamp ?? Date.now() / 1000,
      method: req.method,
      url: req.url,
      headers: objectToTuples(req.headers),
      postData: req.postData
    }
    tc.indexByRequestId.set(params.requestId, tc.requests.length)
    tc.requests.push(captured)
    broadcast(tabId, { kind: 'added', request: captured })
    return
  }

  if (method === 'Network.responseReceived') {
    const idx = tc.indexByRequestId.get(params?.requestId)
    if (idx == null) return
    const r = tc.requests[idx]
    if (!r) return
    const resp = params?.response
    if (!resp) return
    r.response = {
      status: resp.status,
      statusText: resp.statusText,
      headers: objectToTuples(resp.headers),
      mimeType: resp.mimeType || resp.headers?.['content-type'] || ''
    }
    broadcast(tabId, { kind: 'updated', request: r })
    return
  }

  // loadingFinished / loadingFailed: we don't fetch body automatically
  // (lazy). The presence of `response` is enough signal for the UI to
  // enable "Save to collection".
}

type CaptureEvent =
  | { kind: 'added'; request: CapturedRequest }
  | { kind: 'updated'; request: CapturedRequest }
  // SW killed the session without the UI asking — tab closed, SW
  // suspending, or another debugger stole the target. The UI uses this
  // to flip its status pill from "capturing" to "stopped".
  | { kind: 'session-end' }

function broadcast(tabId: number, event: CaptureEvent): void {
  // Best-effort: side panel may or may not be open. Ignore rejections.
  try {
    c?.runtime?.sendMessage?.({ type: 'capture:event', tabId, event })
  } catch {
    // Side panel not listening, or no receivers — that's fine.
  }
}

function objectToTuples(obj: Record<string, string> | undefined): Array<[string, string]> {
  if (!obj) return []
  return Object.entries(obj)
}

async function cleanupTab(tabId: number): Promise<void> {
  const tc = tabs.get(tabId)
  if (!tc) return
  tc.status = 'stopped'
  // Detach is best-effort — if the debugger was already detached (tab
  // closed), the call rejects and we just move on.
  try {
    await c?.debugger?.detach?.({ tabId })
  } catch {
    // ignore
  }
  broadcast(tabId, { kind: 'session-end' })
}


export async function startCapture(
  tabId: number,
  filterMode: CaptureFilterMode = 'api-only'
): Promise<void> {
  if (!c?.debugger) {
    throw new Error('chrome.debugger API unavailable')
  }
  ensureGlobalListeners()

  // Already capturing this tab? Reset the list rather than erroring —
  // it's the least surprising UX for "I clicked start twice".
  if (tabs.has(tabId)) {
    const existing = tabs.get(tabId)!
    if (existing.status === 'capturing') {
      await stopCapture(tabId)
    }
  }

  try {
    await c.debugger.attach({ tabId }, '1.3')
  } catch (e: any) {
    // The canonical message is "Another debugger is already attached".
    // Surface a clearer hint so the UI can say "close DevTools".
    const msg = String(e?.message ?? '')
    if (msg.includes('Another debugger') || msg.includes('already attached')) {
      throw new Error('Another debugger is already attached to this tab. Close DevTools and try again.')
    }
    throw e
  }

  try {
    await c.debugger.sendCommand({ tabId }, 'Network.enable')
  } catch (e) {
    // If Network.enable fails, detach so we don't leave a half-attached
    // debugger session.
    try { await c.debugger.detach({ tabId }) } catch { /* ignore */ }
    throw e
  }

  tabs.set(tabId, {
    tabId,
    captureId: uid(),
    status: 'capturing',
    requests: [],
    indexByRequestId: new Map(),
    filterMode
  })
}

export async function stopCapture(tabId: number): Promise<void> {
  const tc = tabs.get(tabId)
  if (!tc) return
  await cleanupTab(tabId)
}

export function getCaptured(tabId: number): CapturedRequest[] {
  return tabs.get(tabId)?.requests ?? []
}

export function getCaptureStatus(tabId: number): 'idle' | 'capturing' | 'stopped' {
  const tc = tabs.get(tabId)
  if (!tc) return 'idle'
  return tc.status
}

export function clearCaptured(tabId: number): void {
  const tc = tabs.get(tabId)
  if (!tc) return
  tc.requests = []
  tc.indexByRequestId.clear()
}
