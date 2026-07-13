// Merge multiple AbortSignals (user cancel + request timeout) into one
// signal for fetch(). Shared by the direct-fetch path (http.ts) and the
// service-worker fetch (background/index.ts).

export function mergeAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const active = signals.filter((s): s is AbortSignal => s != null)
  if (active.length === 0) return undefined
  if (active.length === 1) return active[0]
  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal && typeof (AbortSignal as any).any === 'function') {
    return (AbortSignal as any).any(active)
  }
  const merged = new AbortController()
  for (const s of active) {
    if (s.aborted) {
      merged.abort()
      break
    }
    s.addEventListener('abort', () => merged.abort(), { once: true })
  }
  return merged.signal
}
