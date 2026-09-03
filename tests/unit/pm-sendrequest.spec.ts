// pm.sendRequest + pm.collectionVariables semantics.
// sendRequest: executor-injected success/error paths, callback var writes
// survive (runner awaits), no-executor reports an error callback.
// collectionVariables: read/write alias over globals (scope 'globals').
import { describe, expect, it } from 'vitest'
import { createPmApi, runScriptDirect, type SendRequestExecutor } from '@/core/scripts/vm'
import type { EnvironmentVariable } from '@/core/types'

const env: EnvironmentVariable[] = [{ key: 'host', value: 'x.test', enabled: true }]
const globals: EnvironmentVariable[] = []

function makePm(executor?: SendRequestExecutor) {
  return createPmApi('https://x.test/', 'GET', {}, undefined, null, env, globals, executor)
}

function okExecutor(payload: Partial<Parameters<SendRequestExecutor>[0] extends never ? never : any> = {}): SendRequestExecutor {
  return async () => ({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    bodyText: '{"name":"Leanne","token":"abc"}',
    time: 55,
    size: 30,
    ...payload
  })
}

describe('pm.sendRequest', () => {
  it('hands the callback a Postman-shaped response and awaits its var writes', async () => {
    const pm = makePm(okExecutor())
    await runScriptDirect(
      `pm.sendRequest('https://x.test/token', (err, res) => {
         if (err) { pm.environment.set('token', 'ERR'); return }
         pm.environment.set('token', res.json().token)
         pm.globals.set('code', String(res.status))
       })`,
      pm
    )
    expect(pm._varChanges).toContainEqual({ scope: 'environment', op: 'set', key: 'token', value: 'abc' })
    expect(pm._varChanges).toContainEqual({ scope: 'globals', op: 'set', key: 'code', value: '200' })
  })

  it('exposes text(), headers(), responseTime and size()', async () => {
    const pm = makePm(okExecutor())
    await runScriptDirect(
      `pm.sendRequest('https://x.test/', (err, res) => {
         pm.environment.set('summary', res.text() + '|' + res.headers()['content-type'] + '|' + res.responseTime + '|' + res.size().total)
       })`,
      pm
    )
    const change = pm._varChanges.find(c => c.key === 'summary')
    expect(change?.value).toBe('{"name":"Leanne","token":"abc"}|application/json|55|30')
  })

  it('delivers executor failures to the callback error argument', async () => {
    const pm = makePm(async () => { throw new Error('network down') })
    await runScriptDirect(
      `pm.sendRequest('https://x.test/', (err, res) => {
         pm.environment.set('failed', err ? err.message : 'no')
       })`,
      pm
    )
    expect(pm._varChanges).toContainEqual({ scope: 'environment', op: 'set', key: 'failed', value: 'network down' })
  })

  it('without an executor the callback receives an error immediately', async () => {
    const pm = makePm(undefined)
    await runScriptDirect(
      `pm.sendRequest('https://x.test/', (err) => {
         pm.environment.set('state', err ? 'unavailable' : 'ok')
       })`,
      pm
    )
    expect(pm._varChanges).toContainEqual({ scope: 'environment', op: 'set', key: 'state', value: 'unavailable' })
  })
})

describe('pm.collectionVariables (globals alias)', () => {
  it('writes record as globals scope and read back through both APIs', async () => {
    const pm = makePm()
    await runScriptDirect(
      `pm.collectionVariables.set('cv', '1'); pm.environment.set('noop', 'x')`,
      pm
    )
    expect(pm._varChanges).toContainEqual({ scope: 'globals', op: 'set', key: 'cv', value: '1' })
    expect(pm.collectionVariables.get('cv')).toBe('1')
    expect(pm.globals.get('cv')).toBe('1')
  })

  it('unset removes from globals', async () => {
    const pm = makePm()
    await runScriptDirect(`pm.collectionVariables.set('gone', 'x'); pm.collectionVariables.unset('gone')`, pm)
    expect(pm._varChanges).toContainEqual({ scope: 'globals', op: 'unset', key: 'gone' })
    expect(pm.collectionVariables.get('gone')).toBeUndefined()
  })
})
