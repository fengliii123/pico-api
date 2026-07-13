// OpenAPI 3.x → DraftRequest[]. $refs are not resolved; per-operation issues
// become warnings. Server URLs map to {{baseUrl}} + path; path params → {{name}}.

import * as yaml from 'js-yaml'
import type {
  DraftRequest,
  KeyValueRow,
  RequestBody as AppRequestBody,
  HttpMethod
} from '@/core/types'
import type {
  OpenApiDocument,
  Operation,
  Parameter,
  PathItem,
  Schema,
  MediaType
} from './types'
import { HTTP_METHODS } from './types'
import { isSwagger2, upgradeSwagger2ToOAS3 } from './swagger2'
import { defaultRequestSettings } from '../defaults'

export interface ImportResult {
  requests: DraftRequest[]
  warnings: string[]
}

// Pair (path + method) with the operation we built — used by the caller
// to know which folder to put each request into. The caller keys folders
// by tag name; `tag` here is the resolved tag for display.
export interface ImportedOperation {
  request: DraftRequest
  tag: string  // empty string when operation has no tags
}

export interface ImportResultDetailed extends ImportResult {
  operations: ImportedOperation[]  // requests + their resolved tag
  // The raw server URL from `servers[0].url` (or Swagger 2.0 host+basePath).
  // Exposed so the UI layer can drop it into the user's environment as
  // `baseUrl`. undefined when the spec has no servers/host (URLs are
  // emitted as bare paths in that case).
  baseUrlValue?: string
}

export function parseOpenApi(raw: string): ImportResultDetailed {
  const warnings: string[] = []
  let doc: any
  // Try JSON first (the common case). If that fails AND the input looks
  // like YAML (no leading '{'/'['), fall back to yaml.load so users can
  // paste/upload .yaml OpenAPI specs too.
  try {
    doc = JSON.parse(raw)
  } catch (jsonErr) {
    const trimmed = raw.trimStart()
    const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[')
    if (looksLikeJson) {
      throw new Error(`Invalid JSON: ${(jsonErr as any)?.message ?? 'could not parse'}`)
    }
    try {
      doc = yaml.load(raw)
      warnings.push('Parsed as YAML (JSON parse failed)')
    } catch (yamlErr: any) {
      throw new Error(`Not JSON or YAML — JSON: ${(jsonErr as any)?.message}; YAML: ${yamlErr?.message}`)
    }
  }

  if (typeof doc !== 'object' || doc === null) {
    throw new Error('Not a JSON object — expected an OpenAPI document')
  }

  // Swagger 2.0 path
  if (isSwagger2(doc)) {
    try {
      doc = upgradeSwagger2ToOAS3(doc)
      warnings.push('Converted Swagger 2.0 → OpenAPI 3.0 on the fly')
    } catch (e: any) {
      throw new Error(`Failed to upgrade Swagger 2.0: ${e?.message ?? e}`)
    }
  } else if (!doc.openapi) {
    warnings.push('No "openapi" or "swagger" field — guessing this is OpenAPI 3.x')
  }

  const baseUrl = resolveBaseUrl(doc)
  const operations: ImportedOperation[] = []
  const paths = doc.paths ?? {}

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue
    // Path-level parameters apply to every method on this path.
    const pi = pathItem as PathItem
    const sharedParams: Parameter[] = Array.isArray(pi.parameters) ? pi.parameters : []
    for (const method of HTTP_METHODS) {
      const op: Operation | undefined = (pathItem as any)[method]
      if (!op) continue
      try {
        const request = buildDraftRequest(method.toUpperCase() as HttpMethod, pathKey, op, sharedParams, baseUrl)
        const tag = (op.tags?.[0] ?? '').trim()
        operations.push({ request, tag })
      } catch (e: any) {
        warnings.push(`${method.toUpperCase()} ${pathKey}: ${e?.message ?? e}`)
      }
    }
  }

  // The folder map / dedup happens in the store layer, which knows about
  // existing folders and existing (method, path) pairs. Here we just
  // expose what we parsed.
  return {
    requests: operations.map(o => o.request),
    operations,
    warnings,
    baseUrlValue: baseUrl.full || undefined
  }
}

