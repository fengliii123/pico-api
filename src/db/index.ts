// IndexedDB schema (v2):
//   folders         keyPath: id,  index: parentId
//   requests        keyPath: id,  index: folderId
//   history         keyPath: id,  index: sentAt (DESC)
//   environments    keyPath: id                    (v2)
//   globals         keyPath: id, singleton row     (v2)
//
// Migrations live in this file. Bump DB_VERSION and append a branch in
// upgrade() to add a new store or index.
//
// DB_NAME history:
//   v1 — 'mini-postman-v2'  (initial)
//   v2 — 'pico-api'         (rebrand, 0.2.0)
//   On first open of 'pico-api' we copy any rows from a leftover
//   'mini-postman-v2' DB at the same schema version into the new DB,
//   then drop the old one. This keeps dev installs from losing local
//   data across the rename.

import type { Folder, SavedRequest, HistoryEntry, Environment, Globals } from '@/core/types'
import { deepClone } from '@/utils/clone'

export const DB_NAME = 'pico-api'
export const DB_VERSION = 2
export const LEGACY_DB_NAME = 'mini-postman-v2'

export const STORE_FOLDERS = 'folders'
export const STORE_REQUESTS = 'requests'
export const STORE_HISTORY = 'history'
export const STORE_ENVIRONMENTS = 'environments'
export const STORE_GLOBALS = 'globals'
export const GLOBALS_ID = 'singleton'

let dbPromise: Promise<IDBDatabase> | null = null

// Strip reactive Vue Proxy wrappers before pushing to IDB. We only
// normalize at the store layer (see `plain()` in stores/collection.ts);
// this helper is a defensive fallback for ad-hoc writes from anywhere.
// Real Chrome tolerates Proxies; fake-indexeddb (used in tests) does not.
function toIDB<T>(value: T): T {
  return deepClone(value)
}

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (event) => {
      const db = req.result
      upgrade(db, event.oldVersion)
    }

    req.onsuccess = () => {
      resolve(req.result)
      // Fire-and-forget; doesn't gate readiness.
      migrateLegacyIfNeeded().catch(() => { /* swallow — best effort */ })
    }
    req.onerror = () => {
      // IndexedDB disallows opening at a lower version than what's on
      // disk. This happens when an older build runs over data left by a
      // newer one (rollback, dev branch switch, stale dev install). The
      // raw VersionError is opaque — surface a clear hint so the user
      // knows to clear storage instead of seeing "Uncaught (in promise)
      // VersionError: The requested version (2) is less than the
      // existing version (3)".
      const err = req.error
      if (err?.name === 'VersionError') {
        reject(new Error(
          `IndexedDB "${DB_NAME}" is at a newer version than this build expects ` +
          `(code expects v${DB_VERSION}). Clear the extension's storage in ` +
          `chrome://extensions → Pico API → Details → Storage, then reload.`
        ))
      } else {
        reject(err)
      }
      // Reset the cached promise so the next openDB() call re-attempts
      // the open. Otherwise the rejected promise gets pinned for the
      // page lifetime — even after the user clears storage and reloads
      // data, every IDB call here would keep rejecting until a full
      // page refresh.
      dbPromise = null
    }
  })

  return dbPromise
}

// Close any cached IDB connection. Production code never needs this (the
// connection lives for the page lifetime), but tests need to release the
// connection between specs so `deleteDatabase` isn't blocked.
export function closeDBForTests(): void {
  if (!dbPromise) return
  dbPromise.then(db => {
    try { db.close() } catch { /* already closed */ }
  })
  dbPromise = null
}

function upgrade(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
      const s = db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' })
      s.createIndex('parentId', 'parentId', { unique: false })
    }
    if (!db.objectStoreNames.contains(STORE_REQUESTS)) {
      const s = db.createObjectStore(STORE_REQUESTS, { keyPath: 'id' })
      s.createIndex('folderId', 'folderId', { unique: false })
    }
    if (!db.objectStoreNames.contains(STORE_HISTORY)) {
      const s = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' })
      s.createIndex('sentAt', 'sentAt', { unique: false })
    }
  }
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains(STORE_ENVIRONMENTS)) {
      db.createObjectStore(STORE_ENVIRONMENTS, { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains(STORE_GLOBALS)) {
      db.createObjectStore(STORE_GLOBALS, { keyPath: 'id' })
    }
  }
}

