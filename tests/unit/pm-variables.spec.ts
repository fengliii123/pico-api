// pm.variables.* semantics: Postman-style request-scoped local variables.
// set/unset must be tracked with scope 'local' (never persisted), reads
// fall through local → environment → globals, and replaceIn honors the
// same precedence.
import { describe, expect, it } from 'vitest'
import { createPmApi, runScriptDirect } from '@/core/scripts/vm'
import type { EnvironmentVariable } from '@/core/types'

const env: EnvironmentVariable[] = [
  { key: 'host', value: 'env.example.com', enabled: true },
  { key: 'shared', value: 'from-env', enabled: true }
]
const globals: EnvironmentVariable[] = [
  { key: 'gvar', value: 'from-globals', enabled: true }
]

function makePm() {
  return createPmApi('https://x.test/', 'GET', {}, undefined, null, env, globals)
}

describe('pm.variables (local scope)', () => {
  it('set/unset exist and record scope-local changes', async () => {
    const pm = makePm()
    await runScriptDirect("pm.variables.set('ts', '1700'); pm.variables.set('gone', 'x'); pm.variables.unset('gone')", pm)
    const localSets = pm._varChanges.filter(c => c.scope === 'local')
    expect(localSets).toContainEqual({ scope: 'local', op: 'set', key: 'ts', value: '1700' })
    expect(localSets).toContainEqual({ scope: 'local', op: 'unset', key: 'gone' })
  })

  it('get resolves local → environment → globals', async () => {
    const pm = makePm()
    await runScriptDirect("pm.variables.set('shared', 'from-local')", pm)
    expect(pm.variables.get('shared')).toBe('from-local')
    expect(pm.variables.get('host')).toBe('env.example.com')
    expect(pm.variables.get('gvar')).toBe('from-globals')
    expect(pm.variables.get('nope')).toBeUndefined()
  })

  it('replaceIn prefers local writes over environment values', async () => {
    const pm = makePm()
    await runScriptDirect("pm.variables.set('shared', 'local-wins')", pm)
    expect(pm.variables.replaceIn('{{shared}} {{host}} {{unknown}}')).toBe(
      'local-wins env.example.com {{unknown}}'
    )
  })

  it('environment and globals changes keep their own scopes', async () => {
    const pm = makePm()
    await runScriptDirect("pm.environment.set('e', '1'); pm.globals.set('g', '2')", pm)
    expect(pm._varChanges).toContainEqual({ scope: 'environment', op: 'set', key: 'e', value: '1' })
    expect(pm._varChanges).toContainEqual({ scope: 'globals', op: 'set', key: 'g', value: '2' })
  })
})
