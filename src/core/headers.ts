import type { KeyValueRow, RequestBody } from './types'

// Headers the browser refuses to let us set via fetch / XHR.
// Mirrors the Postman Legacy banned list.
export const BANNED_HEADERS: ReadonlySet<string> = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'content-transfer-encoding',
  'date',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'user-agent',
  'via'
])

export interface ProcessedHeaders {
  headers: Record<string, string>
  dropped: Array<{ key: string; value: string; reason: string }>
}

// Convert KeyValueRow[] into a fetch-compatible headers record.
// Empty-value rows are skipped. Banned headers are dropped (with reason).
// Auto-injects Content-Type for urlencoded body mode.
export function processHeaders(
  rows: KeyValueRow[],
  body: RequestBody
): ProcessedHeaders {
  const headers: Record<string, string> = {}
  const dropped: ProcessedHeaders['dropped'] = []

  for (const row of rows) {
    if (!row.enabled) continue
    const key = row.key.trim()
    if (!key) continue
    if (row.value === '' || row.value == null) continue

    const lower = key.toLowerCase()
    if (BANNED_HEADERS.has(lower)) {
      dropped.push({ key, value: row.value, reason: 'dropped-by-browser:browser-bans-this-header' })
      continue
    }
    headers[key] = row.value
  }

  // Auto Content-Type by body mode (only when the user hasn't set one).
  //
  // Without this, raw JSON requests are sent without a Content-Type and the
  // server typically rejects them with 415 — but the user has no UI signal
  // explaining why. We auto-inject so the most common cases "just work".
  // Each auto-injection is also reported via `dropped` (we abuse the field
  // name to mean "did-not-come-from-user" — UI checks the `reason` prefix
  // and renders virtual rows for visibility).
  if (body.mode === 'urlencoded' && !hasHeader(headers, 'content-type')) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    dropped.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded', reason: 'auto-injected:body-mode-urlencoded' })
  } else if (body.mode === 'raw') {
    const t = body.rawType ?? 'json'
    // JSON & XML are by spec UTF-8 unless told otherwise. Pinning the
    // charset in the auto-injected Content-Type matches what fetch will
    // send anyway and makes the intent obvious when reading the request.
    const ct =
      t === 'json' ? 'application/json; charset=utf-8' :
      t === 'xml'  ? 'application/xml; charset=utf-8'  :
      /* text */     'text/plain; charset=utf-8'
    if (!hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = ct
      dropped.push({ key: 'Content-Type', value: ct, reason: `auto-injected:raw-${t}` })
    }
  }
  // For multipart/form-data, fetch generates the boundary itself and refuses
  // a hand-set Content-Type missing the boundary. We surface a pre-filled,
  // editable Content-Type row so the user sees what's going to be sent and
  // can override it (rare, but useful for advanced cases). The placeholder
  // value is stripped at the bottom of this function so the browser can
  // generate the real boundary at fetch time.
  if (body.mode === 'formdata') {
    const ctKey = Object.keys(headers).find(k => k.toLowerCase() === 'content-type')
    if (!ctKey) {
      headers['Content-Type'] = 'multipart/form-data; boundary=<set by browser>'
      dropped.push({
        key: 'Content-Type',
        value: 'multipart/form-data; boundary=<set by browser>',
        reason: 'auto-injected:body-mode-formdata'
      })
    } else if (!/boundary=/i.test(headers[ctKey])) {
      // A user-set Content-Type without a boundary can't describe the multipart
      // body we build — the boundary must match byte-for-byte. Drop it so
      // normalize() (or the browser) pins the authoritative one. A Content-Type
      // that already carries an explicit boundary is left alone for advanced
      // overrides.
      dropped.push({ key: ctKey, value: headers[ctKey], reason: 'dropped:multipart-boundary-managed' })
      delete headers[ctKey]
    }
  }

  // Strip the placeholder we injected above unless the user has replaced it
  // with a real value. Anything containing the sentinel `<set by browser>`
  // is dropped silently (no `dropped` entry) so fetch can generate a fresh
  // boundary — the auto-injected entry above already covers UI feedback.
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === 'content-type' && headers[k].includes('<set by browser>')) {
      delete headers[k]
    }
  }

  return { headers, dropped }
}

function hasHeader(headers: Record<string, string>, lowerName: string): boolean {
  return Object.keys(headers).some(k => k.toLowerCase() === lowerName)
}

//
// Ordered roughly by perceived request frequency — Postman's Quick Headers
// panel uses a similar ordering. Used by KeyValueTable.vue to populate the
// per-row AutoComplete dropdowns.
export const commonHeaderKeys: string[] = [
  'Accept',
  'Accept-Charset',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Disposition',
  'Content-Encoding',
  'Content-Language',
  'Content-Length',
  'Content-Type',
  'Cookie',
  'Date',
  'ETag',
  'Expires',
  'Host',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'Origin',
  'Pragma',
  'Referer',
  'Server',
  'Set-Cookie',
  'Transfer-Encoding',
  'User-Agent',
  'Vary',
  'X-Api-Key',
  'X-CSRF-Token',
  'X-Forwarded-For',
  'X-Frame-Options',
  'X-Requested-With'
]

const TEXT_MIME = [
  'text/plain',
  'text/html',
  'text/css',
  'text/csv',
  'text/xml',
  'application/xml'
]
const APP_MIME = [
  'application/json',
  'application/xml',
  'application/yaml',
  'application/javascript',
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'application/x-www-form-urlencoded',
  'application/graphql',
  'application/ld+json'
]
const IMAGE_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif'
]
const ALL_MIME = [...APP_MIME, ...TEXT_MIME, ...IMAGE_MIME]

const HEADER_VALUE_TABLES: Record<string, string[]> = {
  'Content-Type': [...APP_MIME, ...TEXT_MIME, ...IMAGE_MIME, 'multipart/form-data'],
  Accept: ['*/*', ...ALL_MIME],
  'Accept-Encoding': ['gzip', 'deflate', 'br', 'gzip, deflate, br', 'identity'],
  'Accept-Language': ['en-US', 'en', 'zh-CN', 'zh', 'fr', 'de', 'ja'],
  'Cache-Control': ['no-cache', 'no-store', 'max-age=0', 'max-age=3600', 'private', 'public', 'must-revalidate'],
  Connection: ['keep-alive', 'close'],
  Pragma: ['no-cache'],
  'X-Requested-With': ['XMLHttpRequest']
}

const FALLBACK = ['true', 'false', 'Bearer ']

export function commonHeaderValuesFor(key: string): string[] {
  if (!key) return FALLBACK
  const direct = HEADER_VALUE_TABLES[key]
  if (direct) return direct
  const lower = key.toLowerCase()
  const authLike = lower === 'authorization' || lower.startsWith('x-api-key') || lower.startsWith('x-auth')
  return authLike ? FALLBACK : []
}