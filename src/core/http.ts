import type { DraftRequest, ResponseResult, ResponseError, EnvironmentVariable, FormDataRow } from './types'
import { buildUrl, urlWithParams } from './url'
import { mergeAbortSignals } from './abortSignals'
import { bytesToBase64, base64ToBytes } from './binaryTransport'
import { hasExtensionRuntime } from './env'
import { extractResourceTiming } from './timing'
import { readCappedResponseBody } from './fetchResponseBody'
import { maxResponseBytes, streamTruncationNotice } from './responseSize'
import { processHeaders } from './headers'
import { isMethodWithBody, serializeBody } from './body'
import { applyVariables } from './variables'

export interface ExecuteOptions {
  signal?: AbortSignal
  // When running through the background bridge, controls whether the SW
  // reads cookies from the browser cookie jar and injects them as a
  // Cookie header. (No effect in dev/direct-fetch mode.)
  sendBrowserCookies?: boolean
}

// Normalize a DraftRequest into a fetch-ready spec.
export interface NormalizedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: BodyInit | null | undefined
  settings?: {
    timeout?: number
    followRedirects?: boolean
    maxResponseSize?: number
  }
}

// Optional env/globals let `normalize` resolve {{var}} placeholders before
// building the URL/headers/body. Both default to empty — callers that
// don't care about variables get the legacy behaviour.
export function normalize(
  req: DraftRequest,
  env: EnvironmentVariable[] = [],
  globals: EnvironmentVariable[] = []
): NormalizedRequest {
  const resolved = applyVariables(req, env, globals)
  let url = buildUrl(urlWithParams(resolved.url, resolved.params))
  const { headers } = processHeaders(resolved.headers, resolved.body)
  const method = resolved.method.toUpperCase()

  // Build the body. For form-data we build the multipart Blob ourselves
  // rather than using FormData: FormData can't cross chrome.runtime.
  // sendMessage (it flattens to {}), and doing it by hand lets us pin the
  // exact boundary into the Content-Type header the service worker sends.
  let finalBody: BodyInit | null | undefined
  if (isMethodWithBody(method)) {
    finalBody =
      resolved.body.mode === 'formdata'
        ? formdataRowsToMultipart(resolved.body.formdata ?? [])?.blob
        : serializeBody(resolved.body)
  }

  // Apply auth (may add headers or query params)
  const finalHeaders = { ...headers }
  if (finalBody instanceof Blob && finalBody.type.startsWith('multipart/form-data')) {
    // Pin the real boundary. processHeaders injected a placeholder for
    // formdata mode and then stripped it; this is the authoritative
    // value that matches the body.
    finalHeaders['Content-Type'] = finalBody.type
  }
  if (resolved.auth.type === 'bearer') {
    const prefix = resolved.auth.prefix || 'Bearer'
    finalHeaders['Authorization'] = `${prefix} ${resolved.auth.token}`
  } else if (resolved.auth.type === 'basic') {
    // btoa() throws on non-Latin1 (e.g. CJK passwords) — encode via UTF-8
    // bytes instead, which is also the correct wire format for Basic auth.
    const encoded = bytesToBase64(new TextEncoder().encode(`${resolved.auth.username}:${resolved.auth.password}`))
    finalHeaders['Authorization'] = `Basic ${encoded}`
  } else if (resolved.auth.type === 'apikey' && resolved.auth.addTo === 'query') {
    const { key, value, prefix } = resolved.auth
    const qsValue = prefix ? `${prefix} ${value}` : value
    url += (url.includes('?') ? '&' : '?') + `${encodeURIComponent(key)}=${encodeURIComponent(qsValue)}`
  } else if (resolved.auth.type === 'apikey' && resolved.auth.addTo === 'header') {
    const { key, value, prefix } = resolved.auth
    finalHeaders[key] = prefix ? `${prefix} ${value}` : value
  }

  return {
    url,
    method,
    headers: finalHeaders,
    body: finalBody,
    settings: {
      timeout: resolved.settings?.timeout ?? 0,
      followRedirects: resolved.settings?.followRedirects ?? true,
      maxResponseSize: resolved.settings?.maxResponseSize ?? 0
    }
  }
}

