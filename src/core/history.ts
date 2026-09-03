// Map a history entry back into editable draft fields. Entries recorded
// before the `snapshot` field existed restore name/method/url only — the
// previous behavior — while snapshotted entries restore the full request.

import type { HistoryEntry, KeyValueRow, RequestBody } from './types'
import { deepClone } from '@/utils/clone'

export interface HistoryDraftPatch {
  name: string
  method: HistoryEntry['method']
  url: string
  headers?: KeyValueRow[]
  params?: KeyValueRow[]
  body?: RequestBody
}

export function historyEntryToPatch(entry: HistoryEntry): HistoryDraftPatch {
  const base: HistoryDraftPatch = {
    name: entry.name,
    method: entry.method,
    url: entry.url
  }
  if (!entry.snapshot) return base
  return {
    ...base,
    headers: entry.snapshot.headers.map(h => ({ ...h })),
    params: entry.snapshot.params.map(p => ({ ...p })),
    body: deepClone(entry.snapshot.body)
  }
}
