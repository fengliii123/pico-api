// Request editor store: draft state decoupled from IndexedDB SavedRequest.

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { DraftRequest, KeyValueRow, HttpMethod, RequestBody, SavedRequest, AuthConfig, RequestScripts, RequestSettings } from '@/core/types'
import { defaultRequestSettings } from '@/core/defaults'
import { uid } from '@/utils/id'
import { deepClone } from '@/utils/clone'
import { parseQueryParams, urlWithParams } from '@/core/url'
import { useResponseStore } from './response'

// Methods whose spec body is "no body". Body tab is greyed out for these.
const METHODS_WITHOUT_BODY: ReadonlySet<HttpMethod> = new Set([
  'GET', 'HEAD', 'OPTIONS'
])

function emptyDraft(): DraftRequest {
  return {
    id: null,
    folderId: null,
    name: 'Untitled Request',
    method: 'GET',
    url: '',
    // Pre-seed one empty row in each tab so the user has a visible target
    // to type into. Postman's editor does the same — the alternative
    // (a "Click + Add row" empty state) costs an extra click and hides
    // the autocomplete dictionaries.
    headers: [emptyRow()],
    params: [emptyRow()],
    body: { mode: 'none' },
    auth: { type: 'none' },
    scripts: { preRequest: '', postResponse: '' },
    settings: defaultRequestSettings()
  }
}

function emptyRow(): KeyValueRow {
  return { key: '', value: '', enabled: true }
}

// Deep-clone a body for persistence / draft loading. A File's bytes cannot
// survive JSON serialization (it collapses to a bytes-less object), so we
// drop the file reference on every form-data file row — otherwise the editor
// would show a phantom file that sends "[object Object]" on the wire. The row
// and its metadata are kept so the user only needs to re-pick the file.
function cloneBody(body: RequestBody): RequestBody {
  const cloned = deepClone(body)
  if (cloned.formdata) {
    for (const row of cloned.formdata) {
      if (row.kind === 'file') row.file = null
    }
  }
  return cloned
}

// Snapshot a draft for the in-memory cache. Unlike cloneBody, this PRESERVES
// formdata File references — File objects live in memory and survive a
// structured-clone copy, just not a JSON round-trip. deepClone() would drop
// the bytes, so we restore file refs after the JSON pass.
function snapshotDraft(d: DraftRequest): DraftRequest {
  const cloned = deepClone(d) as DraftRequest
  if (cloned.body.mode === 'formdata' && d.body.mode === 'formdata') {
    const src = d.body.formdata ?? []
    const dst = cloned.body.formdata
    if (dst) {
      dst.forEach((row, i) => {
        if (row.kind === 'file') {
          row.file = src[i]?.file ?? null
        }
      })
    }
  }
  return cloned
}

  // Cache key for unsaved drafts (id === null). A fresh "New" always
  // overwrites this slot, so only the most recent unsaved draft is retained
  // — which matches user expectation (there's no tree node to "switch back
  // to" for an unsaved draft anyway).
  const NEW_REQUEST_KEY = '__new__'

// Backward-compat: pre-v* data stored post-response code under `tests`.
// `migrateScripts` lives in core/scripts/migrate.ts so collection
// components can share the same logic.
import { migrateScripts } from '@/core/scripts/migrate'

function draftFromSaved(r: SavedRequest): DraftRequest {
  return {
    id: r.id,
    folderId: r.folderId,
    name: r.name,
    method: r.method,
    url: r.url,
    headers: r.headers.map(h => ({ ...h })),
    params: r.params.map(p => ({ ...p })),
    body: cloneBody(r.body),
    auth: r.auth ?? { type: 'none' },
    scripts: migrateScripts(r.scripts),
    settings: r.settings ?? defaultRequestSettings()
  }
}

