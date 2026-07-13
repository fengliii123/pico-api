// cURL import/export.
//
// toCurl: render a NormalizedRequest as a runnable `curl …` command.
// We use a small hand-rolled quote function (rather than shell-quote's)
// because shell-quote escapes ':' anywhere it appears, which breaks URLs
// when pasted back into bash.
//
// fromCurl: parse a pasted curl command back into a DraftRequest. Supports
// the most common flags (-X, -H/-header, -d/--data/--data-raw/--data-binary,
// --data-urlencode, -b/--cookie, -L, --compressed, -k, -u) plus the bare
// URL positional argument.
//
// Limitations:
//   - form-data file fields can't be exported (we'd need a file path the
//     shell can read; we only have an in-memory File object). We emit a
//     comment listing the field names instead.
//   - --data-urlencode is parsed but doesn't re-encode on export (we
//     serialize as --data-raw with the joined kv string).

import { parse as shellParse } from 'shell-quote'
import type { DraftRequest, KeyValueRow, RequestBody, HttpMethod, FormDataRow, SavedRequest, EnvironmentVariable } from './types'
import { defaultRequestSettings } from './defaults'
import { normalize } from './http'
import { extractParamsFromUrl } from './url'
import { migrateScripts } from './scripts/migrate'

// POSIX-safe single-quote. Wraps the token in '…' and rewrites any
// internal ' as '\'' (close-quote, escaped quote, reopen-quote). This is
// the same recipe shell-quote uses, minus its overzealous ':' handling.
function shellQuote(tokens: string[]): string {
  return tokens.map(t => {
    if (t === '') return "''"
    // Characters that warrant quoting. We deliberately exclude ':' so
    // URLs like https://example.com remain readable.
    if (!/[\s"'\\$`#&|;<>(){}*?\[\]!~]/.test(t)) return t
    return "'" + t.replace(/'/g, "'\\''") + "'"
  }).join(' ')
}


export function toCurl(req: DraftRequest & { url: string }, opts: { method: string; headers: Record<string, string>; body?: BodyInit | null }): string {
  const lines: string[] = []
  lines.push(`curl ${shellQuote([req.url])}`)

  if (opts.method && opts.method !== 'GET') {
    lines.push(`  -X ${opts.method}`)
  }

  for (const [k, v] of Object.entries(opts.headers)) {
    lines.push(`  -H ${shellQuote([`${k}: ${v}`])}`)
  }

  // Body — we can only meaningfully export raw / urlencoded; form-data
  // with files needs a file path the shell can read, which we don't have.
  if (req.body) {
    const b = req.body
    if (b.mode === 'raw' && typeof b.rawText === 'string' && b.rawText) {
      lines.push(`  --data-raw ${shellQuote([b.rawText])}`)
    } else if (b.mode === 'urlencoded' && b.urlencoded) {
      const kv = b.urlencoded
        .filter(r => r.enabled && r.key)
        .map(r => `${encodeURIComponent(r.key)}=${encodeURIComponent(r.value)}`)
        .join('&')
      if (kv) lines.push(`  --data-raw ${shellQuote([kv])}`)
    } else if (b.mode === 'formdata' && b.formdata) {
      const files = b.formdata.filter(r => r.enabled && r.kind === 'file' && r.key)
      const texts = b.formdata.filter(r => r.enabled && r.kind === 'text' && r.key)
      for (const t of texts) {
        lines.push(`  -F ${shellQuote([`${t.key}=${t.value ?? ''}`])}`)
      }
      for (const f of files) {
        // We don't have the original file path; emit a placeholder that
        // signals the user needs to fill in @/path/to/file.
        lines.push(`  -F ${shellQuote([`${f.key}=@/path/to/${f.fileName || 'file'}`])}`)
      }
    }
  }

  return lines.join(' \\\n')
}

// Convenience: normalize a draft (resolving {{vars}}) and render it as curl.
// Several UI call sites need "the curl for this request" and were each
// repeating the same normalize → toCurl dance.
export function draftToCurl(
  draft: DraftRequest,
  env: EnvironmentVariable[] = [],
  globals: EnvironmentVariable[] = []
): string {
  return toCurl(draft, normalize(draft, env, globals))
}

// Same, starting from a SavedRequest: build the draft shape (they share all
// the fields that matter for serialization), then render.
export function savedToCurl(
  saved: SavedRequest,
  env: EnvironmentVariable[] = [],
  globals: EnvironmentVariable[] = []
): string {
  const draft: DraftRequest = {
    id: saved.id,
    folderId: saved.folderId,
    name: saved.name,
    method: saved.method,
    url: saved.url,
    headers: saved.headers,
    params: saved.params,
    body: saved.body,
    auth: saved.auth ?? { type: 'none' },
    scripts: migrateScripts(saved.scripts),
    settings: saved.settings ?? defaultRequestSettings()
  }
  return draftToCurl(draft, env, globals)
}


export interface CurlImportResult {
  request: DraftRequest
  warnings: string[]
}

export function fromCurl(cmd: string): CurlImportResult {
  const warnings: string[] = []
  // Strip leading/trailing whitespace and a trailing backslash-newline so
  // pasted multi-line commands parse cleanly.
  const cleaned = cmd.replace(/\\\n\s*/g, ' ').trim()
  if (!cleaned) {
    throw new Error('Empty command')
  }

  // shell-quote parses commands the way a POSIX shell would: handles
  // single/double quotes, escaped spaces, etc. We get a mixed array of
  // strings and {op: '...'} token objects for special chars.
  const tokens = shellParse(cleaned) as Array<string | { op?: string; pattern?: string }>

  let method: HttpMethod = 'GET'
  let url = ''
  const headers: KeyValueRow[] = []
  let rawBody = ''
  let hasBody = false

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    // Operator tokens (like '|', ';', '&') appear when the user pastes
    // a pipeline. We only care about the leading curl command — bail at
    // the first pipe / separator.
    if (typeof t !== 'string') {
      if (t.op === '|' || t.op === ';' || t.op === '&&' || t.op === '||') break
      continue
    }

    // The first positional argument that isn't a flag is the URL.
    if (t === 'curl') continue
    if (!t.startsWith('-')) {
      if (!url) url = t
      continue
    }

    // Flag handling. Some flags take a value as a separate token, others
    // are boolean.
    const flag = t
    const next = (): string | undefined => {
      const nx = tokens[i + 1]
      if (typeof nx === 'string') {
        i++
        return nx
      }
      return undefined
    }

    if (flag === '-X' || flag === '--request') {
      const v = next()
      if (v) method = normalizeMethod(v)
    } else if (flag === '-H' || flag === '--header') {
      const v = next()
      if (v) headers.push(parseHeader(v))
    } else if (
      flag === '-d' || flag === '--data' ||
      flag === '--data-raw' || flag === '--data-binary'
    ) {
      const v = next()
      if (v !== undefined) {
        rawBody = v
        hasBody = true
        // -d implies POST when no -X given (curl's own behavior).
        if (method === 'GET') method = 'POST'
      }
    } else if (flag === '--data-urlencode') {
      const v = next()
      if (v !== undefined) {
        // We don't try to be smart about the encoding marker (the part
        // before '=' if present). Just stash the joined body and let the
        // user fix it in the editor if needed.
        rawBody = (rawBody ? rawBody + '&' : '') + v
        hasBody = true
        if (method === 'GET') method = 'POST'
      }
    } else if (flag === '-b' || flag === '--cookie') {
      const v = next()
      if (v) headers.push({ key: 'Cookie', value: v, enabled: true })
    } else if (flag === '-u' || flag === '--user') {
      const v = next()
      if (v) {
        // btoa is available in browser context (and SW). Use it directly
        // — no need for the Node Buffer fallback that was here before.
        const auth = 'Basic ' + btoa(v)
        headers.push({ key: 'Authorization', value: auth, enabled: true })
      }
    } else if (flag === '-L' || flag === '--location' ||
               flag === '-k' || flag === '--insecure' ||
               flag === '--compressed' || flag === '-s' || flag === '--silent' ||
               flag === '-S' || flag === '--show-error' || flag === '-v' || flag === '--verbose') {
      // Boolean flags we ignore for the model — they don't affect the
      // outgoing request shape we care about.
    } else if (flag.startsWith('-')) {
      // Unknown flag — try to consume a value if the next token doesn't
      // look like a flag. Some users pass options like --connect-timeout 5.
      const nx = tokens[i + 1]
      if (typeof nx === 'string' && !nx.startsWith('-')) i++
      warnings.push(`Ignored unsupported flag: ${flag}`)
    }
  }

  if (!url) {
    throw new Error('No URL found in cURL command')
  }

  // Build the body shape based on Content-Type + body presence.
  const body = inferBody(headers, rawBody, hasBody)

  // Pull path/query params out of the URL into the structured fields so
  // they're editable in the UI.
  const { cleanUrl, params } = splitUrlParams(url)

  const request: DraftRequest = {
    id: null,
    folderId: null,
    name: deriveName(url, method),
    method,
    url: cleanUrl,
    headers,
    params,
    body,
    auth: { type: 'none' },
    scripts: { preRequest: '', postResponse: '' },
    settings: defaultRequestSettings()
  }
  return { request, warnings }
}

function normalizeMethod(m: string): HttpMethod {
  const u = m.toUpperCase()
  const allowed: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
  return (allowed as string[]).includes(u) ? (u as HttpMethod) : 'GET'
}

function parseHeader(raw: string): KeyValueRow {
  // Header lines come as "Key: Value" — split on the first colon.
  const idx = raw.indexOf(':')
  if (idx < 0) return { key: raw.trim(), value: '', enabled: true }
  return {
    key: raw.slice(0, idx).trim(),
    value: raw.slice(idx + 1).trim(),
    enabled: true
  }
}

export function inferBody(headers: KeyValueRow[], rawBody: string, hasBody: boolean): RequestBody {
  if (!hasBody) return { mode: 'none' }

  const ct = headers.find(h => h.key.toLowerCase() === 'content-type')?.value ?? ''

  if (ct.includes('application/x-www-form-urlencoded') && rawBody) {
    // Decode k=v&k2=v2 into rows.
    const urlencoded: KeyValueRow[] = rawBody.split('&').map(pair => {
      const eq = pair.indexOf('=')
      if (eq < 0) return { key: decodeURIComponent(pair), value: '', enabled: true }
      return {
        key: decodeURIComponent(pair.slice(0, eq)),
        value: decodeURIComponent(pair.slice(eq + 1)),
        enabled: true
      }
    })
    return { mode: 'urlencoded', urlencoded }
  }

  // Default to raw text — best-effort guess of rawType by content.
  let rawType: 'json' | 'xml' | 'text' = 'text'
  const trimmed = rawBody.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) rawType = 'json'
  else if (trimmed.startsWith('<')) rawType = 'xml'
  return { mode: 'raw', rawType, rawText: rawBody }
}

export function splitUrlParams(url: string): { cleanUrl: string; params: KeyValueRow[] } {
  const { url: cleanUrl, params } = extractParamsFromUrl(url)
  return { cleanUrl, params }
}

function deriveName(url: string, method: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, '') || '/'
    const last = path.split('/').filter(Boolean).slice(-1)[0] || u.hostname
    return `${method} ${last}`.slice(0, 60)
  } catch {
    return 'Imported cURL'
  }
}
