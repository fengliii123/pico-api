// History → draft restore mapping: snapshotted entries restore the full
// request state as copies (not references); legacy entries without a
// snapshot degrade to name/method/url only.
import { describe, expect, it } from 'vitest'
import { historyEntryToPatch } from '@/core/history'
import type { HistoryEntry } from '@/core/types'

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'h1',
    requestId: null,
    folderId: null,
    name: 'login',
    method: 'POST',
    url: 'https://api.test/login?debug=1',
    status: 200,
    time: 120,
    size: 300,
    sentAt: 0,
    ...overrides
  }
}

describe('historyEntryToPatch', () => {
  it('legacy entry (no snapshot) yields name/method/url only', () => {
    const patch = historyEntryToPatch(entry())
    expect(patch).toEqual({
      name: 'login',
      method: 'POST',
      url: 'https://api.test/login?debug=1'
    })
  })

  it('snapshotted entry restores headers, params, and body', () => {
    const patch = historyEntryToPatch(entry({
      snapshot: {
        headers: [{ key: 'Authorization', value: 'Bearer x', enabled: true }],
        params: [{ key: 'debug', value: '1', enabled: true }],
        body: { mode: 'raw', rawType: 'json', rawText: '{"a":1}' }
      }
    }))
    expect(patch.headers).toEqual([{ key: 'Authorization', value: 'Bearer x', enabled: true }])
    expect(patch.params).toEqual([{ key: 'debug', value: '1', enabled: true }])
    expect(patch.body).toEqual({ mode: 'raw', rawType: 'json', rawText: '{"a":1}' })
  })

  it('returns copies — mutating the patch never touches the stored entry', () => {
    const e = entry({
      snapshot: {
        headers: [{ key: 'X-A', value: '1', enabled: true }],
        params: [],
        body: { mode: 'raw', rawType: 'json', rawText: 't' }
      }
    })
    const patch = historyEntryToPatch(e)
    patch.headers!.push({ key: 'X-B', value: '2', enabled: true })
    patch.body!.rawText = 'mutated'
    expect(e.snapshot!.headers).toHaveLength(1)
    expect(e.snapshot!.body.rawText).toBe('t')
  })
})
