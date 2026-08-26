import { describe, expect, it } from 'vitest'
import { joinParamsToUrl, urlWithParams } from '@/core/url'
import { draftToCurl } from '@/core/curl'
import { defaultRequestSettings } from '@/core/defaults'
import type { DraftRequest, EnvironmentVariable } from '@/core/types'

describe('joinParamsToUrl: placeholder handling', () => {
  const rows = [
    { id: '1', key: 't', value: '{{ts}}', enabled: true },
    { id: '2', key: 'q', value: 'hello world', enabled: true }
  ]

  it('keeps {{var}} placeholders readable in the URL bar', () => {
    expect(joinParamsToUrl('https://api.test/x', rows)).toBe(
      'https://api.test/x?t={{ts}}&q=hello%20world'
    )
  })

  it('still encodes non-placeholder values', () => {
    expect(joinParamsToUrl('https://api.test', rows)).toContain('q=hello%20world')
  })

  it('urlWithParams leaves placeholders intact end-to-end', () => {
    expect(urlWithParams('https://api.test/x', rows)).toBe('https://api.test/x?t={{ts}}&q=hello%20world')
  })
})

describe('draftToCurl: environment variable resolution', () => {
  const draft: DraftRequest = {
    id: 'd1',
    folderId: null,
    name: 'req',
    method: 'GET',
    url: '{{baseUrl}}/users',
    headers: [{ id: 'h1', key: '', value: '', enabled: true }],
    params: [{ id: 'p1', key: 'limit', value: '10', enabled: true }],
    body: { mode: 'none' },
    auth: { type: 'none' },
    scripts: { preRequest: '', postResponse: '' },
    settings: defaultRequestSettings()
  }
  const env: EnvironmentVariable[] = [{ key: 'baseUrl', value: 'https://api.example.com', enabled: true }]

  it('exports the resolved URL, not the raw {{var}} placeholder', () => {
    const cmd = draftToCurl(draft, env, [])
    expect(cmd).toContain('https://api.example.com/users')
    expect(cmd).not.toContain('{{baseUrl}}')
  })
})
