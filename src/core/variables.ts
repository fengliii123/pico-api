// Variable interpolation for {{var}}. Lookup: active env → globals; unknown keys stay literal.

import type { DraftRequest, EnvironmentVariable, KeyValueRow, FormDataRow } from './types'

// Match {{ key }} allowing inner whitespace. Key itself is permissive but
// cannot contain '}'. Non-greedy to avoid runaway matches in pathological
// strings.
const VAR_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g

function buildLookup(env: EnvironmentVariable[], globals: EnvironmentVariable[]): Map<string, string> {
  // Insert globals first, then environment — environment entries overwrite
  // same-key globals (Map preserves insertion order, last set wins).
  const m = new Map<string, string>()
  for (const v of globals) {
    if (v.enabled && v.key) m.set(v.key, v.value)
  }
  for (const v of env) {
    if (v.enabled && v.key) m.set(v.key, v.value)
  }
  return m
}

export function interpolate(text: string, lookup: Map<string, string>): string {
  if (!text || !text.includes('{{')) return text
  return text.replace(VAR_PATTERN, (full, key: string) => {
    return lookup.has(key) ? lookup.get(key)! : full
  })
}

// Apply interpolation to every field of a DraftRequest that can contain
// {{var}}. Returns a NEW DraftRequest; the input is not mutated.
//
// Note: form-data file rows are skipped — file metadata (name, size, type)
// is browser-controlled, not user-typed. Only the row's `key` and text
// `value` are interpolated.
export function applyVariables(
  req: DraftRequest,
  env: EnvironmentVariable[],
  globals: EnvironmentVariable[]
): DraftRequest {
  const lookup = buildLookup(env, globals)
  // If there's nothing to look up, skip the deep-clone entirely.
  if (lookup.size === 0) return req

  const interpKV = (rows: KeyValueRow[]): KeyValueRow[] =>
    rows.map(r => ({
      ...r,
      key: interpolate(r.key, lookup),
      value: interpolate(r.value, lookup)
    }))

  const interpForm = (rows: FormDataRow[]): FormDataRow[] =>
    rows.map(r => ({
      ...r,
      key: interpolate(r.key, lookup),
      value: r.value !== undefined ? interpolate(r.value, lookup) : r.value
    }))

  const next: DraftRequest = {
    ...req,
    url: interpolate(req.url, lookup),
    params: interpKV(req.params),
    headers: interpKV(req.headers)
  }

  if (req.body) {
    const b = req.body
    next.body = {
      ...b,
      rawText: b.rawText !== undefined ? interpolate(b.rawText, lookup) : b.rawText,
      urlencoded: b.urlencoded ? interpKV(b.urlencoded) : b.urlencoded,
      formdata: b.formdata ? interpForm(b.formdata) : b.formdata
    }
  }

  return next
}

// Find every {{...}} placeholder across a draft that isn't in the lookup
// (active env ∪ globals, both filtered by enabled+key). Returns a
// deduplicated, insertion-ordered list of placeholder names.
//
// Used by RequestEditor.send() to surface a helpful error when the user
// types `{{baseUrl}}` but hasn't activated / defined the variable —
// without this check the request would silently go out with the literal
// placeholder text in the URL, which is hard to debug after the fact.
export function findUnresolvedVariables(
  req: DraftRequest,
  env: EnvironmentVariable[],
  globals: EnvironmentVariable[]
): string[] {
  const lookup = buildLookup(env, globals)
  const seen = new Set<string>()
  const out: string[] = []

  const scan = (s: string | undefined) => {
    if (!s) return
    for (const m of s.matchAll(VAR_PATTERN)) {
      const k = m[1]!.trim()
      if (!seen.has(k) && !lookup.has(k)) {
        seen.add(k)
        out.push(k)
      }
    }
  }

  scan(req.url)
  for (const r of req.headers) { scan(r.key); scan(r.value) }
  for (const p of req.params)  { scan(p.key); scan(p.value) }
  if (req.body) {
    const b = req.body
    scan(b.rawText)
    if (b.urlencoded) for (const r of b.urlencoded) { scan(r.key); scan(r.value) }
    if (b.formdata) for (const r of b.formdata) { scan(r.key); scan(r.value) }
  }
  return out
}
