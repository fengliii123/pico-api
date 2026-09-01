import { describe, expect, it } from 'vitest'
import { collectFolderKeys, filterTree, buildTree } from '@/components/tree/treeUtils'
import type { Folder, SavedRequest } from '@/core/types'

function folder(id: string, name: string, parentId: string | null = null): Folder {
  return { id, name, parentId, order: 0, createdAt: 0, updatedAt: 0 }
}
function request(id: string, name: string, url: string, folderId: string | null = null): SavedRequest {
  return {
    id, name, folderId, order: 0, createdAt: 0, updatedAt: 0,
    method: 'GET', url,
    headers: [], params: [], body: { kind: 'none' }
  } as SavedRequest
}

const folders = [
  folder('f1', 'Auth'),
  folder('f2', 'Users', 'f1'),
  folder('f3', 'Payments')
]
const requests = [
  request('r1', 'login', 'https://api.test/login', 'f2'),
  request('r2', 'list users', 'https://api.test/users', 'f2'),
  request('r3', 'charge', 'https://api.test/pay', 'f3')
]

describe('filterTree', () => {
  it('empty query returns the tree unchanged', () => {
    const tree = buildTree(folders, requests)
    expect(filterTree(tree, '  ')).toBe(tree)
  })

  it('folder-name match keeps the whole subtree', () => {
    const out = filterTree(buildTree(folders, requests), 'users')
    // "Users" folder matches; its children stay, other top-levels drop
    expect(out.map(n => n.key)).toEqual(['folder:f1'])
    const f1 = out[0]
    expect(f1.children!.map(n => n.key)).toEqual(['folder:f2'])
    expect(f1.children![0].children!.map(n => n.key)).toEqual(['request:r1', 'request:r2'])
  })

  it('request-name match keeps only it plus its ancestors', () => {
    const out = filterTree(buildTree(folders, requests), 'charge')
    expect(out.map(n => n.key)).toEqual(['folder:f3'])
    expect(out[0].children!.map(n => n.key)).toEqual(['request:r3'])
  })

  it('matches request URL case-insensitively', () => {
    const out = filterTree(buildTree(folders, requests), 'API.TEST/PAY')
    expect(out[0].children!.map(n => n.key)).toEqual(['request:r3'])
  })

  it('no match yields empty array', () => {
    expect(filterTree(buildTree(folders, requests), 'zzz')).toEqual([])
  })
})

describe('collectFolderKeys', () => {
  it('lists every folder key, depth-first', () => {
    expect(collectFolderKeys(buildTree(folders, requests))).toEqual(['folder:f1', 'folder:f2', 'folder:f3'])
  })
})
