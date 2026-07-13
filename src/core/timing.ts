import type { ResponseResult } from './types'

// Pull a per-phase timing breakdown (dns / connect / tls / wait / receive)
// from PerformanceResourceTiming for the given URL. Works in any context
// that ran the fetch (options page or service worker); entries live long
// enough for this lookup right after the request completes.
//
// Returns undefined when no usable entry exists (older engines, or the
// resource wasn't recorded).
export function extractResourceTiming(url: string): ResponseResult['timing'] | undefined {
  try {
    const entries = performance.getEntriesByName(url, 'resource') as PerformanceResourceTiming[]
    const entry = entries.find(e => e.responseEnd > e.startTime)
    if (!entry) return undefined
    return {
      dns:     Math.max(0, Math.round(entry.domainLookupEnd - entry.domainLookupStart)),
      connect: Math.max(0, Math.round(entry.connectEnd - entry.connectStart)),
      tls:     entry.secureConnectionStart > 0
        ? Math.max(0, Math.round(entry.connectEnd - entry.secureConnectionStart))
        : 0,
      wait:    Math.max(0, Math.round(entry.responseStart - entry.requestStart)),
      receive: Math.max(0, Math.round(entry.responseEnd - entry.responseStart))
    }
  } catch {
    // Older engines don't have getEntriesByName('resource').
    return undefined
  }
}
