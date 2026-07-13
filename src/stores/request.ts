// Request editor store: draft state decoupled from IndexedDB SavedRequest.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
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

  function markEdited() {
    editGeneration.value++
    dirty.value = true
  }

  const isNew = computed(() => draft.value.id === null)

  function newRequest(folderId: string | null = null) {
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

  // Load an unsaved draft (e.g. a captured request) straight into the
  // editor without persisting. `id` is reset to null so the next Save
  // goes through createRequest (rather than silently no-op'ing through
  // updateRequest with a non-existent id).
  function loadFromDraft(d: Omit<DraftRequest, 'id'> & { id?: string | null }) {
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
    // Captured requests are not yet saved — use null sentinel so
    // send results go into the new-request slot.
    useResponseStore().setActive(null)
  }

  function loadFromSaved(r: SavedRequest) {
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

    // Bidirectional sync: if the user pastes / types a URL with a query
    // string, move the query params into the Params tab so the URL stays
    // clean. We only update params when the query string actually has
    // content — this avoids nuking user edits on every keystroke during
    // typing.
    //
    // To keep the typing UX responsive we DON'T re-extract on every input
    // event: a real "?" is needed to trigger a parse. The URL bar still
    // shows what the user typed verbatim.
    const parsed = parseQueryParams(url)
    if (parsed.length > 0) {
      draft.value.params = parsed
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
    draft.value.id = id
    dirty.value = false
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
    markSaved
  }
})