// Build a multipart/form-data body as a Blob directly from the rows.
// We avoid FormData because it can't survive chrome.runtime.sendMessage
// (structured clone flattens it to {}); building it by hand also lets us
// emit the exact boundary into the Content-Type header ourselves, so the
// service-worker-side fetch sends a header that matches the body.
function formdataRowsToMultipart(rows: FormDataRow[]): { blob: Blob } | null {
  // Boundary MUST be all lowercase: the Content-Type header is taken from
  // `blob.type`, which the Blob constructor forces to lowercase. If the
  // boundary had uppercase letters the header ("...boundary=----picoapi")
  // would no longer match the delimiter written into the body
  // ("------PicoApi"), and the server would reject the multipart (400).
  const boundary = '----picoapi' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  const parts: BlobPart[] = []
  let appended = false
  for (const r of rows) {
    if (!r.enabled) continue
    const k = r.key.trim()
    if (!k) continue
    if (r.kind === 'file' && r.file) {
      // A File's bytes don't survive JSON serialization — a persisted or
      // cloned draft collapses the File to a bytes-less object. If one of
      // those slips through, fail loudly rather than silently embedding
      // "[object Object]" (which the server rejects with an opaque 400).
      if (!(r.file instanceof Blob)) {
        throw new Error(
          `Form-data field "${k}" (${r.fileName || 'file'}) has no file contents — re-select the file and try again.`
        )
      }
      const ct = r.fileType || r.file.type || 'application/octet-stream'
      const name = r.fileName || (r.file as File).name || 'file'
      parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${escapeQuotes(k)}"; filename="${escapeQuotes(name)}"\r\n` +
        `Content-Type: ${ct}\r\n\r\n`
      )
      parts.push(r.file)
      parts.push('\r\n')
      appended = true
    } else if (r.kind === 'text') {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${escapeQuotes(k)}"\r\n\r\n${r.value ?? ''}\r\n`)
      appended = true
    }
  }
  if (!appended) return null
  parts.push(`--${boundary}--\r\n`)
  return { blob: new Blob(parts, { type: `multipart/form-data; boundary=${boundary}` }) }
}

