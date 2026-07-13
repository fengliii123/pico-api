// Default factories for nested request sub-objects.
// Centralised so that adding/removing a RequestSettings field doesn't
// require hunting literals across stores, components, and importers.

import type { RequestSettings } from './types'

export function defaultRequestSettings(): RequestSettings {
  return { timeout: 0, followRedirects: true, maxResponseSize: 100 }
}