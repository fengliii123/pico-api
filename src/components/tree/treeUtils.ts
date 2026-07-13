// Build a tree-shaped array suitable for AntD's <a-tree> from flat
// folder + request lists.

import type { Folder, SavedRequest } from '@/core/types'

export type TreeNode =
  | { kind: 'folder'; id: string; folder: Folder; children: TreeNode[]; depth: number }
  | { kind: 'request'; id: string; request: SavedRequest; depth: number }

export interface AntTreeNode {
  key: string
  title: string
  isLeaf: boolean
  node: TreeNode
  children?: AntTreeNode[]
}

function folderByParent(folders: Folder[]): Map<string | null, Folder[]> {
  const m = new Map<string | null, Folder[]>()
  for (const f of folders) {
    const list = m.get(f.parentId) ?? []
    list.push(f)
    m.set(f.parentId, list)
  }
  for (const list of m.values()) list.sort((a, b) => a.order - b.order)
  return m
}

function requestsByFolder(requests: SavedRequest[]): Map<string | null, SavedRequest[]> {
  const m = new Map<string | null, SavedRequest[]>()
  for (const r of requests) {
    const list = m.get(r.folderId) ?? []
    list.push(r)
    m.set(r.folderId, list)
  }
  for (const list of m.values()) list.sort((a, b) => a.order - b.order)
  return m
}

export function buildTree(folders: Folder[], requests: SavedRequest[]): AntTreeNode[] {
  const foldersByParent = folderByParent(folders)
  const requestsByFolderId = requestsByFolder(requests)

  function build(parentId: string | null, depth: number): AntTreeNode[] {
    const result: AntTreeNode[] = []
    const childFolders = foldersByParent.get(parentId) ?? []
    const childRequests = requestsByFolderId.get(parentId) ?? []

    for (const f of childFolders) {
      const node: TreeNode = {
        kind: 'folder',
        id: f.id,
        folder: f,
        children: [],
        depth
      }
      result.push({
        key: `folder:${f.id}`,
        title: f.name,
        isLeaf: false,
        node,
        children: build(f.id, depth + 1)
      })
    }

    for (const r of childRequests) {
      const node: TreeNode = {
        kind: 'request',
        id: r.id,
        request: r,
        depth
      }
      result.push({
        key: `request:${r.id}`,
        title: r.name,
        isLeaf: true,
        node
      })
    }

    return result
  }

  return build(null, 1)
}

export function isFolderKey(key: string): boolean {
  return key.startsWith('folder:')
}

export function isRequestKey(key: string): boolean {
  return key.startsWith('request:')
}

export function folderIdFromKey(key: string): string {
  return key.slice('folder:'.length)
}

export function requestIdFromKey(key: string): string {
  return key.slice('request:'.length)
}