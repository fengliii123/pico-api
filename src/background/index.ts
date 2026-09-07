// Background service worker: privileged fetch (no CORS) and cookie injection.
// Messages: { type: 'fetch'|'fetch:abort'|'fetch:streaming', id, ... } → { id, ok, result|error }.

import type { ResponseError, ResponseResult } from '../core/types'
import type { NormalizedRequest, BridgeNormalizedRequest } from '../core/http'
import { extractResourceTiming } from '../core/timing'
import { readCappedResponseBodyForBridge } from '../core/fetchResponseBody'
import { maxResponseBytes } from '../core/responseSize'
import { mergeAbortSignals } from '../core/abortSignals'
import { base64ToBytes } from '../core/binaryTransport'
import { parseSetCookies } from '../core/cookies'
import type { ParsedCookie } from '../core/cookies'

type MessageType = 'fetch' | 'fetch:abort' | 'fetch:streaming'

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

interface FetchStreamingPayload {
  type: 'fetch:streaming'
  id: string
  req: BridgeNormalizedRequest
  options?: { sendBrowserCookies?: boolean }
}

type InboundMessage = FetchPayload | FetchAbortPayload | FetchStreamingPayload

// In-flight fetch abort handles — keyed by the bridge message id. Covers
// both plain and streaming fetches (both register an AbortController here).
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
        id: string
        onMessage: {
          addListener: (cb: (msg: any, sender: any, sendResponse: (r: any) => void) => any) => void
        }
        onConnect: {
          addListener: (cb: (port: any) => void) => void
        }
        onInstalled: {
          addListener: (cb: (details: { reason: string }) => void) => void
        }
        openOptionsPage: () => void
      }
      action: { onClicked: { addListener: (cb: (tab: any) => void) => void } }
      cookies?: {
        getAll: (details: { url: string }) => Promise<Array<{ name: string; value: string }>>
      }
    }

// Rebuild a Blob body that the options page base64-encoded for transport
// (chrome.runtime.sendMessage can't carry Blob directly — it flattens to
// {}). Other body shapes (string, undefined) pass through untouched.
function transportBodyToInit(req: BridgeNormalizedRequest): BodyInit | undefined {
  if (req._bodyIsBlob && typeof req.body === 'string') {
    // Uint8Array.from narrows to a plain ArrayBuffer-backed view, which
    // the DOM BlobPart type demands.
    return new Blob([Uint8Array.from(base64ToBytes(req.body))], {
      type: req._bodyContentType || 'application/octet-stream'
    })
  }
  if (req.body !== undefined) return req.body as BodyInit
  return undefined
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
    // transport (sendMessage can't carry Blob directly).
    const body = transportBodyToInit(payload.req)

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

// Streaming fetch: reads response as a stream and sends chunks via chrome.runtime port.
async function runStreamingFetch(
  payload: FetchStreamingPayload
): Promise<{ id: string; ok: true } | { id: string; ok: false; error: ResponseError }> {
  const t0 = performance.now()
  const cancelCtrl = new AbortController()
  inflightFetches.set(payload.id, cancelCtrl)

  // Find the port for this streaming request.
  const port = streamingPorts.get(payload.id)

  try {
    // Inject browser cookies.
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

    const init: RequestInit = {
      method: payload.req.method,
      headers,
      redirect: payload.req.settings?.followRedirects === false ? 'manual' : 'follow',
      signal: cancelCtrl.signal
    }
    // Same Blob-body reconstruction as the non-streaming path — without
    // it, a multipart body arrives as its base64 string and goes on the
    // wire garbled.
    const streamBody = transportBodyToInit(payload.req)
    if (streamBody !== undefined) {
      init.body = streamBody
    }

    const res = await fetch(payload.req.url, init)

    const headersOut: Array<[string, string]> = []
    res.headers.forEach((v, k) => headersOut.push([k, v]))

    const reader = res.body?.getReader()
    if (!reader) {
      return { id: payload.id, ok: false, error: { message: 'Response body is not streamable', errorKind: 'unknown' } }
    }

    const decoder = new TextDecoder()
    // Honor the same max-response-size cap as the non-streaming path —
    // without this, a long SSE stream would grow without bound in the
    // service worker and in the UI store.
    const maxBytes = maxResponseBytes(payload.req.settings?.maxResponseSize)
    let received = 0
    let truncated = false

    // Send headers immediately via the port.
    port?.postMessage({ type: 'headers', headers: headersOut, status: res.status, statusText: res.statusText })

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const remaining = maxBytes > 0 ? maxBytes - received : Infinity
        if (value.byteLength >= remaining) {
          // The cap falls inside this chunk: forward only the bytes within
          // the cap and flush the decoder (non-stream mode) so a multi-byte
          // UTF-8 sequence never gets cut mid-character.
          const capped = value.subarray(0, Math.max(0, remaining))
          port?.postMessage({ type: 'chunk', chunk: decoder.decode(capped) })
          truncated = true
          // Chrome may reject reader.cancel() ("signal is aborted without
          // reason") when the fetch carries an AbortSignal — the bytes are
          // already forwarded, so ignore the cancel result.
          try { await reader.cancel() } catch { /* ignore */ }
          break
        }
        const chunk = decoder.decode(value, { stream: true })
        received += value.byteLength
        port?.postMessage({ type: 'chunk', chunk })
      }
    } finally {
      reader.releaseLock()
    }

    const mime = res.headers.get('Content-Type') ?? ''
    port?.postMessage({
      type: 'done',
      mime,
      time: Math.round(performance.now() - t0),
      truncated
    })
    port?.disconnect()

    return { id: payload.id, ok: true }
  } catch (e: any) {
    port?.postMessage({ type: 'error', message: e?.message ?? 'Network error', errorKind: e?.name === 'AbortError' ? 'aborted' : 'unknown' })
    port?.disconnect()

    const err: ResponseError = {
      message: e?.name === 'AbortError' ? 'Request aborted' : (e?.message ?? 'Network error'),
      errorKind: e?.name === 'AbortError' ? 'aborted' : 'unknown',
      originalMessage: String(e?.message ?? 'Network error')
    }
    return { id: payload.id, ok: false, error: err }
  } finally {
    inflightFetches.delete(payload.id)
  }
}