// What the importer needs to know about the API's base URL, in two
// pieces so URLs can be assembled as `{{baseUrl}} + remainingPath`:
//   - `full`    — the full server URL, stored verbatim as `baseUrl`
//                 environment variable so the user can switch envs by
//                 changing one variable.
//   - `prefix`  — the portion that should be STRIPPED from operation
//                 paths during URL construction (typically the
//                 basePath component of the server URL). For
//                 `https://petstore.swagger.io/v2`, prefix is `/v2` so
//                 `paths["/v2/store/order/{orderId}"]` would be emitted
//                 as `{{baseUrl}}/store/order/{{orderId}}` — though in
//                 practice OAS paths usually DON'T include the basePath
//                 (they're relative to it), so prefix is often just `/`.
interface BaseUrlResolution {
  full: string       // "" when no server URL was found
  prefix: string     // "" when no path component to strip
}

// Resolve the base URL from `servers` (OAS3) or fall back to empty so
// the importer uses just the path. If multiple servers exist, take the
// first (the user can switch later via env vars if needed).
function resolveBaseUrl(doc: OpenApiDocument): BaseUrlResolution {
  const s = doc.servers?.[0]?.url
  if (!s) return { full: '', prefix: '' }

  // Split the server URL into origin + path so we can use the origin as
  // the `baseUrl` env-var value and the path as the strip-prefix for
  // operation URLs. (server URLs are not always cleanly formed — e.g.
  // relative templates like `/api/{version}` are allowed — we only
  // support absolute URLs here. Anything else falls back to no prefix.)
  try {
    const u = new URL(s)
    const path = u.pathname.replace(/\/$/, '')  // strip trailing /
    // The origin is the full URL minus its path.
    const full = u.origin + path
    return { full, prefix: path }
  } catch {
    // Non-absolute server URL — fall back to using it verbatim.
    const cleaned = s.replace(/\/$/, '')
    return { full: cleaned, prefix: '' }
  }
}

function buildDraftRequest(
  method: HttpMethod,
  pathKey: string,
  op: Operation,
  sharedParams: Parameter[],
  baseUrl: BaseUrlResolution
): DraftRequest {
  const allParams = [...sharedParams, ...(op.parameters ?? [])]
  const params: KeyValueRow[] = []
  const headers: KeyValueRow[] = []

  for (const p of allParams) {
    const value = pickExampleOrPlaceholder(p.schema ?? p)
    if (p.in === 'query') {
      params.push({ key: p.name, value, enabled: !p.deprecated })
    } else if (p.in === 'header') {
      headers.push({ key: p.name, value, enabled: !p.deprecated })
    } else if (p.in === 'path') {
      // Path parameters show up in the URL as {{name}} — they don't need
      // a row in our params table; the user fills them via env vars.
    }
    // cookie / body / formData: ignored here (cookie unsupported, body
    // handled separately, formData handled in body mode inference)
  }

  // Body — pick the first content type we recognise.
  const body = inferBodyFromRequest(op.requestBody)

  // Build the URL:
  //   - With a server URL: `{{baseUrl}} + path` where path is the
  //     OpenAPI operation path MINUS the server's basePath (the
  //     basePath already lives in the `baseUrl` env var).
  //   - Without a server URL: bare path string. The user sets `baseUrl`
  //     in their environment if they want to use one.
  //   - Path params `{orderId}` are converted to `{{orderId}}` so they
  //     interpolate from the same env-var pool as `baseUrl`.
  const strippedPath = baseUrl.prefix && pathKey.startsWith(baseUrl.prefix)
    ? pathKey.slice(baseUrl.prefix.length) || '/'
    : pathKey
  const interpolatedPath = strippedPath.replace(/\{([^}]+)\}/g, (_m, name) => `{{${name}}}`)
  const url = baseUrl.full
    ? `{{baseUrl}}${interpolatedPath.startsWith('/') ? '' : '/'}${interpolatedPath}`
    : interpolatedPath

  const name = (op.summary || op.operationId || `${method} ${pathKey}`).trim()

  return {
    id: null,
    folderId: null,
    name,
    method,
    url,
    headers,
    params,
    body,
    auth: { type: 'none' },
    scripts: { preRequest: '', postResponse: '' },
    settings: defaultRequestSettings()
  }
}