export const useRequestStore = defineStore('request', () => {
  const draft = ref<DraftRequest>(emptyDraft())
  const dirty = ref(false)
  // Monotonic counter bumped on every user edit — lets undo tracking watch
  // a scalar instead of deep-walking the entire draft tree.
  const editGeneration = ref(0)

  // Per-request in-memory draft cache. Keyed by request id (or NEW_REQUEST_KEY
  // for unsaved drafts) so switching A → B → A restores A's un-saved edits
  // without round-tripping to IndexedDB. Lives only for the session — a page
  // refresh rebuilds this map empty, which is exactly the "discard on reload"
  // behaviour we want. shallowRef: the map identity matters more than deep
  // reactivity, and this avoids wrapping File refs in proxies.
  const draftCache = shallowRef(new Map<string, DraftRequest>())

  function cacheKeyFor(id: string | null): string {
    return id ?? NEW_REQUEST_KEY
  }

  function markEdited() {
    editGeneration.value++
    dirty.value = true
    // Persist the current draft into the per-id cache so switching away and
    // back keeps the edits. Snapshot detaches Vue's reactive proxy so later
    // in-place mutations don't silently mutate the cached copy.
    const key = cacheKeyFor(draft.value.id)
    draftCache.value.set(key, snapshotDraft(draft.value))
  }

  const isNew = computed(() => draft.value.id === null)

  function newRequest(folderId: string | null = null) {
    // Clear any previous unsaved-draft slot — the user explicitly hit "New"
    // and shouldn't get a stale prior new draft resurrected when they switch
    // away and back through other requests.
    draftCache.value.delete(NEW_REQUEST_KEY)
    draft.value = { ...emptyDraft(), folderId }
    dirty.value = false
    // Switch the response cache slot to the new-request sentinel so
    // send results go to the right bucket and switching away/back
    // correctly shows idle (not a stale response from a previous request).
    useResponseStore().setActive(null)
  }

  function setFolder(folderId: string | null) {
    draft.value.folderId = folderId
    markEdited()
  }

  // Load an unsaved draft (e.g. an imported cURL / OpenAPI operation)
  // straight into the editor without persisting. `id` is reset to null so
  // the next Save goes through createRequest (rather than silently no-op'ing
  // through updateRequest with a non-existent id).
  function loadFromDraft(d: Omit<DraftRequest, 'id'> & { id?: string | null }) {
    // Replace the unsaved-draft slot — import starts a fresh unsaved draft,
    // any prior NEW_REQUEST_KEY content is stale.
    draftCache.value.delete(NEW_REQUEST_KEY)
    draft.value = {
      id: null,
      folderId: d.folderId ?? null,
      name: d.name,
      method: d.method,
      url: d.url,
      headers: d.headers.map(h => ({ ...h })),
      params: d.params.map(p => ({ ...p })),
      body: cloneBody(d.body),
      auth: d.auth ?? { type: 'none' },
      scripts: migrateScripts(d.scripts),
      settings: d.settings ?? defaultRequestSettings()
    }
    dirty.value = true
    // Imported requests are not yet saved — use null sentinel so send
    // results go into the new-request slot.
    useResponseStore().setActive(null)
  }

  function loadFromSaved(r: SavedRequest) {
    // Restore un-saved edits if we have a cached draft for this id. The
    // cached snapshot is by definition newer than the IndexedDB row (it was
    // written by markEdited since the last save), so it wins on switch-back.
    const cached = draftCache.value.get(r.id)
    if (cached) {
      draft.value = snapshotDraft(cached)
      dirty.value = true
      useResponseStore().setActive(r.id)
      return
    }

    // If the saved URL had a query string, seed the Params tab from it when
    // params were never persisted. Then sync enabled params back into the URL
    // so import/load paths (OpenAPI, cURL) that only populate params[] still
    // show the query in the bar and send correctly.
    let params = r.params.map(p => ({ ...p }))
    if (params.length === 0) {
      params = parseQueryParams(r.url)
    }
    const url = params.some(p => p.enabled && p.key.trim())
      ? urlWithParams(r.url, params)
      : r.url
    draft.value = {
      ...draftFromSaved(r),
      url,
      params
    }
    dirty.value = false
    // Sync the response cache slot to this request's id so the panel
    // shows the cached result (or idle if none was sent yet).
    useResponseStore().setActive(r.id)
  }

  function setMethod(m: HttpMethod) {
    draft.value.method = m

    // Method ↔ body mode coupling so the editor always reflects what's
    // actually allowed to go on the wire.
    //
    // - GET/HEAD/OPTIONS: spec says no body. If the user happens to have
    //   one, downgrade to 'none' so they don't think it will be sent.
    // - POST/PUT/PATCH: these carry a body. If the current draft body is
    //   'none' (i.e. fresh or just downgraded), seed a sensible default
    //   (raw+JSON — the most common shape).
    if (METHODS_WITHOUT_BODY.has(m)) {
      if (draft.value.body.mode !== 'none') {
        draft.value.body = { mode: 'none' }
      }
    } else {
      if (draft.value.body.mode === 'none') {
        draft.value.body = {
          mode: 'raw',
          rawType: 'json',
          rawText: ''
        }
      }
    }

    markEdited()
  }

  function setUrl(url: string) {
    draft.value.url = url

    // Bidirectional sync: if the URL contains a query string, parse and
    // sync params from it. If the URL has no query string at all, clear
    // params to keep the UI and URL in sync — otherwise a URL like
    // "https://example.com" with params `[{foo:1}]` would show a mismatch.
    const parsed = parseQueryParams(url)
    if (url.includes('?')) {
      draft.value.params = parsed
    } else {
      draft.value.params = []
    }

    markEdited()
  }

  function setName(name: string) {
    draft.value.name = name
    markEdited()
  }

  function setBody(body: RequestBody) {
    draft.value.body = body
    markEdited()
  }

  function setHeaders(rows: KeyValueRow[]) {
    draft.value.headers = rows
    markEdited()
  }

  function setParams(rows: KeyValueRow[]) {
    draft.value.params = rows
    draft.value.url = urlWithParams(draft.value.url, rows)
    markEdited()
  }

  function setAuth(auth: AuthConfig) {
    draft.value.auth = auth
    markEdited()
  }

  function setScripts(scripts: RequestScripts) {
    draft.value.scripts = scripts
    markEdited()
  }

  function setSettings(settings: RequestSettings) {
    draft.value.settings = settings
    markEdited()
  }

  function toSaved(): Omit<SavedRequest, 'createdAt' | 'updatedAt' | 'order'> {
    return {
      id: draft.value.id ?? uid(),
      folderId: draft.value.folderId,
      name: draft.value.name,
      method: draft.value.method,
      url: draft.value.url,
      headers: draft.value.headers.map(h => ({ ...h })),
      params: draft.value.params.map(p => ({ ...p })),
      body: cloneBody(draft.value.body),
      auth: draft.value.auth,
      scripts: draft.value.scripts,
      settings: draft.value.settings
    }
  }

  function markSaved(id: string) {
    if (draft.value.id === null) {
      // Drop the unsaved-draft slot — its content is now persisted under
      // the assigned id, and a stale NEW_REQUEST_KEY copy would otherwise
      // shadow future fresh imports.
      draftCache.value.delete(NEW_REQUEST_KEY)
    }
    draft.value.id = id
    dirty.value = false
    // The draft now matches what's in IndexedDB — drop any cached un-saved
    // snapshot so the next loadFromSaved(id) walks the SavedRequest path
    // with dirty=false (a cache hit here would falsely flag the request
    // as modified).
    draftCache.value.delete(id)
  }

  // Drop a request's cached draft. Called when the request itself is
  // deleted so we don't keep growing the cache with dead ids.
  function forgetCached(id: string) {
    draftCache.value.delete(id)
  }

  return {
    draft,
    dirty,
    editGeneration,
    isNew,
    newRequest,
    loadFromSaved,
    loadFromDraft,
    setMethod,
    setUrl,
    setName,
    setBody,
    setHeaders,
    setParams,
    setAuth,
    setScripts,
    setSettings,
    setFolder,
    toSaved,
    markSaved,
    forgetCached
  }
})