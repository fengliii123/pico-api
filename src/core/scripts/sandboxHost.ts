// Hidden sandbox iframe for running user scripts under MV3 CSP.
// Extension pages cannot use new Function(); sandbox pages can.

import type { ScriptRunContext, ScriptRunResult } from './vm'
import type { ResponseResult } from '../types'
import { deepClone } from '@/utils/clone'

declare const chrome: { runtime: { getURL(path: string): string } } | undefined

const SANDBOX_TIMEOUT_MS = 30_000

/** Wire payload for postMessage — no Blob, no Vue/Pinia reactive proxies. */
export interface SandboxScriptInput {
  requestUrl: string
  requestMethod: string
  requestHeaders: Record<string, string>
  requestBody: string | undefined
  response: {
    status: number
    statusText: string
    headers: Array<[string, string]>
    body: { text: string; size: number }
    time: number
    mime: string
    timing?: ResponseResult['timing']
    setCookies?: ResponseResult['setCookies']
  } | null
  envVars: ScriptRunContext['envVars']
  globals: ScriptRunContext['globals']
  script: string
}

/** Strip reactive wrappers / non-cloneable values before postMessage. */
export function serializeContextForSandbox(
  script: string,
  ctx: ScriptRunContext
): SandboxScriptInput {
  const input: SandboxScriptInput = {
    requestUrl: String(ctx.requestUrl),
    requestMethod: String(ctx.requestMethod),
    requestHeaders: deepClone(ctx.requestHeaders),
    requestBody: ctx.requestBody,
    response: null,
    envVars: deepClone(ctx.envVars),
    globals: deepClone(ctx.globals),
    script
  }
  if (ctx.response) {
    const r = ctx.response
    input.response = {
      status: r.status,
      statusText: r.statusText,
      headers: deepClone(r.headers),
      body: { text: r.body.text, size: r.body.size },
      time: r.time,
      mime: r.mime,
      timing: r.timing ? deepClone(r.timing) : undefined,
      setCookies: r.setCookies ? deepClone(r.setCookies) : undefined
    }
  }
  return input
}

let iframe: HTMLIFrameElement | null = null
// The frame being created/booted (until sandbox:ready). Tracked separately
// so onSandboxMessage can source-check messages that arrive during boot.
let pendingFrame: HTMLIFrameElement | null = null
let iframeReady: Promise<HTMLIFrameElement> | null = null
let readyResolve: (() => void) | null = null
let nextId = 0
const pending = new Map<string, {
  resolve: (v: ScriptRunResult) => void
  reject: (e: Error) => void
}>()

function onSandboxMessage(event: MessageEvent) {
  // Only accept messages from OUR sandbox iframe. The sandboxed frame has an
  // opaque origin ('null'), so an origin check is useless here — comparing
  // the message source is the only reliable gate.
  const expected = iframe ?? pendingFrame
  if (!expected || event.source !== expected.contentWindow) return
  const data = event.data
  if (!data?.type) return
  if (data.type === 'sandbox:ready') {
    if (readyResolve) {
      readyResolve()
      readyResolve = null
    }
    return
  }
  if (data.type !== 'sandbox:result') return
  const entry = pending.get(data.id)
  if (!entry) return
  pending.delete(data.id)
  if (data.ok) {
    entry.resolve(data.output as ScriptRunResult)
  } else {
    entry.reject(new Error(data.error ?? 'sandbox script error'))
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', onSandboxMessage)
}

function ensureSandboxFrame(): Promise<HTMLIFrameElement> {
  if (iframe) return Promise.resolve(iframe)
  if (iframeReady) return iframeReady

  iframeReady = new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
      reject(new Error('chrome.runtime unavailable'))
      return
    }
    const frame = document.createElement('iframe')
    frame.hidden = true
    frame.src = chrome.runtime.getURL('sandbox.html')

    const readyTimer = setTimeout(() => {
      readyResolve = null
      pendingFrame = null
      frame.remove()
      reject(new Error('sandbox iframe ready timeout'))
    }, SANDBOX_TIMEOUT_MS)

    readyResolve = () => {
      clearTimeout(readyTimer)
      pendingFrame = null
      iframe = frame
      resolve(frame)
    }

    frame.onerror = () => {
      clearTimeout(readyTimer)
      readyResolve = null
      pendingFrame = null
      frame.remove()
      reject(new Error('sandbox iframe failed to load'))
    }
    pendingFrame = frame
    document.documentElement.appendChild(frame)
  })

  return iframeReady
}

export async function runScriptViaSandbox(
  script: string,
  ctx: ScriptRunContext
): Promise<ScriptRunResult> {
  const frame = await ensureSandboxFrame()
  const id = String(++nextId)
  const input = serializeContextForSandbox(script, ctx)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('sandbox script timed out'))
    }, SANDBOX_TIMEOUT_MS)

    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      reject: (e) => {
        clearTimeout(timer)
        reject(e)
      }
    })

    // targetOrigin stays '*': the sandboxed frame's origin is opaque ('null')
    // and never matches a concrete origin, so an explicit targetOrigin would
    // silently drop the message (this is Chrome's own sandboxing-eval pattern).
    // The frame is ours (created above, src pinned to sandbox.html) and the
    // reply path is source-checked in onSandboxMessage.
    frame.contentWindow?.postMessage({ type: 'sandbox:run', id, input }, '*')
  })
}
