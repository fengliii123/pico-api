// Global type contracts used across stores, components, and db layer.

import type { ParsedCookie } from './cookies'

export type HttpMethod =
  | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface KeyValueRow {
  key: string
  value: string
  enabled: boolean
}

export type BodyMode = 'none' | 'urlencoded' | 'raw' | 'formdata'
export type RawType = 'json' | 'xml' | 'text'

// A single form-data row: either a text value, or a chosen file. We hold
// the File object in-memory; it is intentionally NOT persisted to IndexedDB
// — when we load a saved request, files come back as empty rows.
export type FormDataRowKind = 'text' | 'file'

export interface FormDataRow {
  key: string
  kind: FormDataRowKind
  enabled: boolean
  // text mode
  value?: string
  // file mode
  file?: File | null
  fileName?: string
  fileSize?: number
  fileType?: string
}

export interface RequestBody {
  mode: BodyMode
  rawType?: RawType
  rawText?: string
  urlencoded?: KeyValueRow[]
  formdata?: FormDataRow[]
}

export interface Folder {
  id: string
  parentId: string | null
  name: string
  order: number
  createdAt: number
  updatedAt: number
}

export interface SavedRequest {
  id: string
  folderId: string | null
  name: string
  method: HttpMethod
  url: string
  headers: KeyValueRow[]
  params: KeyValueRow[]
  body: RequestBody
  auth: AuthConfig
  scripts: RequestScripts
  settings: RequestSettings
  order: number
  createdAt: number
  updatedAt: number
}

export interface HistoryEntry {
  id: string
  requestId: string | null   // null if ad-hoc
  folderId: string | null
  name: string
  method: HttpMethod
  url: string
  status: number
  time: number               // ms
  size: number               // bytes
  sentAt: number
}

// A single key/value entry inside an Environment or Globals.
// `enabled: false` lets the user keep a definition around without it being
// active during interpolation (matches Postman's checkbox semantics).
export interface EnvironmentVariable {
  key: string
  value: string
  enabled: boolean
}

export interface Environment {
  id: string
  name: string               // e.g. "Dev", "Staging", "Prod"
  variables: EnvironmentVariable[]
  order: number
  createdAt: number
  updatedAt: number
}

// Globals are environment-independent constants. Persisted as a singleton
// row in the `globals` IndexedDB store (id = 'singleton').
export interface Globals {
  id: string                 // always 'singleton'
  variables: EnvironmentVariable[]
  updatedAt: number
}

// Authorization types
export type AuthType =
  | 'none'
  | 'apikey'
  | 'bearer'
  | 'basic'

// API Key can be added to header or query param
export interface ApiKeyAuth {
  type: 'apikey'
  addTo: 'header' | 'query'
  key: string
  value: string
  prefix?: string // e.g. "X-API-Key: {value}" vs just "{value}"
}

export interface BearerAuth {
  type: 'bearer'
  token: string
  prefix?: string // default is "Bearer"
}

export interface BasicAuth {
  type: 'basic'
  username: string
  password: string
}

export type AuthConfig = ApiKeyAuth | BearerAuth | BasicAuth | { type: 'none' }

// Per-request settings that control how the request is sent.

export interface RequestSettings {
  /** Request timeout in milliseconds. 0 = no timeout. */
  timeout: number
  /** Whether to follow HTTP redirects (301, 302, 303, 307, 308). */
  followRedirects: boolean
  /** Maximum response body size in MB. 0 = no limit. Bodies larger than
   *  this are truncated (first N MB kept) to keep the renderer responsive
   *  on accidental huge downloads. */
  maxResponseSize: number
}

// pm.* API simulated for pre-request and test scripts.
// Scripts are optional per-request, stored as raw JS strings.

export interface RequestScripts {
  /** JavaScript to run before the request is sent. */
  preRequest: string
  /** JavaScript to run after the response is received. Has access to pm.response. */
  postResponse: string
}

//
// CapturedRequest mirrors the bits of a network request that the
// background service worker lifts out of the Chrome DevTools Protocol
// (Network domain). The shape is intentionally close to DraftRequest,
// but it lives as its own type because the capture path has fields
// (CDP requestId, tabId, response details) that don't belong in a
// user-editable request.
export interface CapturedRequest {
  // Batch id shared by every request captured during one start→stop
  // session. Makes it easy to clear a whole capture run at once.
  captureId: string
  // Chrome DevTools Protocol requestId — lets us match responses to
  // their originating requests while the events stream in.
  cdpRequestId: string
  tabId: number
  timestamp: number
  method: string
  url: string
  headers: Array<[string, string]>
  // Raw request body for POST/PUT/PATCH. Empty for GET/HEAD.
  postData?: string
  // Filled in when Network.responseReceived fires. Body is fetched
  // lazily on save (most captured requests never get inspected).
  response?: {
    status: number
    statusText: string
    headers: Array<[string, string]>
    mimeType: string
  }
}

export type CaptureStatus = 'idle' | 'capturing' | 'stopped' | 'error'

// View-model for the right-hand editor. Independent of SavedRequest so
// unsaved edits can live here without touching IndexedDB.
export interface DraftRequest {
  id: string | null          // null = new unsaved request
  folderId: string | null    // where it would be saved
  name: string
  method: HttpMethod
  url: string
  headers: KeyValueRow[]
  params: KeyValueRow[]
  body: RequestBody
  auth: AuthConfig
  scripts: RequestScripts
  settings: RequestSettings
}

export interface ResponseResult {
  status: number
  statusText: string
  headers: Array<[string, string]>
  body: {
    blob: Blob
    text: string
    size: number
  }
  time: number               // ms
  mime: string
  // Parsed Set-Cookie values, when the request went through the background
  // bridge (foreground fetch can't see Set-Cookie under CORS). Empty if
  // the response had no Set-Cookie headers.
  setCookies?: ParsedCookie[]
  // P3-2: detailed timing breakdown from PerformanceResourceTiming.
  // All values in ms. 0 = not available.
  timing?: {
    dns: number      // domainLookupEnd - domainLookupStart
    connect: number  // connectEnd - connectStart (TCP)
    tls: number      // connectEnd - secureConnectionStart (0 for http://)
    wait: number     // responseStart - requestStart (TTFB)
    receive: number  // responseEnd - responseStart (download)
  }
}

export interface ResponseError {
  message: string
  // UX-1: classified cause. Lets the UI distinguish CORS / DNS / TLS / abort
  // and surface a targeted hint instead of "Network error" for everything.
  //
  // Named `errorKind` (not `kind`) so it doesn't collide with the
  // ResponseState discriminated union's `kind: 'error' | 'idle' | 'loading'
  // | 'success'`.
  errorKind?: 'cors' | 'dns' | 'connect' | 'tls' | 'timeout' | 'aborted' | 'unknown'
  // The original browser error message, kept around for the advanced
  // details panel (DevTools users want the raw reason).
  originalMessage?: string
  cause?: unknown
}