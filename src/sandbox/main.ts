// MV3 sandbox page — allowed to use new Function() for user scripts while
// extension pages stay on a strict CSP (script-src 'self' only).

import { createPmApi, runScriptDirect } from '@/core/scripts/vm'
import type { SandboxScriptInput } from '@/core/scripts/sandboxHost'
import type { ResponseResult } from '@/core/types'

interface SandboxRunMessage {
  type: 'sandbox:run'
  id: string
  input: SandboxScriptInput
}

interface SandboxResultMessage {
  type: 'sandbox:result'
  id: string
  ok: boolean
  output?: {
    request: {
      url: string
      method: string
      headers: Record<string, string>
      body: string | undefined
    }
    varChanges: unknown[]
    tests: unknown[]
    logs: string[]
  }
  error?: string
}

function responseFromWire(
  wire: SandboxScriptInput['response']
): ResponseResult | null {
  if (!wire) return null
  return {
    status: wire.status,
    statusText: wire.statusText,
    headers: wire.headers,
    body: {
      text: wire.body.text,
      size: wire.body.size,
      blob: new Blob([wire.body.text], { type: wire.mime || 'text/plain' })
    },
    time: wire.time,
    mime: wire.mime,
    timing: wire.timing,
    setCookies: wire.setCookies
  }
}

window.parent.postMessage({ type: 'sandbox:ready' }, '*')

window.addEventListener('message', async (event: MessageEvent<SandboxRunMessage>) => {
  const data = event.data
  if (!data || data.type !== 'sandbox:run') return

  const { id, input } = data
  const logs: string[] = []

  try {
    const pm = createPmApi(
      input.requestUrl,
      input.requestMethod,
      input.requestHeaders,
      input.requestBody,
      responseFromWire(input.response),
      input.envVars,
      input.globals
    )
    await runScriptDirect(input.script, pm, (msg) => logs.push(msg))

    const reply: SandboxResultMessage = {
      type: 'sandbox:result',
      id,
      ok: true,
      output: {
        request: {
          url: pm.request.url,
          method: pm.request.method,
          headers: { ...pm.request.headers },
          body: pm.request.body
        },
        varChanges: pm._varChanges,
        tests: pm._tests,
        logs
      }
    }
    event.source?.postMessage(reply, { targetOrigin: event.origin })
  } catch (e: any) {
    const reply: SandboxResultMessage = {
      type: 'sandbox:result',
      id,
      ok: false,
      error: e?.message ?? String(e)
    }
    event.source?.postMessage(reply, { targetOrigin: event.origin })
  }
})
