// Background service worker: privileged fetch (no CORS), cookie injection, capture.
// Messages: { type: 'fetch'|'fetch:abort'|'capture:*', id, ... } → { id, ok, result|error }.

import type { ResponseError, ResponseResult } from '../core/types'
import type { NormalizedRequest, BridgeNormalizedRequest } from '../core/http'
import { extractResourceTiming } from '../core/timing'
import { readCappedResponseBodyForBridge } from '../core/fetchResponseBody'
import { mergeAbortSignals } from '../core/abortSignals'
import { parseSetCookies } from '../core/cookies'
import type { ParsedCookie } from '../core/cookies'
import {
  startCapture,
  stopCapture,
  getCaptured,
  getCaptureStatus,
  clearCaptured,
  type CaptureFilterMode
} from './capture'

type MessageType = 'fetch' | 'fetch:abort' | 'capture:start' | 'capture:stop' | 'capture:list' | 'capture:status' | 'capture:clear'

interface FetchAbortPayload {
  type: 'fetch:abort'
  id: string
}

interface FetchPayload {
  type?: 'fetch'
  id: string
  req: BridgeNormalizedRequest
  options?: { sendBrowserCookies?: boolean }
}

interface CapturePayload {
  type: 'capture:start' | 'capture:stop' | 'capture:list' | 'capture:status' | 'capture:clear'
  id: string
  tabId: number
  // Only 'capture:start' reads this. Defaults to 'api-only' on the
  // engine side if missing — kept optional so older UIs that don't send
  // it still work.
  filterMode?: CaptureFilterMode
}

type InboundMessage = FetchPayload | FetchAbortPayload | CapturePayload

// In-flight fetch abort handles — keyed by the bridge message id.
const inflightFetches = new Map<string, AbortController>()

function abortInflightFetch(id: string): void {
  inflightFetches.get(id)?.abort()
}

interface ResponsePayload extends Omit<ResponseResult, 'body'> {
  text: string
  bodyBase64: string
  size: number
  mime: string
  setCookies?: ParsedCookie[]
}

// `chrome` is the global provided by the extension service-worker context.
// The Vue TS config doesn't include @types/chrome (we only depend on it
// indirectly) so we cast to `any` at the call site.
const c = (globalThis as any).chrome as
  | undefined
  | {
      runtime: {
        onMessage: {
          addListener: (cb: (msg: any, sender: any, sendResponse: (r: any) => void) => any) => void
        }
        openOptionsPage: () => void
      }
      action: { onClicked: { addListener: (cb: (tab: any) => void) => void } }
      sidePanel?: {
        setPanelBehavior: (behavior: { openPanelOnActionClick: boolean }) => Promise<void>
      }
      cookies?: {
        getAll: (details: { url: string }) => Promise<Array<{ name: string; value: string }>>
      }
    }

// Read the browser's cookie jar for the target URL and build a Cookie
// header. Returns null if there are no cookies or the chrome.cookies API
// isn't available (e.g. permission missing).
async function buildBrowserCookieHeader(url: string): Promise<string | null> {
  if (!c?.cookies?.getAll) return null
  try {
    const u = new URL(url)
    // chrome.cookies.getAll matches cookies that would be sent to this URL:
    // it accounts for domain suffix-match, path prefix-match, Secure,
    // HttpOnly (which is exactly what we want — HttpOnly cookies are
    // invisible to JS but visible to the cookies API).
    const cookies = await c.cookies.getAll({ url: u.href })
    if (cookies.length === 0) return null
    return cookies.map(k => `${k.name}=${k.value}`).join('; ')
  } catch {
    return null
  }
}