// One-shot legacy-data carry-over: if a 'mini-postman-v2' DB exists at
// schema version 2 (same as us), copy each store into the current DB
// then drop the old one. Runs at most once per page load — guarded by
// a module-level flag.
let legacyMigrationDone = false
function migrateLegacyIfNeeded(): Promise<void> {
  if (legacyMigrationDone) return Promise.resolve()
  legacyMigrationDone = true
  return new Promise((resolve) => {
    const probe = indexedDB.open(LEGACY_DB_NAME)
    probe.onsuccess = () => {
      const oldDb = probe.result
      // If the legacy DB is at a different schema version, bail and let
      // it alone — copying mixed-version data would be worse than
      // starting clean.
      if (oldDb.version !== DB_VERSION) { oldDb.close(); resolve(); return }
      copyStoresFrom(oldDb).then(() => {
        oldDb.close()
        const drop = indexedDB.deleteDatabase(LEGACY_DB_NAME)
        drop.onsuccess = () => resolve()
        drop.onerror = () => resolve()
        drop.onblocked = () => resolve()
      }).catch(() => { oldDb.close(); resolve() })
    }
    probe.onerror = () => resolve() // no legacy DB — most common path
  })
}

async function copyStoresFrom(oldDb: IDBDatabase): Promise<void> {
  const db = await openDB()
  const storeNames = [
    STORE_FOLDERS, STORE_REQUESTS, STORE_HISTORY, STORE_ENVIRONMENTS, STORE_GLOBALS
  ]
  for (const name of storeNames) {
    if (!oldDb.objectStoreNames.contains(name)) continue
    if (!db.objectStoreNames.contains(name)) continue
    const rows: any[] = await new Promise((resolve, reject) => {
      const r = oldDb.transaction(name, 'readonly').objectStore(name).getAll()
      r.onsuccess = () => resolve(r.result || [])
      r.onerror = () => reject(r.error)
    })
    if (!rows.length) continue
    const t = db.transaction(name, 'readwrite')
    const s = t.objectStore(name)
    for (const row of rows) s.put(toIDB(row))
    await new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  }
}


function tx(db: IDBDatabase, names: string | string[], mode: IDBTransactionMode) {
  return db.transaction(names, mode)
}

function awaitReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}


export const folders = {
  async list(): Promise<Folder[]> {
    const db = await openDB()
    const t = tx(db, STORE_FOLDERS, 'readonly')
    return awaitReq<Folder[]>(t.objectStore(STORE_FOLDERS).getAll())
  },

  async get(id: string): Promise<Folder | undefined> {
    const db = await openDB()
    const t = tx(db, STORE_FOLDERS, 'readonly')
    return awaitReq<Folder | undefined>(t.objectStore(STORE_FOLDERS).get(id))
  },

  async put(folder: Folder): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_FOLDERS, 'readwrite')
    await awaitReq(t.objectStore(STORE_FOLDERS).put(toIDB(folder)))
  },

  async clear(): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_FOLDERS, 'readwrite')
    await awaitReq(t.objectStore(STORE_FOLDERS).clear())
  },

  async delete(id: string): Promise<void> {
    const db = await openDB()
    const t = tx(db, [STORE_FOLDERS, STORE_REQUESTS], 'readwrite')

    // Build the descendant set by walking the parentId index in a single
    // cursor — no getAll(), no interleaved awaits.
    const foldersStore = t.objectStore(STORE_FOLDERS)
    const requestsStore = t.objectStore(STORE_REQUESTS)

    const toDelete = new Set<string>([id])
    const pendingParents = [id]

    while (pendingParents.length) {
      const parentId = pendingParents.pop()!
      const children: Folder[] = await new Promise((resolve, reject) => {
        const result: Folder[] = []
        const cursorReq = foldersStore.index('parentId').openCursor(IDBKeyRange.only(parentId))
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (!cursor) { resolve(result); return }
          result.push(cursor.value)
          cursor.continue()
        }
        cursorReq.onerror = () => reject(cursorReq.error)
      })
      for (const child of children) {
        if (!toDelete.has(child.id)) {
          toDelete.add(child.id)
          pendingParents.push(child.id)
        }
      }
    }

    // Now delete on the same tx — no more awaits between operations.
    for (const fid of toDelete) {
      foldersStore.delete(fid)
    }

    for (const fid of toDelete) {
      const idx = requestsStore.index('folderId')
      const cursorReq = idx.openCursor(IDBKeyRange.only(fid))
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (cursor) { cursor.delete(); cursor.continue() }
          else resolve()
        }
        cursorReq.onerror = () => reject(cursorReq.error)
      })
    }

    await new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  }
}


