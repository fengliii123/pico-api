// Behavior tests for the pure helper modules under src/core/ that had no
// coverage: url parsing/merging, Set-Cookie parsing, abort-signal merging,
// and request-body serialization.
import { describe, expect, it } from 'vitest'
import {
  buildUrl,
  parseQueryParams,
  extractParamsFromUrl
} from '@/core/url'
import { parseSetCookie, parseSetCookies } from '@/core/cookies'
import { mergeAbortSignals } from '@/core/abortSignals'
import { isMethodWithBody, serializeBody } from '@/core/body'
import type { RequestBody } from '@/core/types'

describe('core/url', () => {
  it('buildUrl prepends https:// to scheme-less input only', () => {
    expect(buildUrl('example.com/api')).toBe('https://example.com/api')
    expect(buildUrl('  example.com  ')).toBe('https://example.com')
    expect(buildUrl('http://example.com')).toBe('http://example.com')
    expect(buildUrl('https://example.com')).toBe('https://example.com')
    expect(buildUrl('')).toBe('')
  })

  it('parseQueryParams decodes values, keeps repeated keys, drops fragment', () => {
    expect(parseQueryParams('https://x.test/p?a=1&b=hello%20world&a=2')).toEqual([
      { key: 'a', value: '1', enabled: true },
      { key: 'b', value: 'hello world', enabled: true },
      { key: 'a', value: '2', enabled: true }
    ])
    expect(parseQueryParams('https://x.test/p?x=1#frag')).toEqual([{ key: 'x', value: '1', enabled: true }])
    expect(parseQueryParams('https://x.test/no-query')).toEqual([])
  })

  it('extractParamsFromUrl splits query into rows and keeps the URL clean', () => {
    const { url, params } = extractParamsFromUrl('https://api.test/users?page=2&limit=10')
    expect(url).toBe('https://api.test/users')
    expect(params).toEqual([
      { key: 'page', value: '2', enabled: true },
      { key: 'limit', value: '10', enabled: true }
    ])
  })

  it('extractParamsFromUrl does not inject a scheme into the returned URL', () => {
    // Scheme-less input: rows are extracted, but the returned url stays as
    // typed — the scheme is only applied at send time by buildUrl.
    const { url, params } = extractParamsFromUrl('api.test/x?k=v')
    expect(url).toBe('api.test/x')
    expect(params).toEqual([{ key: 'k', value: 'v', enabled: true }])
  })
})

describe('core/cookies parseSetCookie', () => {
  it('parses a fully attributed cookie', () => {
    const c = parseSetCookie('sessionId=abc123; Path=/; Domain=example.com; Max-Age=3600; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly; Secure; SameSite=Lax')
    expect(c.name).toBe('sessionId')
    expect(c.value).toBe('abc123')
    expect(c.path).toBe('/')
    expect(c.domain).toBe('example.com')
    expect(c.maxAge).toBe(3600)
    expect(c.expires).toContain('21 Oct 2026')
    expect(c.httpOnly).toBe(true)
    expect(c.secure).toBe(true)
    expect(c.sameSite).toBe('Lax')
  })

  it('handles plain and malformed cookies without throwing', () => {
    expect(parseSetCookie('plain=value')).toEqual({ name: 'plain', value: 'value' })
    expect(parseSetCookie('noequals')).toEqual({ name: 'noequals', value: '' })
    expect(parseSetCookie('a=1; Max-Age=notanumber').maxAge).toBeUndefined()
  })

  it('parseSetCookies maps over each raw header', () => {
    const cs = parseSetCookies(['a=1; HttpOnly', 'b=2'])
    expect(cs).toHaveLength(2)
    expect(cs[0].httpOnly).toBe(true)
    expect(cs[1]).toEqual({ name: 'b', value: '2' })
  })
})

describe('core/abortSignals mergeAbortSignals', () => {
  it('returns undefined with no signals', () => {
    expect(mergeAbortSignals()).toBeUndefined()
    expect(mergeAbortSignals(undefined, undefined)).toBeUndefined()
  })

  it('returns the single signal as-is', () => {
    const c = new AbortController()
    expect(mergeAbortSignals(c.signal, undefined)).toBe(c.signal)
  })

  it('merged signal aborts when any source aborts', () => {
    const a = new AbortController()
    const b = new AbortController()
    const merged = mergeAbortSignals(a.signal, b.signal)!
    expect(merged.aborted).toBe(false)
    b.abort()
    expect(merged.aborted).toBe(true)
  })
})

describe('core/body serializeBody + isMethodWithBody', () => {
  it('isMethodWithBody: POST/PUT/PATCH only, case-insensitive', () => {
    expect(isMethodWithBody('POST')).toBe(true)
    expect(isMethodWithBody('patch')).toBe(true)
    expect(isMethodWithBody('DELETE')).toBe(false)
    expect(isMethodWithBody('get')).toBe(false)
  })

  it('none mode and empty raw produce undefined', () => {
    expect(serializeBody({ mode: 'none' } as RequestBody)).toBeUndefined()
    expect(serializeBody({ mode: 'raw', rawType: 'json', rawText: '' } as RequestBody)).toBeUndefined()
  })

  it('raw mode passes text through verbatim', () => {
    const body = { mode: 'raw', rawType: 'json', rawText: '{"a":1}' } as RequestBody
    expect(serializeBody(body)).toBe('{"a":1}')
  })

  it('urlencoded skips disabled and keyless rows; empty result → undefined', () => {
    const body = {
      mode: 'urlencoded',
      urlencoded: [
        { key: 'a', value: '1', enabled: true },
        { key: 'b', value: 'x', enabled: false },
        { key: '  ', value: '2', enabled: true },
        { key: 'c', value: 'hi there', enabled: true }
      ]
    } as unknown as RequestBody
    expect(serializeBody(body)).toBe('a=1&c=hi+there')
    expect(serializeBody({ mode: 'urlencoded', urlencoded: [] } as RequestBody)).toBeUndefined()
  })

  it('formdata collects enabled text rows into FormData', () => {
    const body = {
      mode: 'formdata',
      formdata: [
        { key: 'field', kind: 'text', value: 'v', enabled: true },
        { key: 'off', kind: 'text', value: 'x', enabled: false }
      ]
    } as unknown as RequestBody
    const fd = serializeBody(body) as FormData
    expect(fd).toBeInstanceOf(FormData)
    expect(fd.get('field')).toBe('v')
    expect(fd.get('off')).toBeNull()
  })
})
