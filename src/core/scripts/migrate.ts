// Shared helpers around RequestScripts — kept here so stores and
// components don't have to duplicate the legacy-shape migration logic.

import type { RequestScripts } from '../types'

// Backward-compat: earlier versions of the extension stored the
// post-response code under a `tests` key. Older still stored the whole
// script body as a string. We map those shapes onto the current
// `RequestScripts` so users upgrading don't silently lose their work.
//
// Returns a valid RequestScripts in every case — the function never
// returns undefined or throws.
export function migrateScripts(s: RequestScripts | undefined | null): RequestScripts {
  if (!s) return { preRequest: '', postResponse: '' }
  const legacy = (s as any).tests
  if (typeof legacy === 'string' && legacy.length > 0 && !s.postResponse) {
    return { preRequest: s.preRequest, postResponse: legacy }
  }
  // Return a clean shape with only the current fields — the legacy
  // `tests` key is stripped so it doesn't get re-saved into IDB and
  // pollute the next round trip.
  return { preRequest: s.preRequest, postResponse: s.postResponse ?? '' }
}