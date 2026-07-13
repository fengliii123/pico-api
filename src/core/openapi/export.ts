// Collection → OpenAPI 3.0 document exporter.
//
// Inverts the importer: walks our DraftRequest/SavedRequest shape and
// builds a valid OpenAPI 3.0 JSON document. The output is meant to be
// round-trippable — exporting and re-importing should reproduce the
// original requests (modulo name collisions on tags).
//
// Folder membership becomes `tags[]`. We pick the immediate parent
// folder's name as the tag; deeper ancestry is ignored because OpenAPI
// tags are flat (you can do tag hierarchy via `tags` description
// extensions, but that's well past MVP).

import type { SavedRequest, Folder, KeyValueRow, RequestBody } from '@/core/types'

export interface ExportOptions {
  /** 'single' = one request, 'folder' = everything under folder(s),
   *  'collection' = entire collection. */
  scope: 'single' | 'folder' | 'collection'
  title?: string
  description?: string
  /** For 'single' / 'folder'. 'collection' ignores these. */
  requestIds?: string[]
  folderIds?: string[]
  /** The full requests/folders list to read from (caller passes the store). */
  requests: SavedRequest[]
  folders: Folder[]
}

interface PathOp {
  path: string
  method: string
  operation: any
}

// Build an OpenAPI 3.0 document as a pretty-printed JSON string.
export function exportOpenApi(opts: ExportOptions): string {
  const selected = pickSelection(opts)
  const folderById = new Map(opts.folders.map(f => [f.id, f]))

  // Group operations by path so multiple methods on the same path land
  // under one paths[path] object (required by OpenAPI structure).
  const byPath = new Map<string, PathOp[]>()
  for (const r of selected) {
    const path = urlToPath(r.url)
    const method = r.method.toLowerCase()
    const folder = r.folderId ? folderById.get(r.folderId) : undefined
    const operation = buildOperation(r, folder?.name)
    const list = byPath.get(path) ?? []
    list.push({ path, method, operation })
    byPath.set(path, list)
  }

  const paths: Record<string, any> = {}
  for (const [path, ops] of byPath) {
    paths[path] = {}
    for (const op of ops) {
      // OpenAPI forbids method conflicts inside the same path; the
      // importer dedupes by (method, path) so this should never trip,
      // but we leave a guard so a corrupted collection doesn't break export.
      if (paths[path][op.method]) continue
      paths[path][op.method] = op.operation
    }
  }

  const doc: any = {
    openapi: '3.0.3',
    info: {
      title: opts.title?.trim() || defaultTitle(opts, selected),
      version: '1.0.0',
      ...(opts.description?.trim() ? { description: opts.description.trim() } : {})
    },
    paths
  }

  return JSON.stringify(doc, null, 2)
}

function defaultTitle(opts: ExportOptions, selected: SavedRequest[]): string {
  if (opts.scope === 'single' && selected[0]) return selected[0].name
  if (opts.scope === 'folder' && opts.folderIds?.length) {
    const folderById = new Map(opts.folders.map(f => [f.id, f]))
    const name = folderById.get(opts.folderIds[0])?.name
    if (name) return name
  }
  return 'Pico API Export'
}

function pickSelection(opts: ExportOptions): SavedRequest[] {
  if (opts.scope === 'collection') return opts.requests
  if (opts.scope === 'single') {
    const ids = new Set(opts.requestIds ?? [])
    return opts.requests.filter(r => ids.has(r.id))
  }
  // 'folder' — requests whose folderId is in folderIds, OR descendants.
  // For simplicity we only include the immediate-folder descendants;
  // sub-folder requests live in their own folder and should be exported
  // by selecting each sub-folder explicitly. This matches how OpenAPI
  // tags work (flat).
  const ids = new Set(opts.folderIds ?? [])
  return opts.requests.filter(r => r.folderId !== null && ids.has(r.folderId))
}

// Strip protocol/host/query — OpenAPI only wants the pathname (with
// {param} placeholders preserved). Query params become `parameters`.
function urlToPath(url: string): string {
  if (!url) return '/'
  // We deliberately do NOT use `new URL()` here: it URL-encodes `{` and
  // `}` into %7B / %7D, which would mangle `{{baseUrl}}` placeholders
  // and break round-tripping with the importer. Strip scheme://host and
  // query string manually instead.
  const noQuery = url.split('?')[0]
  const schemeIdx = noQuery.indexOf('://')
  if (schemeIdx < 0) {
    // No scheme → treat the whole input as the pathname. This covers
    // both `/foo` and `{{baseUrl}}/foo` — the latter would otherwise
    // have its variable prefix sliced off as if it were a host.
    return noQuery || '/'
  }
  // Find the first '/' that comes after "://" — for absolute URLs that's
  // where the pathname starts.
  const searchFrom = schemeIdx + 3
  const slash = noQuery.indexOf('/', searchFrom)
  return slash >= 0 ? noQuery.slice(slash) : '/'
}

