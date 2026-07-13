// pm.* API simulator for pre-request and test scripts (essentials only).

import type { KeyValueRow, ResponseResult, EnvironmentVariable } from '../types'


export interface PmApi {
  request: {
    url: string
    method: string
    headers: Record<string, string>
    body: string | undefined
  }
  environment: {
    get(name: string): string | undefined
    set(name: string, value: string): void
    unset(name: string): void
  }
  collectionVariables: {
    get(name: string): string | undefined
    set(name: string, value: string): void
    unset(name: string): void
  }
  globals: {
    get(name: string): string | undefined
    set(name: string, value: string): void
    unset(name: string): void
  }
  variables: {
    replaceIn(text: string): string
  }
  response: {
    json(): any
    text(): string
    status: number
    statusText: string
    headers: Record<string, string>
    responseTime: number
    size(): { body: number; header: number; total: number }
    to: {
      have: {
        status(code: number): void
      }
      be: {
        below(ceiling: number): { above(floor: number): void }
      }
    }
  }
  test: (name: string, fn: () => void | Promise<void>) => void
  expect: (actual: any) => Assertion
  // Internal: collected test results
  _tests: TestResult[]
  // Internal: variable changes made by the script via pm.environment /
  // pm.globals. The caller (RequestEditor) reads this after runScript
  // returns and persists it back to the envStore.
  _varChanges: VariableChange[]
  /** @internal async pm.test() callbacks awaited by runScriptDirect */
  _pendingAsyncTests?: Promise<void>[]
}

export interface Assertion {
  to: {
    have: {
      status(code: number): void
    }
    be: {
      below(ceiling: number): void
      above(floor: number): void
    }
  }
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

// Build the pm API object that gets injected into user scripts.
//
// Variable scopes are tracked through Proxy wrappers. Each set/unset on
// the sandboxed env/globals record is recorded into `pendingChanges` so
// the caller (RequestEditor) can persist the changes to the envStore
// and also re-resolve {{var}} placeholders in the request after
// pre-request scripts run. This matches Postman's "scripts see their
// own writes immediately, and the next request sees them too" semantics.
export interface VariableChange {
  scope: 'environment' | 'globals'
  op: 'set' | 'unset'
  key: string
  value?: string
}

export interface ScriptRunContext {
  requestUrl: string
  requestMethod: string
  requestHeaders: Record<string, string>
  requestBody: string | undefined
  response: ResponseResult | null
  envVars: EnvironmentVariable[]
  globals: EnvironmentVariable[]
}

export interface ScriptRunResult {
  request: PmApi['request']
  varChanges: VariableChange[]
  tests: TestResult[]
  logs: string[]
}

function createTrackedVars(
  initial: EnvironmentVariable[],
  scope: VariableChange['scope']
): { proxy: Record<string, string>; changes: VariableChange[]; snapshot: EnvironmentVariable[] } {
  // Snapshot of the initial list — used by the caller to compute the
  // "next variables array" without touching the store directly.
  const snapshot = initial.filter(v => v.enabled && v.key).map(v => ({ ...v }))
  const base: Record<string, string> = {}
  for (const v of snapshot) base[v.key] = v.value
  const changes: VariableChange[] = []
  const proxy = new Proxy(base, {
    set(_target, key, value) {
      if (typeof key !== 'string') return false
      changes.push({ scope, op: 'set', key, value: String(value) })
      base[key] = String(value)
      return true
    },
    deleteProperty(_target, key) {
      if (typeof key !== 'string') return false
      // Only record a delete if the key was actually present — Postman
      // doesn't surface unset-of-missing as an error, but the
      // persistence path shouldn't churn the store on no-op deletes.
      if (key in base) {
        changes.push({ scope, op: 'unset', key })
        delete base[key]
      }
      return true
    }
  })
  return { proxy, changes, snapshot }
}

export function createPmApi(
  requestUrl: string,
  requestMethod: string,
  requestHeaders: Record<string, string>,
  requestBody: string | undefined,
  response: ResponseResult | null,
  envVars: EnvironmentVariable[],
  globals: EnvironmentVariable[]
): PmApi {
  const envTracked = createTrackedVars(envVars, 'environment')
  const globalsTracked = createTrackedVars(globals, 'globals')
  const pendingChanges: VariableChange[] = []

  // pm.variables.replaceIn — replace {{var}} placeholders. Reads through
  // the tracked proxies, so script-visible writes take effect within the
  // same script run (e.g. set('foo','x'); replaceIn('{{foo}}') → 'x').
  function replaceIn(text: string): string {
    return text.replace(/\{\{(\$guid|\$timestamp|\$randomUUID)\}\}/g, (_, token: string) => {
      if (token === '$guid') {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
      }
      if (token === '$timestamp') return String(Date.now())
      return crypto.randomUUID()
    }).replace(/\{\{([^}]+)\}\}/g, (_, name) => {
      // envTracked.proxy reflects in-script writes (set inside the
      // tracked proxy's `set` trap). globals overlay: env wins, then
      // globals, then the raw {{name}} placeholder is preserved.
      if (Object.prototype.hasOwnProperty.call(envTracked.proxy, name)) {
        return envTracked.proxy[name]!
      }
      if (Object.prototype.hasOwnProperty.call(globalsTracked.proxy, name)) {
        return globalsTracked.proxy[name]!
      }
      return `{{${name}}}`
    })
  }

