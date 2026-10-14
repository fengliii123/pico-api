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

// Filter the tree by a case-insensitive substring against folder names,
// request names, and request URLs. A folder survives when it matches by
// name (keeping its whole subtree) or when any descendant survives;
// ancestors of surviving nodes are always kept so matches stay navigable.
export function filterTree(nodes: AntTreeNode[], query: string): AntTreeNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes

  function walk(list: AntTreeNode[]): AntTreeNode[] {
    const out: AntTreeNode[] = []
    for (const n of list) {
      if (n.isLeaf) {
        const r = n.node.kind === 'request' ? n.node.request : null
        const name = (r?.name ?? n.title).toLowerCase()
        const url = (r?.url ?? '').toLowerCase()
        if (name.includes(q) || url.includes(q)) out.push(n)
      } else {
        if (n.title.toLowerCase().includes(q)) {
          out.push(n)
        } else {
          const children = n.children ? walk(n.children) : []
          if (children.length) out.push({ ...n, children })
        }
      }
    }
    return out
  }

  return walk(nodes)
}

// All folder keys in a tree — used to auto-expand every folder while a
// search filter is active.
export function collectFolderKeys(nodes: AntTreeNode[]): string[] {
  const keys: string[] = []
  for (const n of nodes) {
    if (!n.isLeaf) {
      keys.push(n.key)
      if (n.children) keys.push(...collectFolderKeys(n.children))
    }
  }
  return keys
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

export interface DropPlacement {
  targetParentId: string | null
  beforeId: string | null
  atEnd: boolean
}

// Translate an AntD Tree drop event into the (parent, slot) placement our
// stores understand. Pure: folder/request lookups are injected so the
// function stays testable. Returns null when the target row no longer
// exists (stale drop event) — callers should ignore the drop.
//
// AntD contract:
//   info.dropToGap = true  → drop between siblings of info.node
//   info.dropToGap = false → drop "inside" info.node (only valid for folders)
//   info.dropPosition is the ABSOLUTE insert index among the node's siblings;
//   subtract the node's own index (last segment of info.node.pos) to get the
//   relative position: -1 above the node, +1 below it.
export function resolveDropPlacement(
  input: {
    isDragFolder: boolean
    targetKey: string
    dropToGap: boolean
    dropPosition: number
    nodeIndex: number
  },
  lookups: {
    folderParent: (folderId: string) => string | null | undefined
    requestFolder: (requestId: string) => string | null | undefined
    nextFolderSibling: (folderId: string) => string | null
    nextRequestSibling: (requestId: string) => string | null
  }
): DropPlacement | null {
  const { isDragFolder, targetKey, dropToGap, dropPosition, nodeIndex } = input

  // Special case: a request dropped onto a folder ALWAYS goes inside the
  // folder, regardless of what Antd thinks the drop edge was. Antd
  // reports dropToGap=true for empty folders (because there's no first
  // child to "drop above"), which would otherwise route us into the
  // sibling branch and leave the request next to the folder instead
  // of inside it.
  if (!isDragFolder && isFolderKey(targetKey)) {
    return { targetParentId: folderIdFromKey(targetKey), beforeId: null, atEnd: true }
  }

  if (!dropToGap) {
    // Drop inside info.node. Folders hold children; if the target is a
    // request, fall back to that request's parent folder.
    if (isFolderKey(targetKey)) {
      return { targetParentId: folderIdFromKey(targetKey), beforeId: null, atEnd: true }
    }
    const parent = lookups.requestFolder(requestIdFromKey(targetKey))
    if (parent === undefined) return null
    return { targetParentId: parent, beforeId: null, atEnd: true }
  }

  // Gap mode: drop as a sibling of info.node — above or below it. The
  // beforeId we emit is consumed by the dragged item's OWN sibling list
  // (folders vs requests are ordered separately), so it only carries a
  // same-kind id; cross-kind gaps (e.g. a request dropped next to a
  // folder) fall back to atEnd, which is where the two lists join anyway.
  let targetParentId: string | null
  if (isFolderKey(targetKey)) {
    targetParentId = lookups.folderParent(folderIdFromKey(targetKey)) ?? null
  } else {
    const parent = lookups.requestFolder(requestIdFromKey(targetKey))
    if (parent === undefined) return null
    targetParentId = parent
  }

  const rel = dropPosition - nodeIndex
  const targetIsFolder = isFolderKey(targetKey)

  if (rel < 0) {
    // Above the target node.
    if (isDragFolder === targetIsFolder) {
      const beforeId = targetIsFolder ? folderIdFromKey(targetKey) : requestIdFromKey(targetKey)
      return { targetParentId, beforeId, atEnd: false }
    }
    return { targetParentId, beforeId: null, atEnd: true }
  }

  // Below the target node: insert after it, i.e. before the next same-kind
  // sibling (or at the end when the target is the last one).
  if (isDragFolder === targetIsFolder) {
    const beforeId = targetIsFolder
      ? lookups.nextFolderSibling(folderIdFromKey(targetKey))
      : lookups.nextRequestSibling(requestIdFromKey(targetKey))
    return { targetParentId, beforeId, atEnd: beforeId === null }
  }
  return { targetParentId, beforeId: null, atEnd: true }
}