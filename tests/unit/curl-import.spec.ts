import { describe, expect, it } from 'vitest'
import { fromCurl, inferBody } from '@/core/curl'
import { classifyFetchError } from '@/core/http'

describe('fromCurl: unknown flag handling', () => {
  it('does not let an unknown flag swallow the URL', () => {
    const { request, warnings } = fromCurl('curl --http1.1 https://api.example.com/x')
    expect(request.url).toBe('https://api.example.com/x')
    expect(warnings.some(w => w.includes('--http1.1'))).toBe(true)
  })

  it('still consumes a plain value after an unknown flag', () => {
    const { request } = fromCurl('curl --connect-timeout 5 https://api.example.com/x')
    expect(request.url).toBe('https://api.example.com/x')
  })
})

describe('fromCurl: -u credentials encoding', () => {
  it('encodes non-Latin1 credentials as UTF-8 base64 instead of throwing', () => {
    const { request } = fromCurl('curl -u "user:密码123" https://api.example.com/x')
    const auth = request.headers.find(h => h.key === 'Authorization')
    expect(auth).toBeDefined()
    // "Basic " + base64(utf8("user:密码123")) — verify round-trips.
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(auth!.value.slice('Basic '.length)), c => c.charCodeAt(0))
    )
    expect(decoded).toBe('user:密码123')
  })
})

describe('inferBody: urlencoded decoding', () => {
  const ct = [{ id: '1', key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true }]

  it('decodes normal percent-encoding into rows', () => {
    const body = inferBody(ct, 'a=1&b=hello%20world', true)
    if (body.mode !== 'urlencoded') throw new Error('expected urlencoded')
    expect(body.urlencoded!.find(r => r.key === 'b')?.value).toBe('hello world')
  })

  it('falls back to the raw token when a bare % makes decoding throw', () => {
    const body = inferBody(ct, 'note=50% off', true)
    if (body.mode !== 'urlencoded') throw new Error('expected urlencoded')
    expect(body.urlencoded!.find(r => r.key === 'note')?.value).toBe('50% off')
  })
})

describe('classifyFetchError: privileged vs direct fetch', () => {
  const err = { name: 'TypeError', message: 'Failed to fetch' }

  it('direct fetch on a public host classifies as CORS', () => {
    const r = classifyFetchError(err, 'https://api.example.com/x')
    expect(r.kind).toBe('cors')
  })

  it('privileged (service worker) fetch never classifies as CORS', () => {
    const r = classifyFetchError(err, 'https://api.example.com/x', { privileged: true })
    expect(r.kind).toBe('connect')
    expect(r.message).not.toMatch(/CORS/i)
  })

  it('localhost failures stay connectivity hints in both modes', () => {
    for (const privileged of [false, true]) {
      const r = classifyFetchError(err, 'http://localhost:3000/x', { privileged })
      expect(r.kind).toBe('connect')
      expect(r.message).toContain('localhost')
    }
  })

  it('keeps the richer classifications for non-generic messages', () => {
    expect(classifyFetchError({ message: 'dns ENOTFOUND api.example.com' }, 'https://api.example.com').kind).toBe('dns')
    expect(classifyFetchError({ message: 'ssl handshake failed' }, 'https://api.example.com').kind).toBe('tls')
    expect(classifyFetchError({ message: 'network timeout reached' }, 'https://api.example.com').kind).toBe('timeout')
    expect(classifyFetchError({ name: 'AbortError', message: 'aborted' }, 'https://api.example.com').kind).toBe('aborted')
  })
})
