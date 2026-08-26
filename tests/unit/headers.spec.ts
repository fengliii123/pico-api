import { describe, expect, it } from 'vitest'
import { processHeaders } from '@/core/headers'
import type { KeyValueRow, RequestBody } from '@/core/types'

function row(key: string, value: string, enabled = true): KeyValueRow {
  return { id: key + value, key, value, enabled }
}

const noBody: RequestBody = { mode: 'none' }

describe('processHeaders: case-insensitive dedup', () => {
  it('keeps the first variant and reports the duplicate as dropped', () => {
    const { headers, dropped } = processHeaders(
      [row('Content-Type', 'application/xml'), row('content-type', 'application/json')],
      noBody
    )
    expect(headers).toEqual({ 'Content-Type': 'application/xml' })
    expect(dropped).toContainEqual({
      key: 'content-type',
      value: 'application/json',
      reason: 'dropped:duplicate-case-insensitive'
    })
  })

  it('treats distinct header names as distinct even in different cases', () => {
    const { headers, dropped } = processHeaders(
      [row('X-Token', 'a'), row('x-secret', 'b')],
      noBody
    )
    expect(headers).toEqual({ 'X-Token': 'a', 'x-secret': 'b' })
    expect(dropped.filter(d => d.reason === 'dropped:duplicate-case-insensitive')).toHaveLength(0)
  })
})

describe('processHeaders: existing behavior unchanged', () => {
  it('drops browser-banned headers with reason', () => {
    const { headers, dropped } = processHeaders([row('User-Agent', 'curl/8')], noBody)
    expect(headers).toEqual({})
    expect(dropped[0]?.reason).toBe('dropped-by-browser:browser-bans-this-header')
  })

  it('skips disabled rows and empty keys/values', () => {
    const { headers } = processHeaders(
      [row('X-A', '1', false), row('', '2'), row('X-B', '')],
      noBody
    )
    expect(headers).toEqual({})
  })

  it('auto-injects Content-Type for raw JSON body when user set none', () => {
    const { headers, dropped } = processHeaders(
      [],
      { mode: 'raw', rawType: 'json', raw: '{"a":1}' }
    )
    expect(headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(dropped[0]?.reason).toBe('auto-injected:raw-json')
  })

  it('does not double-inject when user already set content-type in any case', () => {
    const { headers, dropped } = processHeaders(
      [row('content-type', 'application/xml')],
      { mode: 'raw', rawType: 'json', raw: '{}' }
    )
    expect(headers).toEqual({ 'content-type': 'application/xml' })
    expect(dropped).toHaveLength(0)
  })
})