function buildOperation(r: SavedRequest, folderName?: string): any {
  const op: any = {}
  if (r.name) op.summary = r.name
  if (folderName) op.tags = [folderName]

  const parameters: any[] = []
  // Path parameters: any {name} in the URL pathname becomes a parameter
  // so OpenAPI tooling renders input fields for them.
  for (const m of urlToPath(r.url).matchAll(/\{([^}]+)\}/g)) {
    const name = m[1]
    parameters.push({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' }
    })
  }
  // Query parameters
  for (const p of r.params) {
    if (!p.enabled || !p.key) continue
    parameters.push({
      name: p.key,
      in: 'query',
      required: false,
      schema: { type: guessType(p.value) },
      ...(p.value ? { example: p.value } : {})
    })
  }
  // Header parameters
  for (const h of r.headers) {
    if (!h.enabled || !h.key) continue
    // Skip Content-Type — it's already implied by requestBody.content.
    if (h.key.toLowerCase() === 'content-type') continue
    parameters.push({
      name: h.key,
      in: 'header',
      required: false,
      schema: { type: guessType(h.value) },
      ...(h.value ? { example: h.value } : {})
    })
  }
  if (parameters.length > 0) op.parameters = parameters

  // Request body
  const body = buildBody(r.body)
  if (body) op.requestBody = body

  // Minimal responses block so OpenAPI validators don't complain.
  // Real response data isn't part of a saved request — we use a 200
  // stub.
  op.responses = {
    '200': { description: 'Successful response' }
  }

  return op
}

function buildBody(body: RequestBody): any | undefined {
  if (!body || body.mode === 'none') return undefined

  if (body.mode === 'raw') {
    const t = body.rawType ?? 'json'
    const ct = t === 'json' ? 'application/json'
            : t === 'xml' ? 'application/xml'
                : 'text/plain'
    const example = parseRawExample(body.rawText ?? '', t)
    const media: any = {}
    if (example !== undefined) {
      if (t === 'json' || t === 'xml') media.example = example
      else media.example = body.rawText ?? ''
    }
    return {
      content: { [ct]: media }
    }
  }

  if (body.mode === 'urlencoded' && body.urlencoded) {
    const schema = keyValuesToSchema(body.urlencoded)
    return {
      content: { 'application/x-www-form-urlencoded': { schema } }
    }
  }

  if (body.mode === 'formdata' && body.formdata) {
    const schema = formRowsToSchema(body.formdata)
    return {
      content: { 'multipart/form-data': { schema } }
    }
  }

  return undefined
}

// Try to parse the raw body into a JSON value so it round-trips as a
// structured example (cleaner than embedding a string). Falls back to
// the original text on parse failure.
function parseRawExample(rawText: string, type: 'json' | 'xml' | 'text'): unknown {
  if (type === 'json') {
    try { return JSON.parse(rawText) } catch { return rawText }
  }
  return rawText
}

function keyValuesToSchema(rows: KeyValueRow[]): any {
  const properties: Record<string, any> = {}
  for (const r of rows) {
    if (!r.key) continue
    properties[r.key] = { type: guessType(r.value), ...(r.value ? { example: r.value } : {}) }
  }
  return { type: 'object', properties }
}

function formRowsToSchema(rows: any[]): any {
  const properties: Record<string, any> = {}
  for (const r of rows) {
    if (!r.key) continue
    if (r.kind === 'file') {
      properties[r.key] = { type: 'string', format: 'binary' }
    } else {
      properties[r.key] = { type: guessType(r.value), ...(r.value ? { example: r.value } : {}) }
    }
  }
  return { type: 'object', properties }
}

// Best-effort: if the value parses as a number, treat as number. If
// "true"/"false", boolean. Default string.
function guessType(v: string | undefined): string {
  if (v === undefined || v === '') return 'string'
  if (v === 'true' || v === 'false') return 'boolean'
  if (/^-?\d+(\.\d+)?$/.test(v)) return v.includes('.') ? 'number' : 'integer'
  return 'string'
}