// Pick a sensible default value for a parameter or schema. Falls back to
// an empty string so the resulting row is editable.
function pickExampleOrPlaceholder(schema: Schema | Parameter): string {
  const s = schema as any
  if (s.example !== undefined) return stringifyExample(s.example)
  if (s.default !== undefined) return String(s.default)
  if (Array.isArray(s.enum) && s.enum.length > 0) return String(s.enum[0])
  // For boolean / number schemas, give a typed placeholder so the user
  // knows the expected shape.
  if (s.type === 'boolean') return 'false'
  if (s.type === 'integer' || s.type === 'number') return '0'
  return ''
}

function stringifyExample(v: unknown): string {
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

// Convert an OAS3 requestBody into our app's RequestBody model.
function inferBodyFromRequest(rb?: Operation['requestBody']): AppRequestBody {
  if (!rb?.content) return { mode: 'none' }
  const entries = Object.entries(rb.content) as Array<[string, MediaType]>
  // Prefer JSON > urlencoded > multipart > first available
  const preferred = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data']
  let chosen: [string, MediaType] | undefined
  for (const ct of preferred) {
    const found = entries.find(([k]) => k.toLowerCase().includes(ct))
    if (found) { chosen = found; break }
  }
  if (!chosen) chosen = entries[0]
  if (!chosen) return { mode: 'none' }

  const [ct, media] = chosen
  const lower = ct.toLowerCase()

  if (lower.includes('application/x-www-form-urlencoded')) {
    return { mode: 'urlencoded', urlencoded: schemaToKeyValueRows(media.schema) }
  }
  if (lower.includes('multipart/form-data')) {
    return { mode: 'formdata', formdata: schemaToFormRows(media.schema) }
  }
  // Default → raw. Pick rawType by content-type (json/xml/text).
  const rawType = lower.includes('xml') ? 'xml' : lower.includes('json') ? 'json' : 'text'
  const rawText = stringifyExample(media.example ?? schemaExample(media.schema)) ?? ''
  return { mode: 'raw', rawType, rawText }
}

// Convert an object schema into KeyValueRow[] (used for urlencoded body).
function schemaToKeyValueRows(schema?: Schema): KeyValueRow[] {
  if (!schema?.properties) return []
  const rows: KeyValueRow[] = []
  for (const [k, sub] of Object.entries(schema.properties)) {
    rows.push({ key: k, value: pickExampleOrPlaceholder(sub), enabled: true })
  }
  return rows
}

// Convert an object schema into FormDataRow[] (used for multipart body).
// Files end up as text rows since OpenAPI can't carry the file binary
// — the user re-attaches after import.
function schemaToFormRows(schema?: Schema): any[] {
  if (!schema?.properties) return []
  const rows: any[] = []
  for (const [k, sub] of Object.entries(schema.properties)) {
    const isFile = (sub as any).format === 'binary' || (sub as any).type === 'file'
    rows.push({
      key: k,
      kind: isFile ? 'file' : 'text',
      enabled: true,
      value: isFile ? undefined : pickExampleOrPlaceholder(sub)
    })
  }
  return rows
}

// Generate an example string from a schema: prefer schema.example, then
// build a minimal JSON object from `properties`. Returns undefined if
// we can't produce anything sensible.
function schemaExample(schema?: Schema): unknown {
  if (!schema) return undefined
  if (schema.example !== undefined) return schema.example
  if (schema.properties) {
    const obj: Record<string, unknown> = {}
    for (const [k, sub] of Object.entries(schema.properties)) {
      obj[k] = (sub as any).example ?? defaultValueForType(sub as Schema)
    }
    return obj
  }
  return defaultValueForType(schema)
}

function defaultValueForType(s: Schema): unknown {
  switch (s.type) {
    case 'string': return ''
    case 'integer':
    case 'number': return 0
    case 'boolean': return false
    case 'array': return []
    case 'object': return {}
    default: return ''
  }
}
