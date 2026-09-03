// Pure helpers for the lazy JSON tree: search matching over a parsed JSON
// value and path utilities. Paths mirror the old flattened format —
// object child `parent.key`, array child `parent[i]`, root ''.

export function lastSegment(path: string): string {
  if (!path) return ''
  const parts = path.split('.')
  return parts[parts.length - 1]
}

// Paths of nodes whose key OR scalar value matches the query
// (case-insensitive substring). Container nodes match by key only.
export function matchTreePaths(value: unknown, query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: string[] = []

  const walk = (v: unknown, path: string) => {
    const key = lastSegment(path)
    if (path && key.toLowerCase().includes(q)) {
      out.push(path)
    }
    if (v === null || typeof v !== 'object') {
      if (path && !key.toLowerCase().includes(q) && String(v).toLowerCase().includes(q)) {
        out.push(path)
      }
      return
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`))
    } else {
      for (const [k, child] of Object.entries(v)) {
        walk(child, path ? `${path}.${k}` : k)
      }
    }
  }

  walk(value, '')
  return out
}

// Every proper ancestor of a path: 'a.b[2].c' → ['a', 'a.b', 'a.b[2]'].
export function ancestorPaths(path: string): string[] {
  if (!path) return []
  const out: string[] = []
  let end = path.length
  while (end > 0) {
    const dot = path.lastIndexOf('.', end - 1)
    const bracket = path.lastIndexOf('[', end - 1)
    const cut = Math.max(dot, bracket)
    if (cut <= 0) break
    out.push(path.slice(0, cut))
    end = cut
  }
  return out.reverse()
}

// The set of paths that should RENDER during a search: matches plus every
// ancestor of a match (so hits stay reachable in the tree). The root ''
// is always included — without it a top-level match hides its own parent.
export function visiblePathsFor(value: unknown, query: string): Set<string> | null {
  const matches = matchTreePaths(value, query)
  if (matches.length === 0) return query.trim() ? new Set() : null
  const set = new Set<string>(['', ...matches])
  for (const p of matches) {
    for (const a of ancestorPaths(p)) set.add(a)
  }
  return set
}

// Containers wider than this stay collapsed by default — auto-expanding a
// 3000-item array on open would materialize 3000 rows "lazily" defeating
// the point. The user can still expand them explicitly.
const DEFAULT_EXPAND_MAX_WIDTH = 100

// Paths of container nodes shallower than `maxDepth` — used to seed the
// default expansion (maxDepth 2 = root plus its direct child containers).
// Walk is bounded, so a huge JSON costs at most a few levels regardless of
// total size. The root ('') is always included.
export function defaultExpandedPaths(
  value: unknown,
  maxDepth = 2,
  maxWidth = DEFAULT_EXPAND_MAX_WIDTH
): string[] {
  const out: string[] = []
  const walk = (v: unknown, path: string, depth: number) => {
    if (v === null || typeof v !== 'object') return
    const width = Array.isArray(v) ? v.length : Object.keys(v).length
    if (width > maxWidth) return
    out.push(path)
    if (depth + 1 >= maxDepth) return
    if (Array.isArray(v)) v.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1))
    else for (const [k, child] of Object.entries(v)) walk(child, path ? `${path}.${k}` : k, depth + 1)
  }
  walk(value, '', 0)
  return out
}
