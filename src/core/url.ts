import type { KeyValueRow } from './types'

// Merge query params into a URL. Disabled rows are skipped.
// If the user typed a URL without a scheme (e.g. "example.com/api"), we
// transparently prepend "https://" — otherwise fetch() would treat it as
// a relative URL and request the chrome-extension's own origin.
//
// Normalize scheme only. Query params are merged separately via
// `urlWithParams` (normalize / setParams) so import/load paths that
// populate `params[]` without touching the URL bar still send correctly.
export function buildUrl(baseUrl: string, _params: KeyValueRow[] = []): string {
  if (!baseUrl) return ''
  const trimmed = baseUrl.trim()
  // Preserve the URL verbatim. We still auto-prepend https:// for scheme-less
  // inputs so fetch() doesn't treat the URL as relative.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !trimmed.startsWith('//')) {
    return 'https://' + trimmed
  }
  return trimmed
}

// Parse a raw query string (no leading '?') into rows. Strips any
// trailing #fragment before parsing — URLSearchParams would otherwise
// treat it as part of the last value.
function queryStringToRows(rawQuery: string): KeyValueRow[] {
  const fragIdx = rawQuery.indexOf('#')
  const qs = fragIdx >= 0 ? rawQuery.slice(0, fragIdx) : rawQuery
  if (!qs) return []
  try {
    const sp = new URLSearchParams(qs)
    const rows: KeyValueRow[] = []
    for (const [k, v] of sp) rows.push({ key: k, value: v, enabled: true })
    return rows
  } catch {
    return []
  }
}

// Parse just the query string of a URL into rows. URLSearchParams handles
// decoding + repeated keys. Returns [] when there's no query or it can't be
// parsed. Used by the request store to seed the Params tab from a URL.
export function parseQueryParams(url: string): KeyValueRow[] {
  const qIdx = url.indexOf('?')
  if (qIdx === -1) return []
  return queryStringToRows(url.slice(qIdx + 1))
}

// Parse the query string out of a URL into KeyValueRow[]. We use this in two
// directions:
//   1. On load (saved request → draft): seed the Params tab from the URL.
//   2. While typing the URL: if the user appends "?foo=1&bar=2" inline, we
//      move those into the Params tab so the URL stays clean.
//
// URLSearchParams already handles decoding + repeated keys.
export function extractParamsFromUrl(baseUrl: string): { url: string; params: KeyValueRow[] } {
  if (!baseUrl) return { url: '', params: [] }
  const trimmed = baseUrl.trim()
  const scheme = !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !trimmed.startsWith('//')
    ? 'https://' + trimmed
    : trimmed

  const qIdx = scheme.indexOf('?')
  if (qIdx === -1) {
    return { url: trimmed, params: [] }
  }
  const url = scheme.slice(0, qIdx)
  const params = queryStringToRows(scheme.slice(qIdx + 1))
  // Return the URL without the query, preserving whatever scheme we applied.
  const result = scheme.startsWith('https://') && !trimmed.startsWith('https://')
    ? url.replace(/^https:\/\//, '')
    : url
  return { url: result, params }
}

// Rebuild a URL from the base (without query) + a list of enabled params.
// Used when the user edits the Params tab and wants the changes reflected
// back into the URL bar.
export function joinParamsToUrl(baseUrl: string, params: KeyValueRow[]): string {
  const trimmed = baseUrl.trim()
  const enabled = params.filter(p => p.enabled && p.key.trim() !== '')
  if (enabled.length === 0) return trimmed
  const qs = enabled.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
  return `${trimmed}?${qs}`
}

// Strip any query on `baseUrl` and rebuild it from enabled Params rows.
// Used at send time (normalize) and when persisting imported requests.
export function urlWithParams(baseUrl: string, params: KeyValueRow[]): string {
  const base = extractParamsFromUrl(baseUrl).url
  return joinParamsToUrl(base, params)
}