  // Build response object for tests
  let responseJson: any = undefined
  let responseText = ''
  if (response) {
    responseText = response.body.text
    try {
      responseJson = JSON.parse(responseText)
    } catch {
      // not JSON
    }
  }

  const responseHeaders: Record<string, string> = {}
  if (response) {
    for (const [k, v] of response.headers) {
      responseHeaders[k.toLowerCase()] = v
    }
  }

  const pendingAsyncTests: Promise<void>[] = []

  const pm: PmApi = {
    request: {
      url: requestUrl,
      method: requestMethod,
      headers: requestHeaders,
      body: requestBody
    },
    environment: {
      get(name: string) {
        return Object.prototype.hasOwnProperty.call(envTracked.proxy, name)
          ? envTracked.proxy[name]
          : undefined
      },
      set(name: string, value: string) {
        // Going through the tracked proxy records the change in
        // `envTracked.changes` and updates the read-through view.
        envTracked.proxy[name] = value
        pendingChanges.push(...envTracked.changes.splice(0))
      },
      unset(name: string) {
        delete envTracked.proxy[name]
        pendingChanges.push(...envTracked.changes.splice(0))
      }
    },
    collectionVariables: {
      get(name: string) {
        console.warn(`pm.collectionVariables.get('${name}') is not supported — this client has no collection-scope variables. Use pm.environment or pm.globals instead.`)
        return undefined
      },
      set(name: string, _value: string) {
        console.warn(`pm.collectionVariables.set('${name}', ...) is not supported — this client has no collection-scope variables. Use pm.environment.set or pm.globals.set instead.`)
      },
      unset(name: string) {
        console.warn(`pm.collectionVariables.unset('${name}') is not supported — this client has no collection-scope variables. Use pm.environment.unset or pm.globals.unset instead.`)
      }
    },
    globals: {
      get(name: string) {
        return Object.prototype.hasOwnProperty.call(globalsTracked.proxy, name)
          ? globalsTracked.proxy[name]
          : undefined
      },
      set(name: string, value: string) {
        globalsTracked.proxy[name] = value
        pendingChanges.push(...globalsTracked.changes.splice(0))
      },
      unset(name: string) {
        delete globalsTracked.proxy[name]
        pendingChanges.push(...globalsTracked.changes.splice(0))
      }
    },
    variables: { replaceIn },
    response: {
      json() { return responseJson },
      text() { return responseText },
      get status() { return response?.status ?? 0 },
      get statusText() { return response?.statusText ?? '' },
      get headers() { return responseHeaders },
      get responseTime() { return response?.time ?? 0 },
      // pm.response.to.have.status(200) - Postman-style chainable assertion
      get to() {
        const actual = response?.status ?? 0
        return {
          have: {
            status: (code: number) => {
              if (actual !== code) {
                throw new Error(`expected ${actual} to equal ${code}`)
              }
            }
          },
          be: {
            below: (ceiling: number) => ({
              above: (floor: number) => {
                if (actual >= ceiling || actual <= floor) {
                  throw new Error(`expected ${actual} to be between ${floor} and ${ceiling}`)
                }
              }
            })
          }
        }
      },
      size() {
        return {
          body: response?.body.size ?? 0,
          header: 0,
          total: response?.body.size ?? 0
        }
      }
    },
    test(name: string, fn: () => void | Promise<void>) {
      // Sync path: run fn, record outcome immediately.
      // Async path: do NOT record anything up-front — wait for the promise
      // to settle, otherwise we'd push a spurious `passed: true` entry that
      // later rejects into a same-named `passed: false`, leaving the test
      // list with two entries for one logical test.
      try {
        const result = fn()
        if (result instanceof Promise) {
          pendingAsyncTests.push(
            result.then(() => {
              pm._tests.push({ name, passed: true })
            }).catch((e: any) => {
              pm._tests.push({ name, passed: false, error: e?.message ?? String(e) })
            })
          )
        } else {
          pm._tests.push({ name, passed: true })
        }
      } catch (e: any) {
        pm._tests.push({ name, passed: false, error: e?.message ?? String(e) })
      }
    },
    expect(actual: any): Assertion {
      return {
        to: {
          have: {
            status(code: number) {
              if (actual !== code) {
                throw new Error(`expected ${actual} to equal ${code}`)
              }
            }
          },
          be: {
            below(ceiling: number) {
              if (actual >= ceiling) {
                throw new Error(`expected ${actual} to be below ${ceiling}`)
              }
            },
            above(floor: number) {
              if (actual <= floor) {
                throw new Error(`expected ${actual} to be above ${floor}`)
              }
            }
          }
        }
      }
    },
    _tests: [],
    _varChanges: pendingChanges,
    _pendingAsyncTests: pendingAsyncTests
  }

