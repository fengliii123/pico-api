// Lazy JSON tree helpers: search matching, ancestor expansion, and the
// bounded default-expansion walk.
import { describe, expect, it } from 'vitest'
import { ancestorPaths, defaultExpandedPaths, lastSegment, matchTreePaths, visiblePathsFor } from '@/core/jsonTree'

const data = {
  users: [
    { id: 1, name: 'Leanne', role: 'admin' },
    { id: 2, name: 'Tobias', role: 'member' }
  ],
  total: 2,
  active: true
}

describe('matchTreePaths', () => {
  it('matches by key', () => {
    expect(matchTreePaths(data, 'total')).toEqual(['total'])
  })

  it('matches scalar values, including inside arrays/objects', () => {
    const m = matchTreePaths(data, 'leanne')
    expect(m).toEqual(['users[0].name'])
    expect(matchTreePaths(data, 'admin')).toEqual(['users[0].role'])
  })

  it('empty query matches nothing', () => {
    expect(matchTreePaths(data, '  ')).toEqual([])
  })
})

describe('ancestorPaths', () => {
  it('returns proper ancestors, outermost first', () => {
    expect(ancestorPaths('a.b[2].c')).toEqual(['a', 'a.b', 'a.b[2]'])
  })

  it('top-level and root have no ancestors', () => {
    expect(ancestorPaths('a')).toEqual([])
    expect(ancestorPaths('')).toEqual([])
  })
})

describe('visiblePathsFor', () => {
  it('match plus ancestors stay visible; root is always kept', () => {
    const vis = visiblePathsFor(data, 'tobias')!
    expect(vis.has('users[1].name')).toBe(true)
    expect(vis.has('users[1]')).toBe(true)
    expect(vis.has('users')).toBe(true)
    expect(vis.has('')).toBe(true)
    expect(vis.has('users[0]')).toBe(false)
  })

  it('no query → null (everything visible); query with no hits → empty set', () => {
    expect(visiblePathsFor(data, '')).toBeNull()
    expect(visiblePathsFor(data, 'zzz')!.size).toBe(0)
  })
})

describe('defaultExpandedPaths', () => {
  it('expands containers shallower than maxDepth, root included', () => {
    // maxDepth 2 → root ('') + direct child containers (users).
    expect(defaultExpandedPaths(data, 2)).toEqual(['', 'users'])
    expect(defaultExpandedPaths(data, 3)).toEqual(['', 'users', 'users[0]', 'users[1]'])
  })

  it('bounded walk on a huge array does not enumerate deeply', () => {
    const big = { items: Array.from({ length: 100_000 }, (_, i) => ({ id: i, deep: { deeper: { deepest: i } } })) }
    // items is 100k wide — too wide to auto-expand, so only the root opens.
    expect(defaultExpandedPaths(big, 2)).toEqual([''])
  })

  it('wide containers beyond the threshold stay collapsed by default', () => {
    const wide = { rows: Array.from({ length: 3000 }, (_, i) => ({ id: i })) }
    expect(defaultExpandedPaths(wide, 2)).toEqual([''])
    expect(defaultExpandedPaths({ rows: [{ id: 1 }] }, 2)).toEqual(['', 'rows'])
  })
})

describe('lastSegment', () => {
  it('extracts the display key', () => {
    expect(lastSegment('users[2].name')).toBe('name')
    // Array items display with their parent path (matches the old tree).
    expect(lastSegment('users[2]')).toBe('users[2]')
    expect(lastSegment('users')).toBe('users')
  })
})