export const requests = {
  async list(): Promise<SavedRequest[]> {
    const db = await openDB()
    const t = tx(db, STORE_REQUESTS, 'readonly')
    return awaitReq<SavedRequest[]>(t.objectStore(STORE_REQUESTS).getAll())
  },

  async get(id: string): Promise<SavedRequest | undefined> {
    const db = await openDB()
    const t = tx(db, STORE_REQUESTS, 'readonly')
    return awaitReq<SavedRequest | undefined>(t.objectStore(STORE_REQUESTS).get(id))
  },

  async put(req: SavedRequest): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_REQUESTS, 'readwrite')
    await awaitReq(t.objectStore(STORE_REQUESTS).put(toIDB(req)))
  },

  async clear(): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_REQUESTS, 'readwrite')
    await awaitReq(t.objectStore(STORE_REQUESTS).clear())
  },

  async delete(id: string): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_REQUESTS, 'readwrite')
    await awaitReq(t.objectStore(STORE_REQUESTS).delete(id))
  },

  async moveToFolder(id: string, folderId: string | null): Promise<void> {
    const r = await requests.get(id)
    if (!r) return
    r.folderId = folderId
    r.updatedAt = Date.now()
    await requests.put(r)
  }
}


export const history = {
  async list(limit = 100): Promise<HistoryEntry[]> {
    const db = await openDB()
    const t = tx(db, STORE_HISTORY, 'readonly')
    const idx = t.objectStore(STORE_HISTORY).index('sentAt')
    return new Promise((resolve, reject) => {
      const results: HistoryEntry[] = []
      // 'prev' direction iterates high→low; stop once we have enough.
      const cursorReq = idx.openCursor(null, 'prev')
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor) {
          resolve(results)
          return
        }
        results.push(cursor.value)
        if (results.length >= limit) {
          resolve(results)
        } else {
          cursor.continue()
        }
      }
      cursorReq.onerror = () => reject(cursorReq.error)
    })
  },

  async add(entry: HistoryEntry): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_HISTORY, 'readwrite')
    await awaitReq(t.objectStore(STORE_HISTORY).put(toIDB(entry)))
  },

  async clear(): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_HISTORY, 'readwrite')
    await awaitReq(t.objectStore(STORE_HISTORY).clear())
  },

  async delete(id: string): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_HISTORY, 'readwrite')
    await awaitReq(t.objectStore(STORE_HISTORY).delete(id))
  }
}


export const environments = {
  async list(): Promise<Environment[]> {
    const db = await openDB()
    const t = tx(db, STORE_ENVIRONMENTS, 'readonly')
    return awaitReq<Environment[]>(t.objectStore(STORE_ENVIRONMENTS).getAll())
  },

  async get(id: string): Promise<Environment | undefined> {
    const db = await openDB()
    const t = tx(db, STORE_ENVIRONMENTS, 'readonly')
    return awaitReq<Environment | undefined>(t.objectStore(STORE_ENVIRONMENTS).get(id))
  },

  async put(env: Environment): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_ENVIRONMENTS, 'readwrite')
    await awaitReq(t.objectStore(STORE_ENVIRONMENTS).put(toIDB(env)))
  },

  async clear(): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_ENVIRONMENTS, 'readwrite')
    await awaitReq(t.objectStore(STORE_ENVIRONMENTS).clear())
  },

  async delete(id: string): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_ENVIRONMENTS, 'readwrite')
    await awaitReq(t.objectStore(STORE_ENVIRONMENTS).delete(id))
  }
}


export const globals = {
  async get(): Promise<Globals | undefined> {
    const db = await openDB()
    const t = tx(db, STORE_GLOBALS, 'readonly')
    return awaitReq<Globals | undefined>(t.objectStore(STORE_GLOBALS).get(GLOBALS_ID))
  },

  async put(g: Globals): Promise<void> {
    const db = await openDB()
    const t = tx(db, STORE_GLOBALS, 'readwrite')
    await awaitReq(t.objectStore(STORE_GLOBALS).put(toIDB({ ...g, id: GLOBALS_ID })))
  }
}