async function runFetch(payload: FetchPayload): Promise<{ ok: true; result: ResponsePayload } | { ok: false; error: ResponseError }> {
  const t0 = performance.now()
  const cancelCtrl = new AbortController()
  inflightFetches.set(payload.id, cancelCtrl)
  try {
    // Inject browser cookies if requested and the user hasn't set a Cookie
    // header themselves. (User-set Cookie wins — we don't want to silently
    // override an explicit value.)
    let headers = payload.req.headers
    if (payload.options?.sendBrowserCookies) {
      const hasUserCookie = Object.keys(headers).some(k => k.toLowerCase() === 'cookie')
      if (!hasUserCookie) {
        const cookieHeader = await buildBrowserCookieHeader(payload.req.url)
        if (cookieHeader) {
          headers = { ...headers, Cookie: cookieHeader }
        }
      }
    }

    // Reconstruct Blob body if the options page base64-encoded it for
    // transport (sendMessage can't carry Blob directly). Other body
    // shapes (string, undefined) pass through untouched.
    let body: BodyInit | undefined
    if (payload.req._bodyIsBlob && typeof payload.req.body === 'string') {
      const binary = atob(payload.req.body)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      body = new Blob([bytes], { type: payload.req._bodyContentType || 'application/octet-stream' })
    } else if (payload.req.body !== undefined) {
      body = payload.req.body as BodyInit
    }

    const init: RequestInit = {
      method: payload.req.method,
      headers,
      redirect: payload.req.settings?.followRedirects === false ? 'manual' : 'follow'
    }
    if (body !== undefined) {
      init.body = body
    }

    const timeout = payload.req.settings?.timeout ?? 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let timeoutCtrl: AbortController | undefined
    if (timeout > 0) {
      timeoutCtrl = new AbortController()
      timeoutId = setTimeout(() => timeoutCtrl!.abort(), timeout)
    }
    const combined = mergeAbortSignals(cancelCtrl.signal, timeoutCtrl?.signal)
    if (combined) init.signal = combined

    const res = await fetch(payload.req.url, init)
    if (timeoutId) clearTimeout(timeoutId)
    const blob = await res.blob()

    const { finalBlob, text, bodyBase64 } = await readCappedResponseBodyForBridge(
      blob,
      payload.req.settings?.maxResponseSize
    )

    const headersOut: Array<[string, string]> = []
    res.headers.forEach((v, k) => headersOut.push([k, v]))

    // Read every Set-Cookie (foreground fetch can't — CORS hides them).
    // getSetCookie() is widely supported in modern Chrome; fall back
    // gracefully if missing.
    let setCookies: ParsedCookie[] | undefined
    const getSetCookie = (res.headers as any).getSetCookie as
      | (() => string[])
      | undefined
    if (typeof getSetCookie === 'function') {
      const raws = getSetCookie.call(res.headers)
      if (raws && raws.length > 0) {
        setCookies = parseSetCookies(raws)
      }
    }

    const timing = extractResourceTiming(payload.req.url)

    const result: ResponsePayload = {
      status: res.status,
      statusText: res.statusText,
      headers: headersOut,
      text,
      bodyBase64,
      size: finalBlob.size,
      time: Math.round(performance.now() - t0),
      mime: res.headers.get('Content-Type') ?? '',
      timing,
      setCookies
    }
    return { ok: true, result }
  } catch (e: any) {
    const err: ResponseError = {
      message: e?.name === 'AbortError'
        ? 'Request aborted'
        : (e?.message ?? 'Network error'),
      errorKind: e?.name === 'AbortError' ? 'aborted' : 'unknown',
      cause: e,
      originalMessage: String(e?.message ?? 'Network error')
    }
    return { ok: false, error: err }
  } finally {
    inflightFetches.delete(payload.id)
  }
}

if (c) {
  c.runtime.onMessage.addListener((msg: InboundMessage, _sender: any, sendResponse: (r: any) => void) => {
    // Returning true keeps the channel open while we await sendResponse.
    ;(async () => {
      const reply = await dispatch(msg)
      sendResponse(reply)
    })()
    return true
  })

  // Clicking the extension icon opens the side panel. The side panel's
  // top-right fullscreen button calls openOptionsPage() to pop out into
  // a full browser tab when the user wants more room.
  if (c.sidePanel?.setPanelBehavior) {
    c.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
      // Permission missing or old Chrome — fall back to opening options.
      c.action.onClicked.addListener(() => {
        c.runtime.openOptionsPage()
      })
    })
  } else {
    // sidePanel API unavailable — open the options page on click instead.
    c.action.onClicked.addListener(() => {
      c.runtime.openOptionsPage()
    })
  }
}

// Single dispatch entry point. Routes by `msg.type` to the fetch proxy
// or the capture engine. Each handler returns a unified success/error
// reply so the client side only needs one switch on `reply.ok`.
async function dispatch(msg: InboundMessage): Promise<{ id: string; ok: true; result: any } | { id: string; ok: false; error: ResponseError }> {
  const type = (msg as any).type as MessageType | undefined
  try {
    if (type === 'capture:start') {
      const payload = msg as CapturePayload
      await startCapture(payload.tabId, payload.filterMode ?? 'api-only')
      return { id: msg.id, ok: true, result: { status: getCaptureStatus(payload.tabId) } }
    }
    if (type === 'capture:stop') {
      await stopCapture((msg as CapturePayload).tabId)
      return { id: msg.id, ok: true, result: { status: 'stopped' } }
    }
    if (type === 'capture:list') {
      const requests = getCaptured((msg as CapturePayload).tabId)
      return { id: msg.id, ok: true, result: { requests, status: getCaptureStatus((msg as CapturePayload).tabId) } }
    }
    if (type === 'capture:status') {
      return { id: msg.id, ok: true, result: { status: getCaptureStatus((msg as CapturePayload).tabId) } }
    }
    if (type === 'capture:clear') {
      clearCaptured((msg as CapturePayload).tabId)
      return { id: msg.id, ok: true, result: { status: getCaptureStatus((msg as CapturePayload).tabId) } }
    }
    if (type === 'fetch:abort') {
      abortInflightFetch(msg.id)
      return { id: msg.id, ok: true, result: { aborted: true } }
    }
    // Default to fetch (also covers pre-router messages with no type).
    const fetchReply = await runFetch(msg as FetchPayload)
    return { id: msg.id, ...fetchReply }
  } catch (e: any) {
    return {
      id: msg.id,
      ok: false,
      error: {
        message: String(e?.message ?? e),
        errorKind: 'unknown',
        originalMessage: String(e?.message ?? e)
      }
    }
  }
}

// Marker export to keep this file a module under vite's bundling rules.
export {}