// Escape characters that would break out of the quoted-string token in
// a Content-Disposition header (RFC 2616 section 2.2). Conservative —
// most filenames won't contain these but a single quote or backslash
// would silently corrupt the multipart body.
function escapeQuotes(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// Best-effort classification of fetch() rejections (AbortError vs CORS vs local connectivity).
export type ErrorKind = 'cors' | 'dns' | 'connect' | 'tls' | 'timeout' | 'aborted' | 'unknown'

// `privileged: true` describes fetches made through the background service
// worker, where CORS simply doesn't apply — a "Failed to fetch" there is a
// connectivity problem, never a CORS block. Exported for unit tests.
export function classifyFetchError(
  e: any,
  url: string,
  opts: { privileged?: boolean } = {}
): { kind: ErrorKind; message: string } {
  if (e?.name === 'AbortError') {
    return { kind: 'aborted', message: 'Request aborted' }
  }
  const raw = String(e?.message ?? 'Network error')

  // URLs we hit as localhost / private IPs aren't subject to CORS in the
  // same way as public ones, so a failure there is more likely a real
  // connectivity problem than a CORS block.
  let host = ''
  try { host = new URL(url).hostname } catch { /* ignore */ }
  const isLocal = host === 'localhost' || host === '127.0.0.1' || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(host)

  if (raw.includes('Failed to fetch')) {
    if (isLocal) {
      return {
        kind: 'connect',
        message: 'Could not reach the server. Is it running on ' + host + '?'
      }
    }
    if (opts.privileged) {
      return {
        kind: 'connect',
        message: `Could not reach ${host || 'the server'} — the request left the extension but got no response (DNS, network, or the host may be down).`
      }
    }
    return {
      kind: 'cors',
      message: 'Blocked by CORS — the server did not include this origin in Access-Control-Allow-Origin. Check DevTools Network for the actual response.'
    }
  }

  if (raw.toLowerCase().includes('dns')) {
    return { kind: 'dns', message: `DNS lookup failed for ${host || 'the host'}` }
  }
  if (raw.toLowerCase().includes('ssl') || raw.toLowerCase().includes('tls')) {
    return { kind: 'tls', message: 'TLS handshake failed (expired / self-signed cert?)' }
  }
  if (raw.toLowerCase().includes('timeout')) {
    return { kind: 'timeout', message: 'Request timed out' }
  }
  return { kind: 'unknown', message: raw }
}

// Extension options page fetch goes through the background SW (CORS bypass).
// Dev/preview falls back to direct fetch when chrome.runtime is unavailable
// (see core/env.ts). The bridge code below talks to the raw chrome global.
declare const chrome: any

// Bridge transport shape: NormalizedRequest plus optional base64 body
// metadata when the options page sends a multipart Blob through sendMessage.
export interface BridgeNormalizedRequest extends Omit<NormalizedRequest, 'body'> {
  body?: BodyInit | string | null
  _bodyIsBlob?: boolean
  _bodyContentType?: string
}

// Background-bridge request shape (see src/background/index.ts).
interface BridgeSuccess {
  ok: true
  result: {
    status: number
    statusText: string
    headers: Array<[string, string]>
    /** UTF-8 text when decodable; may be empty for binary bodies. */
    text: string
    /** Base64-encoded response bytes — authoritative over `text` for Blob rebuild. */
    bodyBase64: string
    size: number
    time: number
    mime: string
    timing?: ResponseResult['timing']
    setCookies?: ResponseResult['setCookies']
  }
}
interface BridgeFailure {
  ok: false
  error: ResponseError
}

// chrome.runtime.sendMessage only supports JSON-serializable messages —
// Blob / ArrayBuffer / FormData all get silently flattened to {} by
// JSON.stringify. For Blob bodies (our multipart path), base64-encode
// the bytes and ship the content-type alongside so the SW can rebuild
// the Blob before fetch (transportBodyToInit on the receiving side).
async function toTransportBody(req: NormalizedRequest): Promise<BridgeNormalizedRequest> {
  if (!(req.body instanceof Blob)) {
    return { ...req, _bodyIsBlob: false, _bodyContentType: undefined }
  }
  const buf = await req.body.arrayBuffer()
  return {
    ...req,
    body: bytesToBase64(new Uint8Array(buf)),
    _bodyIsBlob: true,
    _bodyContentType: req.body.type
  }
}

async function executeViaBridge(req: NormalizedRequest, opts: ExecuteOptions): Promise<ResponseResult> {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const bridgeReq = await toTransportBody(req)
  // Send along the cookie-injection flag so the SW knows whether to read
  // the browser cookie jar.
  const message = {
    id,
    req: bridgeReq,
    options: {
      sendBrowserCookies: opts.sendBrowserCookies ?? true
    }
  }
  const reply = await new Promise<BridgeSuccess | BridgeFailure>((resolve, reject) => {
    let settled = false
    const signal = opts.signal

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    const onAbort = () => {
      finish(() => {
        try {
          chrome.runtime.sendMessage({ type: 'fetch:abort', id })
        } catch {
          // SW may already be gone — local reject is enough for the UI.
        }
        const err: ResponseError = {
          message: 'Request aborted',
          errorKind: 'aborted',
          originalMessage: 'Request aborted'
        }
        reject(err)
      })
    }

    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    try {
      chrome.runtime.sendMessage(message, (response: any) => {
        if (signal?.aborted) return
        finish(() => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message ?? 'bridge error'))
            return
          }
          resolve(response)
        })
      })
    } catch (e) {
      finish(() => reject(e))
    }
  })
  if (reply.ok) {
    const bytes = base64ToBytes(reply.result.bodyBase64)
    const blob = new Blob([Uint8Array.from(bytes)], { type: reply.result.mime || 'application/octet-stream' })
    let text = reply.result.text
    if (!text) {
      try {
        text = await blob.text()
      } catch {
        text = ''
      }
    }
    return {
      status: reply.result.status,
      statusText: reply.result.statusText,
      headers: reply.result.headers,
      time: reply.result.time,
      mime: reply.result.mime,
      timing: reply.result.timing,
      setCookies: reply.result.setCookies,
      body: { blob, text, size: blob.size }
    }
  }
  // The bridge returned an error payload — refine based on the URL just
  // like the direct-fetch path does. The SW fetch is privileged (no CORS),
  // so its "Failed to fetch" must never surface as a CORS message.
  const refined = classifyFetchError({ name: 'TypeError', message: reply.error.originalMessage }, req.url, { privileged: true })
  throw {
    ...reply.error,
    message: reply.error.errorKind === 'aborted' ? reply.error.message : refined.message,
    errorKind: reply.error.errorKind === 'aborted' ? 'aborted' : refined.kind
  } satisfies ResponseError
}

