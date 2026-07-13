// Convert a captured network request into a user-editable DraftRequest.
//
// We reuse the same URL-splitting and body-shape inference logic the
// cURL importer uses, since the problem is identical: turn a raw HTTP
// shape into our structured model.

import type { CapturedRequest, DraftRequest, KeyValueRow } from './types'
import { splitUrlParams, inferBody } from './curl'
import { defaultRequestSettings } from './defaults'

export function capturedToDraft(captured: CapturedRequest): DraftRequest {
  const { cleanUrl, params } = splitUrlParams(captured.url)

  const headers: KeyValueRow[] = captured.headers.map(([k, v]) => ({
    key: k,
    value: v,
    enabled: true
  }))

  // The capture engine stores postData as a string (CDP gives us the raw
  // body). inferBody needs to know whether there IS a body to populate,
  // plus the Content-Type header to pick the right shape.
  const hasBody = captured.postData !== undefined && captured.postData !== ''
  const body = inferBody(headers, captured.postData ?? '', hasBody)

  return {
    id: null,
    folderId: null,
    name: deriveName(captured),
    method: normalizeMethod(captured.method),
    url: cleanUrl,
    headers,
    params,
    body,
    auth: { type: 'none' },
    scripts: { preRequest: '', postResponse: '' },
    settings: defaultRequestSettings()
  }
}

function normalizeMethod(m: string): DraftRequest['method'] {
  const u = (m || 'GET').toUpperCase()
  const allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
  return (allowed as readonly string[]).includes(u)
    ? (u as DraftRequest['method'])
    : 'GET'
}

function deriveName(c: CapturedRequest): string {
  try {
    const u = new URL(c.url)
    const path = u.pathname.replace(/\/$/, '') || '/'
    const last = path.split('/').filter(Boolean).slice(-1)[0] || u.hostname
    const trunc = last.length > 50 ? last.slice(0, 50) + '…' : last
    return `${c.method} ${trunc}`
  } catch {
    return `Captured ${c.method}`
  }
}