  return pm
}

// Execute user script code via new Function. Only call from extension
// sandbox pages or non-CSP contexts (vitest); extension UI pages route
// through sandboxHost.ts instead.
export async function runScriptDirect(
  script: string,
  pm: PmApi,
  onLog?: (msg: string) => void
): Promise<void> {
  if (!script.trim()) return

  // Create console proxy for logging
  const logs: string[] = []
  const proxiedConsole = new Proxy(console, {
    get(_target, prop) {
      if (prop === 'log' || prop === 'info' || prop === 'warn' || prop === 'error') {
        return (...args: any[]) => {
          const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
          logs.push(msg)
          onLog?.(msg)
        }
      }
      return (console as any)[prop]
    }
  })

  try {
    const fn = new Function('pm', 'console', script)
    await fn(pm, proxiedConsole)
  } catch (e: any) {
    logs.push(`[Script Error] ${e?.message ?? String(e)}`)
    onLog?.(`[Script Error] ${e?.message ?? String(e)}`)
  }

  if (pm._pendingAsyncTests?.length) {
    await Promise.all(pm._pendingAsyncTests)
  }
}

declare const chrome: { runtime?: { id?: string } } | undefined

function hasExtensionRuntime(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome?.runtime?.id
  } catch {
    return false
  }
}

function emptyScriptResult(ctx: ScriptRunContext): ScriptRunResult {
  return {
    request: {
      url: ctx.requestUrl,
      method: ctx.requestMethod,
      headers: { ...ctx.requestHeaders },
      body: ctx.requestBody
    },
    varChanges: [],
    tests: [],
    logs: []
  }
}

// Run a pre/post-request script. Uses the MV3 sandbox iframe when loaded
// as an extension page; falls back to direct execution in vitest / vite dev.
export async function runScript(
  script: string,
  ctx: ScriptRunContext,
  onLog?: (msg: string) => void
): Promise<ScriptRunResult> {
  if (!script.trim()) return emptyScriptResult(ctx)

  if (hasExtensionRuntime()) {
    const { runScriptViaSandbox } = await import('./sandboxHost')
    const result = await runScriptViaSandbox(script, ctx)
    for (const line of result.logs) onLog?.(line)
    return result
  }

  const pm = createPmApi(
    ctx.requestUrl,
    ctx.requestMethod,
    ctx.requestHeaders,
    ctx.requestBody,
    ctx.response,
    ctx.envVars,
    ctx.globals
  )
  const logs: string[] = []
  await runScriptDirect(script, pm, (msg) => {
    logs.push(msg)
    onLog?.(msg)
  })
  return {
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