// Streaming fetch via background bridge (CORS bypass).
// Uses chrome.runtime.connect for bidirectional chunk relay.
async function executeStreamingViaBridge(
  req: NormalizedRequest,
  opts: StreamingExecuteOptions
): Promise<ResponseResult & { isStreaming: boolean }> {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)

  const bridgeReq = await toTransportBody(req)

  const { onChunk, signal } = opts
  let fullText = ''
  let headers: Array<[string, string]> = []
  let status = 200
  let statusText = 'OK'
  let mime = ''
  let time = 0
  let resolve: (v: ResponseResult & { isStreaming: boolean }) => void = () => {}
  let reject: (e: ResponseError) => void = () => {}
  let port: any = null

  const promise = new Promise<ResponseResult & { isStreaming: boolean }>((res, rej) => {
    resolve = res
    reject = rej
  })

  // Set up abort handling. `kind` distinguishes the user pressing Cancel
  // from the request exceeding its configured timeout — both abort the
  // fetch, but they must surface as different errors.
  let aborted = false
  const abortHandler = (kind: 'user' | 'timeout' = 'user') => {
    aborted = true
    try {
      chrome.runtime.sendMessage({ type: 'fetch:abort', id })
    } catch { /* ignore */ }
    if (port) port.disconnect()
    reject(kind === 'timeout'
      ? { message: 'Request timed out', errorKind: 'timeout' }
      : { message: 'Request aborted', errorKind: 'aborted' })
  }
  if (signal) {
    if (signal.aborted) {
      abortHandler()
      return promise
    }
    signal.addEventListener('abort', () => abortHandler(), { once: true })
  }

  // Connect to background for streaming.
  port = chrome.runtime.connect({ name: id })

  let chunkCount = 0

  port.onMessage.addListener((msg: any) => {
    if (msg.type === 'headers') {
      headers = msg.headers
      status = msg.status
      statusText = msg.statusText
    } else if (msg.type === 'chunk') {
      chunkCount++
      fullText += msg.chunk
      onChunk(msg.chunk)
    } else if (msg.type === 'done') {
      mime = msg.mime
      time = msg.time
      if (msg.truncated) {
        fullText += streamTruncationNotice(req.settings?.maxResponseSize)
      }
      const blob = new Blob([fullText], { type: mime })
      resolve({
        status,
        statusText,
        headers,
        body: { blob, text: fullText, size: blob.size },
        time,
        mime,
        timing: undefined,
        isStreaming: chunkCount > 1  // True streaming = multiple chunks
      })
      port?.disconnect()
    } else if (msg.type === 'error') {
      reject({ message: msg.message, errorKind: msg.errorKind, originalMessage: msg.message })
      port?.disconnect()
    }
  })

  port.onDisconnect.addListener(() => {
    if (!aborted && !fullText) {
      reject({ message: 'Connection lost', errorKind: 'unknown', originalMessage: 'Connection lost' })
    }
  })

  // Set up timeout.
  const timeout = req.settings?.timeout ?? 0
  const timeoutId = timeout > 0 ? setTimeout(() => {
    abortHandler('timeout')
  }, timeout) : null

  // Send streaming request to background.
  chrome.runtime.sendMessage({
    type: 'fetch:streaming',
    id,
    req: bridgeReq,
    options: { sendBrowserCookies: opts.sendBrowserCookies ?? true }
  }, (response: any) => {
    if (timeoutId) clearTimeout(timeoutId)
    if (aborted) return

    if (chrome.runtime.lastError) {
      reject({ message: chrome.runtime.lastError.message ?? 'bridge error', errorKind: 'unknown' })
      return
    }

    if (!response?.ok) {
      reject(response?.error || { message: 'Unknown error', errorKind: 'unknown' })
    }
  })

  return promise
}

