// History cap: excessHistoryIds decides which entries get pruned after a
// write — newest `keep` survive (by sentAt desc), the rest are deleted.
import { describe, expect, it } from 'vitest'
import { excessHistoryIds, MAX_HISTORY } from '@/db'

function e(id: string, sentAt: number) {
  return { id, sentAt }
}

describe('excessHistoryIds', () => {
  it('returns nothing when under the cap', () => {
    expect(excessHistoryIds([e('a', 1), e('b', 2)], 500)).toEqual([])
  })

  it('keeps the newest `keep` entries, returns the oldest ids', () => {
    const entries = [e('old1', 1), e('new', 99), e('old2', 2), e('mid', 50)]
    expect(excessHistoryIds(entries, 2)).toEqual(['old2', 'old1'])
  })

  it('handles exactly-at-cap without deletions', () => {
    const entries = Array.from({ length: 3 }, (_, i) => e(`e${i}`, i))
    expect(excessHistoryIds(entries, 3)).toEqual([])
    expect(excessHistoryIds(entries, 2)).toEqual(['e0'])
  })

  it('default cap is 500', () => {
    expect(MAX_HISTORY).toBe(500)
  })
})
