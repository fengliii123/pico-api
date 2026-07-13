import type { RequestBody } from './types'

// Methods that may carry a body. DELETE is intentionally excluded —
// RFC 7231 says it's body-less. (Postman Legacy allows DELETE body;
// we follow the spec for the simplified client.)
export const METHODS_WITH_BODY: ReadonlySet<string> = new Set([
  'POST', 'PUT', 'PATCH'
])

export function isMethodWithBody(method: string): boolean {
  return METHODS_WITH_BODY.has(method.toUpperCase())
}

// Serialize the body into a value suitable for fetch's RequestInit.body.
// Returns undefined when no body should be sent.
//
// Note: 'formdata' here returns a FormData that fetch would auto-encode as
// multipart — but the app's request path never reaches this branch.
// normalize() in http.ts hand-builds a multipart Blob instead, because a
// FormData collapses to {} when passed through chrome.runtime.sendMessage.
// This branch is only exercised by the smoke test.
export function serializeBody(body: RequestBody): string | FormData | undefined {
  switch (body.mode) {
    case 'none':
      return undefined

    case 'urlencoded': {
      const rows = body.urlencoded ?? []
      const params = new URLSearchParams()
      for (const r of rows) {
        if (!r.enabled) continue
        const k = r.key.trim()
        if (!k) continue
        params.append(k, r.value)
      }
      const s = params.toString()
      return s === '' ? undefined : s
    }

    case 'formdata': {
      const rows = body.formdata ?? []
      const fd = new FormData()
      let appended = false
      for (const r of rows) {
        if (!r.enabled) continue
        const k = r.key.trim()
        if (!k) continue
        if (r.kind === 'file' && r.file) {
          fd.append(k, r.file, r.file.name)
          appended = true
        } else if (r.kind === 'text') {
          fd.append(k, r.value ?? '')
          appended = true
        }
      }
      return appended ? fd : undefined
    }

    case 'raw': {
      const text = body.rawText ?? ''
      return text === '' ? undefined : text
    }
  }
}