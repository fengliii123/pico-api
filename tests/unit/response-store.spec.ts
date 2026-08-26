import { beforeEach, describe, expect, it } from 'vitest'
import { watchEffect } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useResponseStore } from '@/stores/response'
import { capResponseBlob, maxResponseBytes, streamTruncationNotice } from '@/core/responseSize'
import type { ResponseResult } from '@/core/types'

beforeEach(() => setActivePinia(createPinia()))

describe('responseSize helpers', () => {
  it('maxResponseBytes converts MB → bytes; 0/undefined mean no cap', () => {
    expect(maxResponseBytes(1)).toBe(1024 * 1024)
    expect(maxResponseBytes(2.5)).toBe(2.5 * 1024 * 1024)
    expect(maxResponseBytes(0)).toBe(0)
    expect(maxResponseBytes(undefined)).toBe(0)
  })

  it('streamTruncationNotice mentions the cap size', () => {
    expect(streamTruncationNotice(10)).toContain('10 MB')
  })

  it('capResponseBlob slices to the cap and reports truncation', () => {
    const blob = new Blob(['x'.repeat(100)], { type: 'text/plain' })
    const { finalBlob, truncated } = capResponseBlob(blob, 1)
    expect(truncated).toBe(false)
    expect(finalBlob.size).toBe(100)
  })
})

function sampleResult(overrides: Partial<ResponseResult> = {}): ResponseResult {
  return {
    status: 200,
    statusText: 'OK',
    headers: [],
    body: { blob: new Blob(['ok']), text: 'ok', size: 2 },
    time: 5,
    mime: 'text/plain',
    ...overrides
  } as ResponseResult
}

describe('response store: streaming chunk handling', () => {
  it('appends chunks reactively without replacing the array', () => {
    const store = useResponseStore()
    const lengths: number[] = []
    watchEffect(
      () => {
        lengths.push((store.state as any).chunks?.length ?? -1)
      },
      { flush: 'sync' }
    )

    store.setStreaming('text/event-stream')
    store.appendStreamChunk('a')
    store.appendStreamChunk('bb')

    expect((store.state as any).chunks.map((c: any) => c.text)).toEqual(['a', 'bb'])
    // Every append must have propagated to watchers (new state object per
    // append, not a silent in-place mutation): idle(-1) → setStreaming(0)
    // → append(1) → append(2).
    expect(lengths).toEqual([-1, 0, 1, 2])
  })

  it('ignores chunks that arrive outside the streaming state', () => {
    const store = useResponseStore()
    store.appendStreamChunk('stray')
    expect(store.state.kind).toBe('idle')
  })

  it('releases chunks when a streaming result completes', () => {
    const store = useResponseStore()
    store.setStreaming('text/event-stream')
    store.appendStreamChunk('a')
    store.appendStreamChunk('b')

    const result = sampleResult()
    store.finishStreaming({ ...result, isStreaming: true }, [], { preRequest: [], postResponse: [] })

    const s: any = store.state
    expect(s.kind).toBe('streaming')
    expect(s.completed).toBe(true)
    expect(s.result).toMatchObject(result)
    expect(s.chunks).toHaveLength(0)
  })

  it('falls back to success state for non-streaming results', () => {
    const store = useResponseStore()
    store.setStreaming('application/json')
    const result = sampleResult()
    store.finishStreaming({ ...result, isStreaming: false })
    expect(store.state.kind).toBe('success')
  })
})
