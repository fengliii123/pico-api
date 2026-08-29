import { beforeEach, describe, expect, it } from 'vitest'
import {
  getSuccessCount,
  recordSuccessfulSend,
  shouldAskForRating
} from '@/utils/ratingPrompt'

const COUNT_KEY = 'mp2:sendSuccessCount'
const SHOWN_KEY = 'mp2:ratingPromptShown'

beforeEach(() => {
  localStorage.clear()
})

describe('rating prompt gating', () => {
  it('counts successful sends', () => {
    recordSuccessfulSend()
    recordSuccessfulSend()
    expect(getSuccessCount()).toBe(2)
  })

  it('does not ask before the threshold', () => {
    for (let i = 0; i < 14; i++) recordSuccessfulSend()
    expect(shouldAskForRating()).toBe(false)
  })

  it('asks exactly at the threshold', () => {
    for (let i = 0; i < 15; i++) recordSuccessfulSend()
    expect(shouldAskForRating()).toBe(true)
  })

  it('never asks again once shown', () => {
    localStorage.setItem(COUNT_KEY, '15')
    localStorage.setItem(SHOWN_KEY, '1')
    expect(shouldAskForRating()).toBe(false)
    recordSuccessfulSend()
    expect(shouldAskForRating()).toBe(false)
  })
})