// Execute an HTTP request. Returns a normalized ResponseResult.
// Rejects with ResponseError on network / abort failures.
//
// Routing:
//   - extension mode (chrome.runtime?.id):   background service worker
//   - dev mode (vite preview, web preview):  direct fetch
export async function execute(
  req: NormalizedRequest,
  opts: ExecuteOptions = {}
): Promise<ResponseResult> {
  if (hasExtensionRuntime()) {
    return executeViaBridge(req, opts)
  }
  return executeDirect(req, opts)
}

// Pure in-page fetch path — used when there is no privileged origin to
// proxy through. Keeps all the timing + classification behaviour intact.
async function executeDirect(
  req: NormalizedRequest,
  opts: ExecuteOptions
): Promise<ResponseResult> {
  const t0 = performance.now()

  try {
    const init: RequestInit = {
      method: req.method,
      headers: req.headers,
      credentials: 'same-origin',
      redirect: req.settings?.followRedirects === false ? 'manual' : 'follow'
    }
    if (req.body !== undefined) {
      init.body = req.body
    }

    // Apply request-level timeout, merged with any caller-provided cancel signal.
    const timeout = req.settings?.timeout ?? 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let timeoutCtrl: AbortController | undefined
    if (timeout > 0) {
      timeoutCtrl = new AbortController()
      timeoutId = setTimeout(() => timeoutCtrl!.abort(), timeout)
    }
    const combined = mergeAbortSignals(opts.signal, timeoutCtrl?.signal)
    if (combined) init.signal = combined

    const res = await fetch(req.url, init)
    if (timeoutId) clearTimeout(timeoutId)
    const blob = await res.blob()
    const t1 = performance.now()

    const { finalBlob, text } = await readCappedResponseBody(blob, req.settings?.maxResponseSize)

    const headers: Array<[string, string]> = []
    res.headers.forEach((v, k) => headers.push([k, v]))

    // P3-2: detailed timing from PerformanceResourceTiming.
    const timing = extractResourceTiming(req.url)

    return {
      status: res.status,
      statusText: res.statusText,
      headers,
      body: { blob: finalBlob, text, size: finalBlob.size },
      time: Math.round(t1 - t0),
      mime: res.headers.get('Content-Type') ?? '',
      timing
    }
  } catch (e: any) {
    const cls = classifyFetchError(e, req.url)
    const err: ResponseError = {
      message: cls.message,
      errorKind: cls.kind,
      cause: e,
      // Convenience: expose the original message for power users (DevTools).
      originalMessage: String(e?.message ?? 'Network error')
    }
    throw err
  }
}

// Streaming response handler: reads the response as a stream and calls onChunk
// for each piece of data received. Returns the final ResponseResult when done.
export type StreamChunkHandler = (text: string) => void

export interface StreamingExecuteOptions extends ExecuteOptions {
  onChunk: StreamChunkHandler
}

