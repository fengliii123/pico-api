import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRequestStore } from '@/stores/request'

beforeEach(() => setActivePinia(createPinia()))

function typeRawJson(text: string) {
  const s = useRequestStore()
  s.setMethod('POST')
  s.setBody({ mode: 'raw', rawType: 'json', rawText: text })
  return s
}

describe('method round trip preserves body', () => {
  it('POST → GET → POST restores the typed body instead of reseeding', () => {
    const s = typeRawJson('{"a":1}')
    s.setMethod('GET')
    expect(s.draft.body.mode).toBe('none')
    s.setMethod('POST')
    expect(s.draft.body).toEqual({ mode: 'raw', rawType: 'json', rawText: '{"a":1}' })
  })

  it('fresh POST still seeds an empty raw JSON body', () => {
    const s = useRequestStore()
    s.setMethod('GET')
    s.setMethod('POST')
    expect(s.draft.body).toEqual({ mode: 'raw', rawType: 'json', rawText: '' })
  })

  it('stash does not leak across request loads', () => {
    const s = typeRawJson('{"keep":true}')
    s.setMethod('GET')
    s.loadFromDraft({ ...s.draft, id: null })
    s.setMethod('POST')
    expect(s.draft.body).toEqual({ mode: 'raw', rawType: 'json', rawText: '' })
  })

  it('body edited while on POST after a round trip is not clobbered by another round trip', () => {
    const s = typeRawJson('{"first":1}')
    s.setMethod('GET')
    s.setMethod('POST')
    s.setBody({ mode: 'raw', rawType: 'json', rawText: '{"second":2}' })
    s.setMethod('GET')
    s.setMethod('PUT')
    expect(s.draft.body).toEqual({ mode: 'raw', rawType: 'json', rawText: '{"second":2}' })
  })
})
