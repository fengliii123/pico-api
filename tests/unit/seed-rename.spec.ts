// Seed locale-sync: pristine examples rename to the new locale's names;
// anything the user touched cancels the sync entirely.
import { describe, expect, it } from 'vitest'
import { computeSeedRename, type SeedNames } from '@/core/seed'
import type { Folder, SavedRequest } from '@/core/types'

const zh: SeedNames = { folder: '示例', get: '获取演示用户(JSON)', post: '发送 JSON 并回显' }
const en: SeedNames = { folder: 'Examples', get: 'Get a demo user (JSON)', post: 'Echo a POST with JSON body' }

function folder(id: string, name: string, parentId: string | null = null): Folder {
  return { id, name, parentId, order: 0, createdAt: 0, updatedAt: 0 }
}
function request(id: string, name: string, folderId: string): SavedRequest {
  return {
    id, name, folderId, order: 0, createdAt: 0, updatedAt: 0,
    method: 'GET', url: 'https://x.test', headers: [], params: [], body: { mode: 'none' }
  } as SavedRequest
}

describe('computeSeedRename', () => {
  it('renames a pristine seed to the target locale', () => {
    const plan = computeSeedRename(
      [folder('f1', zh.folder)],
      [request('r1', zh.get, 'f1'), request('r2', zh.post, 'f1')],
      zh, en
    )
    expect(plan).toEqual({
      folderId: 'f1',
      folderName: en.folder,
      requestRenames: [
        { id: 'r1', name: en.get },
        { id: 'r2', name: en.post }
      ]
    })
  })

  it('returns null when the user renamed any child — nothing is overwritten', () => {
    const plan = computeSeedRename(
      [folder('f1', zh.folder)],
      [request('r1', '我自己的名字', 'f1'), request('r2', zh.post, 'f1')],
      zh, en
    )
    expect(plan).toBeNull()
  })

  it('returns null when the folder itself was renamed or deleted', () => {
    expect(computeSeedRename([folder('f1', 'My Folder')], [], zh, en)).toBeNull()
    expect(computeSeedRename([], [], zh, en)).toBeNull()
  })

  it('partial seed (one request deleted) still renames the rest', () => {
    const plan = computeSeedRename(
      [folder('f1', zh.folder)],
      [request('r2', zh.post, 'f1')],
      zh, en
    )
    expect(plan?.requestRenames).toEqual([{ id: 'r2', name: en.post }])
  })
})