// Routing: extension mode uses background bridge for CORS bypass.
export async function executeStreaming(
  req: NormalizedRequest,
  opts: StreamingExecuteOptions
): Promise<ResponseResult & { isStreaming: boolean }> {
  if (hasExtensionRuntime()) {
    return executeStreamingViaBridge(req, opts)
  }
  return executeStreamingDirect(req, opts)
}

// Direct streaming (no CORS bypass).
async function executeStreamingDirect(
  req: NormalizedRequest,
  opts: StreamingExecuteOptions
): Promise<ResponseResult & { isStreaming: boolean }> {
  const t0 = performance.now()
  const { onChunk, ...rest } = opts

  const init: RequestInit = {
    method: req.method,
    headers: req.headers,
    credentials: 'same-origin',
    redirect: req.settings?.followRedirects === false ? 'manual' : 'follow'
  }
  if (req.body !== undefined) {
    init.body = req.body
  }

  const timeout = req.settings?.timeout ?? 0
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timeoutCtrl: AbortController | undefined
  let timedOut = false
  if (timeout > 0) {
    timeoutCtrl = new AbortController()
    timeoutId = setTimeout(() => {
      timedOut = true
      timeoutCtrl!.abort()
    }, timeout)
  }
  const combined = mergeAbortSignals(rest.signal, timeoutCtrl?.signal)
  if (combined) init.signal = combined

  let res: Response
  try {
    res = await fetch(req.url, init)
  } catch (e: any) {
    // Both a timeout and the user pressing Cancel surface as AbortError —
    // distinguish by who aborted (the app signal is only aborted by the
    // user; the timeout controller only by the timer above).
    if (timedOut || (e?.name === 'AbortError' && !rest.signal?.aborted)) {
      throw { message: 'Request timed out', errorKind: 'timeout' } satisfies ResponseError
    }
    throw e
  }
  if (timeoutId) clearTimeout(timeoutId)

  const reader = res.body?.getReader()
  if (!reader) {
    throw { message: 'Response body is not streamable', errorKind: 'unknown' } satisfies ResponseError
  }

  const decoder = new TextDecoder()
  let fullText = ''
  let chunkCount = 0
  // Same cap as the background streaming path (see runStreamingFetch).
  const maxBytes = maxResponseBytes(req.settings?.maxResponseSize)
  let received = 0
  let truncated = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunkCount++
      const remaining = maxBytes > 0 ? maxBytes - received : Infinity
      if (value.byteLength >= remaining) {
        // The cap falls inside this chunk: keep only the bytes within the
        // cap and flush the decoder (non-stream mode) so a multi-byte
        // UTF-8 sequence never gets cut mid-character.
        const capped = value.subarray(0, Math.max(0, remaining))
        const chunk = decoder.decode(capped)
        onChunk(chunk)
        fullText += chunk
        truncated = true
        // Chrome may reject reader.cancel() ("signal is aborted without
        // reason") when the fetch has an AbortSignal attached — everything
        // we need is already read, so the cancel result is irrelevant.
        try { await reader.cancel() } catch { /* ignore */ }
        break
      }
      const chunk = decoder.decode(value, { stream: true })
      onChunk(chunk)
      fullText += chunk
      received += value.byteLength
    }
  } finally {
    reader.releaseLock()
  }
  if (truncated) {
    fullText += streamTruncationNotice(req.settings?.maxResponseSize)
  }

  const t1 = performance.now()
  const headers: Array<[string, string]> = []
  res.headers.forEach((v, k) => headers.push([k, v]))

  const timing = extractResourceTiming(req.url)
  const mime = res.headers.get('Content-Type') ?? ''

  const blob = new Blob([fullText], { type: mime })
  return {
    status: res.status,
    statusText: res.statusText,
    headers,
    body: { blob, text: fullText, size: blob.size },
    time: Math.round(t1 - t0),
    mime,
    timing,
    isStreaming: chunkCount > 1  // True streaming = multiple chunks
  }
}