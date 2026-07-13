// Collection store: holds the in-memory tree of folders + saved requests,
// and persists mutations to IndexedDB.

import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import type { Folder, SavedRequest } from '@/core/types'
import { defaultRequestSettings } from '@/core/defaults'
import { folders as foldersDb, requests as requestsDb } from '@/db'
import { uid } from '@/utils/id'
import { deepClone } from '@/utils/clone'
import { urlWithParams } from '@/core/url'

// `toRaw` strips the top-level Vue reactive Proxy; the deepClone round-trip
// then detaches any nested Proxies (e.g. KeyValueRow[]) so the object can be
// safely handed to IndexedDB (fake-indexeddb throws DataCloneError on
// Proxies, and even real Chrome's behavior surprises people).
function plain<T>(value: T): T {
  return deepClone(toRaw(value))
}

export const MAX_DEPTH = 5

export const useCollectionStore = defineStore('collection', () => {
  const folderList = ref<Folder[]>([])
  const requestList = ref<SavedRequest[]>([])
  const loaded = ref(false)

  const foldersById = computed(() => {
    const m = new Map<string, Folder>()
    for (const f of folderList.value) m.set(f.id, f)
    return m
  })

  const requestsById = computed(() => {
    const m = new Map<string, SavedRequest>()
    for (const r of requestList.value) m.set(r.id, r)
    return m
  })

  async function load() {
    const [fs, rs] = await Promise.all([foldersDb.list(), requestsDb.list()])
    folderList.value = fs
    requestList.value = rs
    loaded.value = true
  }


  // Two siblings (folder-folder or request-request) cannot share the
  // same name within the same parent. We allow folder/request to share
  // a name (different kinds, different namespaces). Returns an error
  // message if the name would clash so the UI layer can render a message.
  function nameConflict(kind: 'folder' | 'request', parentId: string | null, name: string, exceptId?: string): string | null {
    const trimmed = name.trim()
    if (!trimmed) return null
    if (kind === 'folder') {
      const clash = folderList.value.find(f => f.parentId === parentId && f.name.trim() === trimmed && f.id !== exceptId)
      return clash ? `folderNameConflict:${trimmed}` : null
    } else {
      const clash = requestList.value.find(r => r.folderId === parentId && r.name.trim() === trimmed && r.id !== exceptId)
      return clash ? `requestNameConflict:${trimmed}` : null
    }
  }

  async function createFolder(parentId: string | null, name = 'New Folder'): Promise<Folder> {
    const conflict = nameConflict('folder', parentId, name)
    if (conflict) throw new Error(conflict)
    const siblings = folderList.value.filter(f => f.parentId === parentId)
    const f: Folder = {
      id: uid(),
      parentId,
      name,
      order: siblings.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    await foldersDb.put(f)
    folderList.value = [...folderList.value, f]
    return f
  }

  async function renameFolder(id: string, name: string) {
    const f = foldersById.value.get(id)
    if (!f) return
    const conflict = nameConflict('folder', f.parentId, name, id)
    if (conflict) throw new Error(conflict)
    f.name = name
    f.updatedAt = Date.now()
    await foldersDb.put(f)
    folderList.value = [...folderList.value]
  }

  async function deleteFolder(id: string) {
    await foldersDb.delete(id)
    await load()
  }

  function getDepth(id: string | null): number {
    let depth = 0
    let cur = id ? foldersById.value.get(id) : undefined
    while (cur) {
      depth++
      if (depth > MAX_DEPTH) break
      cur = cur.parentId ? foldersById.value.get(cur.parentId) : undefined
    }
    return depth
  }

  function canAddChild(parentId: string | null): boolean {
    return getDepth(parentId) < MAX_DEPTH
  }


  async function createRequest(
    folderId: string | null,
    init: Partial<SavedRequest> = {}
  ): Promise<SavedRequest> {
    const name = init.name ?? 'New Request'
    const conflict = nameConflict('request', folderId, name)
    if (conflict) throw new Error(conflict)
    const siblings = requestList.value.filter(r => r.folderId === folderId)
    const params = init.params ?? []
    let url = init.url ?? ''
    if (params.some(p => p.enabled && p.key.trim())) {
      url = urlWithParams(url, params)
    }
    const r: SavedRequest = {
      id: init.id ?? uid(),
      folderId,
      name,
      method: init.method ?? 'GET',
      url,
      headers: init.headers ?? [],
      params,
      body: init.body ?? { mode: 'none' },
      auth: init.auth ?? { type: 'none' },
      scripts: init.scripts ?? { preRequest: '', postResponse: '' },
      settings: init.settings ?? defaultRequestSettings(),
      order: siblings.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    await requestsDb.put(r)
    requestList.value = [...requestList.value, r]
    return r
  }

  async function updateRequest(r: SavedRequest) {
    const conflict = nameConflict('request', r.folderId, r.name, r.id)
    if (conflict) throw new Error(conflict)
    r.updatedAt = Date.now()
    await requestsDb.put(r)
    const idx = requestList.value.findIndex(x => x.id === r.id)
    if (idx >= 0) requestList.value.splice(idx, 1, r)
    requestList.value = [...requestList.value]
  }

  async function deleteRequest(id: string) {
    await requestsDb.delete(id)
    requestList.value = requestList.value.filter(r => r.id !== id)
  }

  async function moveRequest(
    id: string,
    folderId: string | null,
    placement: { beforeId: string | null; atEnd: boolean } = { beforeId: null, atEnd: true }
  ): Promise<void> {
    const r = requestsById.value.get(id)
    if (!r) return
    r.folderId = folderId
    r.updatedAt = Date.now()

    // Re-order: compute new order field for ALL requests in the destination folder.
    const siblings = requestList.value
      .filter(x => x.folderId === folderId && x.id !== id)
      .sort((a, b) => a.order - b.order)

    // `siblings` already excludes the moved item — splice the moved item
    // back in at the requested slot, then re-number the whole list so
    // every sibling's `order` field is consistent.
    let insertIdx = siblings.length
    if (placement.beforeId) {
      const idx = siblings.findIndex(x => x.id === placement.beforeId)
      insertIdx = idx >= 0 ? idx : siblings.length
    } else if (placement.atEnd) {
      insertIdx = siblings.length
    }
    siblings.splice(insertIdx, 0, r)
    siblings.forEach((x, i) => { x.order = i })

    // Spread to strip the Vue reactive Proxy before pushing to IDB.
    // (See note above for context.)
    await requestsDb.put(plain(r))
    // Persist order for siblings too if any order changed.
    for (const x of siblings) {
      if (x !== r) await requestsDb.put(plain(x))
    }
    await load()
  }

  async function moveFolder(
    id: string,
    parentId: string | null,
    placement: { beforeId: string | null; atEnd: boolean } = { beforeId: null, atEnd: true }
  ): Promise<boolean> {
    if (id === parentId) return false
    if (parentId && isDescendantOf(parentId, id)) return false

    const subtreeDepth = maxSubtreeDepth(id)
    const parentDepth = getDepth(parentId)
    if (parentDepth + subtreeDepth > MAX_DEPTH) return false

    const f = foldersById.value.get(id)
    if (!f) return false
    f.parentId = parentId
    f.updatedAt = Date.now()

    // Re-order siblings.
    const siblings = folderList.value
      .filter(x => x.parentId === parentId && x.id !== id)
      .sort((a, b) => a.order - b.order)

    let insertIdx = siblings.length
    if (placement.beforeId) {
      const idx = siblings.findIndex(x => x.id === placement.beforeId)
      insertIdx = idx >= 0 ? idx : siblings.length
    } else if (placement.atEnd) {
      insertIdx = siblings.length
    }
    siblings.splice(insertIdx, 0, f)
    siblings.forEach((x, i) => { x.order = i })

    await foldersDb.put(f)
    for (const x of siblings) {
      if (x !== f) await foldersDb.put(x)
    }
    folderList.value = [...folderList.value]
    return true
  }

  function isDescendantOf(ancestorId: string, descendantId: string): boolean {
    let cur = foldersById.value.get(descendantId)
    while (cur) {
      if (cur.parentId === ancestorId) return true
      cur = cur.parentId ? foldersById.value.get(cur.parentId) : undefined
    }
    return false
  }

  function maxSubtreeDepth(id: string): number {
    function depthOf(fid: string): number {
      const f = foldersById.value.get(fid)
      if (!f) return 0
      const children = folderList.value.filter(x => x.parentId === fid)
      if (children.length === 0) return 1
      return 1 + Math.max(...children.map(c => depthOf(c.id)))
    }
    return depthOf(id)
  }

  return {
    folderList,
    requestList,
    loaded,
    foldersById,
    requestsById,
    load,
    createFolder,
    renameFolder,
    deleteFolder,
    createRequest,
    updateRequest,
    deleteRequest,
    moveRequest,
    moveFolder,
    getDepth,
    canAddChild
  }
})