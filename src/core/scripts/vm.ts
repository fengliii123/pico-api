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
    get(name: string): string | undefined
    set(name: string, value: string): void
    unset(name: string): void
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
        header(name: string, value?: string): void
        body(expected?: string): void
      }
      be: {
        below(ceiling: number): { above(floor: number): void }
        readonly ok: void
        readonly created: void
        readonly accepted: void
        readonly badRequest: void
        readonly unauthorized: void
        readonly forbidden: void
        readonly notFound: void
        readonly serverError: void
      }
    }
  }
  test: (name: string, fn: () => void | Promise<void>) => void
  expect: (actual: any) => Assertion
  sendRequest: (url: string, callback: (error: any, response: SendRequestResponse | null) => void) => void
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
    // chai-idiomatic forms without `.be`: expect(x).to.eql(y), to.include, …
    equal(expected: any): void
    eql(expected: any): void
    include(expected: any): void
    a(type: string): void
    an(type: string): void
    have: {
      status(code: number): void
    }
    be: {
      below(ceiling: number): void
      above(floor: number): void
      equal(expected: any): void
      eql(expected: any): void
      include(expected: any): void
      a(type: string): void
      an(type: string): void
      readonly ok: void
      readonly empty: void
      readonly null: void
      readonly undefined: void
      readonly defined: void
      readonly exist: void
      readonly true: void
      readonly false: void
    }
  }
}

// Structural deep-equality for pm.expect().to.eql — keys are compared
// order-insensitively; arrays must have the same length and items.
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every(k => deepEqual(a[k], b[k]))
}

function typeName(v: any): string {
  if (Array.isArray(v)) return 'array'
  if (v === null) return 'null'
  return typeof v
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
  // 'local' matches Postman's pm.variables.* — request-scoped, never
  // persisted, but applied when the request's {{var}} placeholders are
  // (re-)resolved after the pre-request script runs.
  scope: 'environment' | 'globals' | 'local'
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
  // Injected by the host so pm.sendRequest can perform a real GET. Absent
  // in bare test contexts — pm.sendRequest then reports an error callback.
  sendRequest?: SendRequestExecutor
}

export interface SendRequestResult {
  status: number
  statusText: string
  headers: Record<string, string>
  bodyText: string
  time: number
  size: number
}

export type SendRequestExecutor = (url: string) => Promise<SendRequestResult>

