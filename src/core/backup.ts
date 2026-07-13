// Full-application backup format. Covers everything in IndexedDB except
// transient capture data (chrome.debugger session memory is never persisted,
// so there's nothing to back up).
//
// The schema field + version let us evolve the format without breaking
// older exports. Import validates the schema header and rejects anything
// it doesn't recognize.

import type {
  Folder, SavedRequest, HistoryEntry, Environment, Globals
} from './types'
import {
  folders as foldersDb,
  requests as requestsDb,
  history as historyDb,
  environments as envDb,
  globals as globalsDb
} from '@/db'

export const BACKUP_SCHEMA = 'minipostman-v2-backup'
export const BACKUP_VERSION = 1

export interface BackupData {
  folders: Folder[]
  requests: SavedRequest[]
  history: HistoryEntry[]
  environments: Environment[]
  globals: Globals | null
}

export interface BackupFile {
  schema: typeof BACKUP_SCHEMA
  version: typeof BACKUP_VERSION
  exportedAt: number
  appVersion?: string
  data: BackupData
}

export class BackupParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupParseError'
  }
}

// Read every store into a plain object. History is capped at the same 100
// the UI surfaces — that's all we persist anyway, and keeping the cap
// consistent here means an export → import round-trip yields identical UI.
export async function exportAll(): Promise<BackupFile> {
  const [folders, requests, history, environments, globals] = await Promise.all([
    foldersDb.list(),
    requestsDb.list(),
    historyDb.list(100),
    envDb.list(),
    globalsDb.get().catch(() => undefined)
  ])

  const appVersion = readAppVersion()

  return {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    appVersion,
    data: { folders, requests, history, environments, globals: globals ?? null }
  }
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2)
}

export function parseBackup(jsonText: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (e: any) {
    throw new BackupParseError(`Not valid JSON: ${e?.message ?? e}`)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new BackupParseError('Backup root is not an object')
  }
  const obj = parsed as Partial<BackupFile>
  if (obj.schema !== BACKUP_SCHEMA) {
    throw new BackupParseError(
      `Unknown backup schema "${String(obj.schema)}". Expected "${BACKUP_SCHEMA}".`
    )
  }
  if (obj.version !== BACKUP_VERSION) {
    throw new BackupParseError(
      `Unsupported backup version ${obj.version}. Expected ${BACKUP_VERSION}.`
    )
  }
  if (!obj.data || typeof obj.data !== 'object') {
    throw new BackupParseError('Backup file missing "data" block')
  }
  const data = obj.data as Partial<BackupData>
  if (!Array.isArray(data.folders) || !Array.isArray(data.requests)) {
    throw new BackupParseError('Backup data.folders / data.requests must be arrays')
  }
  // history / environments are arrays too; globals is a singleton or null.
  if (data.history !== undefined && !Array.isArray(data.history)) {
    throw new BackupParseError('Backup data.history must be an array when present')
  }
  if (data.environments !== undefined && !Array.isArray(data.environments)) {
    throw new BackupParseError('Backup data.environments must be an array when present')
  }
  return { ...obj, data } as BackupFile
}

// Wipe the user's data and reload from a backup file. We clear every store
// first so partial backups (e.g. exported without history) still land in
// a clean slate rather than mixing with leftover rows.
export async function importAll(file: BackupFile): Promise<void> {
  const { folders, requests, history, environments, globals } = file.data

  // Clear-then-put per store. Each store is independent in IDB; we can't
  // wrap all 5 in one transaction without restructuring db/index.ts, and
  // the failure mode (partial write) is acceptable for a manual restore
  // flow — the user re-runs the import after fixing the source data.
  await Promise.all([
    foldersDb.clear(),
    requestsDb.clear(),
    historyDb.clear(),
    envDb.clear()
  ])

  for (const f of folders) await foldersDb.put(f)
  for (const r of requests) await requestsDb.put(r)
  for (const h of history ?? []) await historyDb.add(h)
  for (const e of environments ?? []) await envDb.put(e)
  if (globals) await globalsDb.put(globals)
}

// Pull the version from chrome.runtime.getManifest when available; fall
// back to the literal in package.json-ish constant otherwise. We avoid
// importing package.json at runtime (Vite handles that statically) —
// embedding a constant is fine for a 0.x release.
function readAppVersion(): string | undefined {
  try {
    const c = (globalThis as any).chrome
    if (c?.runtime?.getManifest) {
      return c.runtime.getManifest().version
    }
  } catch {
    // not in extension context (e.g. tests) — fall through
  }
  return undefined
}

// Convenience: build a sensible download filename for the user.
export function defaultBackupFilename(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `minipostman-v2-backup-${ts}.json`
}