// Track streaming ports by request id.
const streamingPorts = new Map<string, any>()

if (c) {
  // Listen for streaming connections. Sender is checked so a hostile or
  // compromised context can't open a fetch relay — without
  // externally_connectable, only our own extension pages should ever
  // arrive here, but the check makes that guarantee explicit.
  c.runtime.onConnect.addListener((port: any) => {
    if (port?.sender?.id !== c.runtime.id) return
    const id = port.name
    if (id) {
      streamingPorts.set(id, port)
      port.onDisconnect.addListener(() => {
        streamingPorts.delete(id)
        abortInflightFetch(id)
      })
    }
  })

  c.runtime.onMessage.addListener((msg: InboundMessage, sender: any, sendResponse: (r: any) => void) => {
    // Only accept messages from our own extension contexts. This SW holds
    // <all_urls> host + cookie privileges — never proxy fetches for anyone
    // else, even though only internal senders can normally reach us.
    if (sender?.id !== c.runtime.id) return
    // Returning true keeps the channel open while we await sendResponse.
    ;(async () => {
      const reply = await dispatch(msg)
      sendResponse(reply)
    })()
    return true
  })

  // Clicking the extension icon opens the options page in a new tab.
  c.action.onClicked.addListener(() => {
    c.runtime.openOptionsPage()
  })

  // First install: open the app right away. Without this the extension
  // installs silently and many users never find the icon — a top driver of
  // early uninstalls. Updates stay silent on purpose.
  c.runtime.onInstalled.addListener((details: { reason: string }) => {
    if (details.reason === 'install') c.runtime.openOptionsPage()
  })
}

// Single dispatch entry point. Routes by `msg.type` to the fetch proxy
// or the streaming fetch. Each handler returns a unified success/error
// reply so the client side only needs one switch on `reply.ok`.
async function dispatch(msg: InboundMessage): Promise<{ id: string; ok: true; result: any } | { id: string; ok: false; error: ResponseError }> {
  const type = (msg as any).type as MessageType | undefined
  try {
    if (type === 'fetch:abort') {
      abortInflightFetch(msg.id)
      return { id: msg.id, ok: true, result: { aborted: true } }
    }
    if (type === 'fetch:streaming') {
      const result = await runStreamingFetch(msg as FetchStreamingPayload)
      if (result.ok) {
        return { id: msg.id, ok: true, result: { status: 'streaming' } }
      }
      return result
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
