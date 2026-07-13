// Structured-ish deep clone via a JSON round-trip.
//
// Used at persistence / snapshot boundaries where we need a detached copy
// that carries no Vue reactive Proxy wrappers (IndexedDB's structured
// clone — and fake-indexeddb in tests — chokes on Proxies). Our stored
// schema is plain JSON (no Date / Map / Set / File bytes), so the JSON
// round-trip is lossless for the shapes we actually persist.
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}
