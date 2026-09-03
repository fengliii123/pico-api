// Locale-sync planning for the first-run Examples seed. Seeded names are
// created in the UI locale at first run; if the user later switches the
// app language AND hasn't touched the seed, we rename it to follow. Any
// user modification (renamed child, foreign request moved in) cancels the
// sync so we never overwrite the user's own naming.

import type { Folder, SavedRequest } from './types'

export interface SeedNames {
  folder: string
  get: string
  post: string
}

export interface SeedRenamePlan {
  folderId: string
  folderName: string
  requestRenames: Array<{ id: string; name: string }>
}

export function computeSeedRename(
  folders: Folder[],
  requests: SavedRequest[],
  from: SeedNames,
  to: SeedNames
): SeedRenamePlan | null {
  const folder = folders.find(f => f.parentId === null && f.name === from.folder)
  if (!folder) return null

  const children = requests.filter(r => r.folderId === folder.id)
  const requestRenames: Array<{ id: string; name: string }> = []
  for (const r of children) {
    if (r.name === from.get) requestRenames.push({ id: r.id, name: to.get })
    else if (r.name === from.post) requestRenames.push({ id: r.id, name: to.post })
    else return null // user-touched content — leave the seed alone
  }
  return { folderId: folder.id, folderName: to.folder, requestRenames }
}
