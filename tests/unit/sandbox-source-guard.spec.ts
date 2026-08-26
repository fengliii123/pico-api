// Guards for the sandbox postMessage channel: the parent only accepts
// messages from its own sandbox iframe, and the sandbox only accepts
// run requests from its parent. Both origins are opaque, so the checks
// compare event.source, not event.origin.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScriptRunContext } from '@/core/scripts/vm'

// sandboxHost creates its iframe via chrome.runtime.getURL — provide it
// before the module is (dynamically) imported.
;(globalThis as any).chrome = {
  runtime: { getURL: (p: string) => `chrome-extension://test-id/${p}` }
}

function msg(data: unknown, source: unknown): MessageEvent {
  const e = new MessageEvent('message', { data })
  // Not every DOM impl honors the `source` init field — force it.
  Object.defineProperty(e, 'source', { value: source })
  return e
}

const ctx: ScriptRunContext = {
  requestUrl: 'https://example.com',
  requestMethod: 'GET',
  requestHeaders: {},
  requestBody: undefined,
  response: null,
  envVars: [],
  globals: []
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe('sandboxHost: only accepts messages from its own iframe', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach((f) => f.remove())
    vi.restoreAllMocks()
  })

  it('ignores ready/result from a foreign source but accepts them from the sandbox frame', async () => {
    // Stop happy-dom from actually fetching the chrome-extension:// src
    // (it would fire an async error event and tear the frame down).
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'iframe') {
        Object.defineProperty(el, 'src', { get: () => '', set: () => {} })
      }
      return el
    }) as any)

    const { runScriptViaSandbox } = await import('@/core/scripts/sandboxHost')

    const runP = runScriptViaSandbox('1', ctx)
    const frame = document.querySelector('iframe')
    expect(frame).not.toBeNull()
    const cw = frame!.contentWindow!
    cw.postMessage = vi.fn()

    // Foreign ready must be ignored (sandbox never becomes ready).
    window.dispatchEvent(msg({ type: 'sandbox:ready' }, {}))
    await flush()
    expect(cw.postMessage).not.toHaveBeenCalled()

    // Real ready arrives from the sandbox frame → the run request goes out.
    window.dispatchEvent(msg({ type: 'sandbox:ready' }, cw))
    await flush()
    expect(cw.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sandbox:run', id: '1' }),
      '*'
    )

    // Foreign result must be ignored (promise stays pending)…
    window.dispatchEvent(
      msg({ type: 'sandbox:result', id: '1', ok: true, output: undefined }, {})
    )
    await flush()
    let settled = false
    runP.then(() => { settled = true })
    await flush()
    expect(settled).toBe(false)

    // …the result from the actual frame resolves it.
    window.dispatchEvent(
      msg(
        { type: 'sandbox:result', id: '1', ok: true, output: { request: { url: 'https://example.com', method: 'GET', headers: {}, body: undefined }, varChanges: [], tests: [], logs: [] } },
        cw
      )
    )
    await expect(runP).resolves.toMatchObject({ logs: [] })
  })
})

describe('sandbox page: only accepts run requests from the parent', () => {
  it('replies to the parent and stays silent for foreign sources', async () => {
    const postMessage = vi.fn()
    ;(window as any).postMessage = postMessage
    // The sandbox posts sandbox:ready to its parent on load; window.parent
    // === window under happy-dom, so the spy above captures it.
    await import('@/sandbox/main')
    expect(postMessage).toHaveBeenCalledWith({ type: 'sandbox:ready' }, '*')

    // Foreign source → ignored, no reply.
    window.dispatchEvent(
      msg({ type: 'sandbox:run', id: '9', input: undefined }, { fake: true })
    )
    await flush()
    expect(postMessage).toHaveBeenCalledTimes(1)

    // Parent source → script runs, reply is posted back.
    window.dispatchEvent(
      msg({ type: 'sandbox:run', id: '10', input: { ...ctx, script: 'pm.test("ok", () => true)' } }, window)
    )
    await flush()
    expect(postMessage).toHaveBeenCalledTimes(2)
    const reply: any = postMessage.mock.calls[1]![0]
    expect(reply.type).toBe('sandbox:result')
    expect(reply.ok).toBe(true)
    expect(reply.output.tests).toHaveLength(1)
  })
})
