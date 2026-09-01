import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractResourceTiming } from '@/core/timing'

function entry(overrides: Partial<PerformanceResourceTiming> = {}) {
  return {
    startTime: 0,
    domainLookupStart: 5, domainLookupEnd: 15,
    connectStart: 20, connectEnd: 40,
    secureConnectionStart: 25,
    requestStart: 45, responseStart: 80, responseEnd: 100,
    ...overrides,
  } as PerformanceResourceTiming
}

afterEach(() => vi.unstubAllGlobals())

describe('extractResourceTiming', () => {
  it('returns undefined when no resource entry exists', () => {
    vi.stubGlobal('performance', { getEntriesByName: () => [] })
    expect(extractResourceTiming('https://api.test/x')).toBeUndefined()
  })

  it('extracts per-phase values from the entry', () => {
    vi.stubGlobal('performance', { getEntriesByName: () => [entry()] })
    const t = extractResourceTiming('https://api.test/x')!
    expect(t).toBeDefined()
    expect(t!.dns).toBe(10)
    expect(t!.connect).toBe(20)
    expect(t!.tls).toBe(15)
    expect(t!.wait).toBe(35)
    expect(t!.receive).toBe(20)
  })

  it('uses the LATEST entry when the same URL was requested twice', () => {
    const old = entry({ startTime: 0, responseStart: 80, responseEnd: 100 })
    const latest = entry({ startTime: 1000, responseStart: 1030, responseEnd: 1040 })
    vi.stubGlobal('performance', { getEntriesByName: () => [old, latest] })
    const t = extractResourceTiming('https://api.test/x')!
    // receive from the latest entry (10 ms), not the old one (20 ms)
    expect(t!.receive).toBe(10)
  })

  it('skips entries that never completed (responseEnd <= startTime)', () => {
    const aborted = entry({ startTime: 0, responseStart: 0, responseEnd: 0 })
    const good = entry({ startTime: 100, responseStart: 130, responseEnd: 140 })
    vi.stubGlobal('performance', { getEntriesByName: () => [aborted, good] })
    expect(extractResourceTiming('https://api.test/x')).toBeDefined()
  })
})