/** Postman-shaped response object handed to pm.sendRequest callbacks. */
export interface SendRequestResponse {
  code: number
  status: number
  statusText: string
  headers(): Record<string, string>
  json(): any
  text(): string
  responseTime: number
  size(): { body: number; header: number; total: number }
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
  globals: EnvironmentVariable[],
  sendRequestExecutor?: SendRequestExecutor
): PmApi {
  const envTracked = createTrackedVars(envVars, 'environment')
  const globalsTracked = createTrackedVars(globals, 'globals')
  const localTracked = createTrackedVars([], 'local')
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
      // local wins (Postman scope order), then env, then globals; an
      // unknown name keeps its raw {{name}} placeholder.
      if (Object.prototype.hasOwnProperty.call(localTracked.proxy, name)) {
        return localTracked.proxy[name]!
      }
      if (Object.prototype.hasOwnProperty.call(envTracked.proxy, name)) {
        return envTracked.proxy[name]!
      }
      if (Object.prototype.hasOwnProperty.call(globalsTracked.proxy, name)) {
        return globalsTracked.proxy[name]!
      }
      return `{{${name}}}`
    })
  }

  // Postman's pm.variables.get reads across scopes (local > env > globals);
  // set/unset only touch the request-scoped local layer.
  function localGet(name: string): string | undefined {
    if (Object.prototype.hasOwnProperty.call(localTracked.proxy, name)) return localTracked.proxy[name]
    if (Object.prototype.hasOwnProperty.call(envTracked.proxy, name)) return envTracked.proxy[name]
    if (Object.prototype.hasOwnProperty.call(globalsTracked.proxy, name)) return globalsTracked.proxy[name]
    return undefined
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
    // Postman's collectionVariables have no direct equivalent here (no
    // collection-scope storage) — they alias GLOBALS, the broadest scope
    // this client has. Writes record as scope 'globals'.
    collectionVariables: {
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
    variables: {
      get: localGet,
      set(name: string, value: string) {
        localTracked.proxy[name] = value
        pendingChanges.push(...localTracked.changes.splice(0))
      },
      unset(name: string) {
        delete localTracked.proxy[name]
        pendingChanges.push(...localTracked.changes.splice(0))
      },
      replaceIn
    },
    response: {
      json() { return responseJson },
      text() { return responseText },
      get status() { return response?.status ?? 0 },
      get statusText() { return response?.statusText ?? '' },
      get headers() { return responseHeaders },
      get responseTime() { return response?.time ?? 0 },
      // pm.response.to.* — Postman-style chainable assertions
      get to() {
        const actual = response?.status ?? 0
        const fail = (msg: string): never => { throw new Error(msg) }
        const statusIs = (code: number, label: string) => {
          if (actual !== code) fail(`expected status ${actual} to be ${code} (${label})`)
        }
        return {
          have: {
            status: (code: number) => {
              if (actual !== code) {
                fail(`expected ${actual} to equal ${code}`)
              }
            },
            header: (name: string, value?: string) => {
              const key = name.toLowerCase()
              if (!Object.prototype.hasOwnProperty.call(responseHeaders, key)) {
                fail(`expected header "${name}" to exist`)
              }
              if (value !== undefined && responseHeaders[key] !== value) {
                fail(`expected header "${name}" to be ${JSON.stringify(value)} but got ${JSON.stringify(responseHeaders[key])}`)
              }
            },
            body: (expected?: string) => {
              if (expected === undefined) {
                if (!responseText) fail('expected response body to be non-empty')
              } else if (!responseText.includes(expected)) {
                fail(`expected body to include ${JSON.stringify(expected)}`)
              }
            }
          },
          be: {
            below: (ceiling: number) => ({
              above: (floor: number) => {
                if (actual >= ceiling || actual <= floor) {
                  fail(`expected ${actual} to be between ${floor} and ${ceiling}`)
                }
              }
            }),
            get ok() { if (!(actual >= 200 && actual < 300)) fail(`expected status ${actual} to be 2xx`); return undefined },
            get created() { statusIs(201, 'created'); return undefined },
            get accepted() { statusIs(202, 'accepted'); return undefined },
            get badRequest() { statusIs(400, 'bad request'); return undefined },
            get unauthorized() { statusIs(401, 'unauthorized'); return undefined },
            get forbidden() { statusIs(403, 'forbidden'); return undefined },
            get notFound() { statusIs(404, 'not found'); return undefined },
            get serverError() { if (!(actual >= 500 && actual < 600)) fail(`expected status ${actual} to be 5xx`); return undefined }
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
      const fail = (msg: string): never => { throw new Error(msg) }
      const show = (v: any) => {
        try { return JSON.stringify(v) ?? String(v) } catch { return String(v) }
      }
      // Value assertions live on both `to` and `to.be` — Postman scripts use
      // both spellings (expect(x).to.eql(y) and expect(x).to.be.eql(y)).
      const valueAssertions = {
        equal(expected: any) {
          if (actual !== expected) {
            fail(`expected ${show(actual)} to equal ${show(expected)}`)
          }
        },
        eql(expected: any) {
          if (!deepEqual(actual, expected)) {
            fail(`expected ${show(actual)} to deeply equal ${show(expected)}`)
          }
        },
        include(expected: any) {
          if (typeof actual === 'string') {
            if (!actual.includes(String(expected))) {
              fail(`expected ${show(actual)} to include ${show(expected)}`)
            }
          } else if (Array.isArray(actual)) {
            if (!actual.some(x => deepEqual(x, expected))) {
              fail(`expected array to include ${show(expected)}`)
            }
          } else if (actual && typeof actual === 'object') {
            if (!Object.prototype.hasOwnProperty.call(actual, String(expected))) {
              fail(`expected object to have key ${show(expected)}`)
            }
          } else {
            fail(`expected ${show(actual)} to include ${show(expected)}`)
          }
        },
        a(type: string) {
          const t = typeName(actual)
          if (t !== type) fail(`expected ${show(actual)} (${t}) to be a ${type}`)
        },
        an(type: string) {
          const t = typeName(actual)
          if (t !== type) fail(`expected ${show(actual)} (${t}) to be an ${type}`)
        }
      }
      const be = {
        ...valueAssertions,
        below(ceiling: number) {
          if (actual >= ceiling) {
            fail(`expected ${actual} to be below ${ceiling}`)
          }
        },
        above(floor: number) {
          if (actual <= floor) {
            fail(`expected ${actual} to be above ${floor}`)
          }
        },
        get ok() { if (!actual) return fail(`expected ${show(actual)} to be truthy`); return undefined },
        get empty() {
          if (actual === null || actual === undefined) {
            return fail(`expected ${show(actual)} to be empty`)
          } else if (typeof actual === 'string' || Array.isArray(actual)) {
            if (actual.length !== 0) return fail(`expected value of length ${actual.length} to be empty`)
          } else if (typeof actual === 'object') {
            if (Object.keys(actual).length !== 0) return fail('expected object to be empty')
          } else {
            // numbers / booleans can never be empty (chai semantics)
            return fail(`expected ${show(actual)} to be empty`)
          }
          return undefined
        },
        get null() { if (actual !== null) return fail(`expected ${show(actual)} to be null`); return undefined },
        get undefined() { if (actual !== undefined) return fail(`expected ${show(actual)} to be undefined`); return undefined },
        get defined() { if (actual === undefined) return fail('expected value to be defined'); return undefined },
        get exist() { if (actual === undefined || actual === null) return fail('expected value to exist'); return undefined },
        get true() { if (actual !== true) return fail(`expected ${show(actual)} to be true`); return undefined },
        get false() { if (actual !== false) return fail(`expected ${show(actual)} to be false`); return undefined }
      }
      return {
        to: {
          ...valueAssertions,
          have: {
            status(code: number) {
              if (actual !== code) {
                fail(`expected ${actual} to equal ${code}`)
              }
            }
          },
          be
        }
      }
    },
    // pm.sendRequest(url, cb) — GET a URL and hand the caller a Postman-
    // shaped response. The promise is tracked in _pendingAsyncTests so
    // runScriptDirect waits for the callback chain before returning the
    // script result (var writes made inside the callback must survive).
    sendRequest(url: string, callback: (error: any, response: SendRequestResponse | null) => void) {
      if (!sendRequestExecutor) {
        callback(new Error('pm.sendRequest is not available in this context'), null)
        return
      }
      const run = sendRequestExecutor(url).then(result => {
        const like: SendRequestResponse = {
          code: result.status,
          status: result.status,
          statusText: result.statusText,
          headers: () => result.headers,
          json() {
            try { return JSON.parse(result.bodyText) } catch { return undefined }
          },
          text: () => result.bodyText,
          responseTime: result.time,
          size: () => ({ body: result.size, header: 0, total: result.size })
        }
        try {
          callback(null, like)
        } catch (e: any) {
          pm._tests.push({ name: `pm.sendRequest callback (${url})`, passed: false, error: e?.message ?? String(e) })
        }
      }).catch(err => {
        try {
          callback(err ?? new Error('sendRequest failed'), null)
        } catch (e: any) {
          pm._tests.push({ name: `pm.sendRequest callback (${url})`, passed: false, error: e?.message ?? String(e) })
        }
      })
      pm._pendingAsyncTests!.push(run)
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
    ctx.globals,
    ctx.sendRequest
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
