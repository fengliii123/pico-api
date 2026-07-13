// Smoke tests for core modules. Run with: node --experimental-strip-types scripts/smoke.mts
import { classify } from '../src/core/mime.ts'
import { buildUrl, extractParamsFromUrl, joinParamsToUrl } from '../src/core/url.ts'
import { processHeaders, BANNED_HEADERS } from '../src/core/headers.ts'
import { serializeBody, isMethodWithBody } from '../src/core/body.ts'

let failures = 0
function ok(name, cond) {
  if (cond) {
    console.log('  ok  ', name)
  } else {
    console.error('  FAIL', name)
    failures++
  }
}

console.log('mime.classify')
ok('empty mime + text body -> text', classify('', 'hello world') === 'text')
ok('empty mime + binary body -> binary', classify('', '\u0000\u0001\u0002') === 'binary')
ok('application/json -> json', classify('application/json') === 'json')
ok('text/html -> html', classify('text/html; charset=utf-8') === 'html')
ok('application/xml -> xml', classify('application/xml') === 'xml')
ok('image/png -> image', classify('image/png') === 'image')
ok('application/pdf -> pdf', classify('application/pdf') === 'pdf')
ok('octet-stream + text -> text', classify('application/octet-stream', 'plain text') === 'text')
ok('octet-stream + binary -> binary', classify('application/octet-stream', '\u0000') === 'binary')
ok('null mime + empty body -> binary', classify(null, '') === 'binary')

// buildUrl is a pass-through: the URL string is authoritative on the wire, so
// it just normalizes the scheme and preserves the query verbatim. The Params
// tab <-> URL query sync happens in the request store (see below).
console.log('url.buildUrl (pass-through)')
ok('empty url -> empty', buildUrl('', []) === '')
ok('plain url preserved', buildUrl('https://api.example.com/v1', []) === 'https://api.example.com/v1')
ok('scheme-less url gets https', buildUrl('api.example.com/foo', []) === 'https://api.example.com/foo')
ok('existing query preserved verbatim', buildUrl('https://x.test/v1?a=1', []) === 'https://x.test/v1?a=1')

// The request store keeps the URL authoritative: editing the Params tab strips
// the URL's query and rebuilds it from the enabled rows. These two helpers are
// that round-trip — so add / edit / disable in the Params tab all reach the wire.
console.log('url Params-tab <-> query sync')
const syncBack = (url, rows) => joinParamsToUrl(extractParamsFromUrl(url).url, rows)
ok('enabled param written into query', syncBack('https://x.test/v1', [{ key: 'b', value: '2', enabled: true }]) === 'https://x.test/v1?b=2')
ok('disabled param removed from query', syncBack('https://x.test/v1?b=2', [{ key: 'b', value: '2', enabled: false }]) === 'https://x.test/v1')
ok('edited param value replaces the old query', syncBack('https://x.test/v1?a=1', [{ key: 'a', value: '9', enabled: true }]) === 'https://x.test/v1?a=9')
ok('existing + new params merged', syncBack('https://x.test/v1?a=1', [{ key: 'a', value: '1', enabled: true }, { key: 'b', value: '2', enabled: true }]) === 'https://x.test/v1?a=1&b=2')

console.log('headers.processHeaders')
const { headers, dropped } = processHeaders(
  [
    { key: 'X-Foo', value: 'bar', enabled: true },
    { key: 'Cookie', value: 'session=abc', enabled: true },
    { key: 'X-Disabled', value: 'skip', enabled: false },
    { key: '', value: 'x', enabled: true },
    { key: 'X-Empty', value: '', enabled: true }
  ],
  { mode: 'none' }
)
ok('X-Foo passes', headers['X-Foo'] === 'bar')
ok('Cookie banned', dropped.some(d => d.key === 'Cookie'))
ok('disabled skipped', !('X-Disabled' in headers))
ok('only one header left', Object.keys(headers).length === 1)
ok('empty value skipped', !('X-Empty' in headers))

console.log('headers BANNED_HEADERS')
ok('cookie banned', BANNED_HEADERS.has('cookie'))
ok('host banned', BANNED_HEADERS.has('host'))
ok('content-type NOT banned', !BANNED_HEADERS.has('content-type'))

console.log('body.serializeBody')
ok('none -> undefined', serializeBody({ mode: 'none' }) === undefined)
ok('raw empty -> undefined', serializeBody({ mode: 'raw', rawText: '' }) === undefined)
ok('raw text passed', serializeBody({ mode: 'raw', rawText: '{"a":1}' }) === '{"a":1}')
ok('urlencoded serialized', serializeBody({
  mode: 'urlencoded',
  urlencoded: [
    { key: 'a', value: '1', enabled: true },
    { key: 'b', value: '2', enabled: false }
  ]
}) === 'a=1')
ok('urlencoded all empty -> undefined', serializeBody({
  mode: 'urlencoded',
  urlencoded: []
}) === undefined)

ok('formdata text only -> FormData', (() => {
  const fd = serializeBody({
    mode: 'formdata',
    formdata: [
      { key: 'name', kind: 'text', enabled: true, value: 'alice' },
      { key: 'age', kind: 'text', enabled: true, value: '30' }
    ]
  })
  return fd instanceof FormData && fd.get('name') === 'alice' && fd.get('age') === '30'
})())
ok('formdata disabled row skipped', (() => {
  const fd = serializeBody({
    mode: 'formdata',
    formdata: [
      { key: 'a', kind: 'text', enabled: true, value: '1' },
      { key: 'b', kind: 'text', enabled: false, value: '2' }
    ]
  })
  return fd instanceof FormData && fd.has('a') && !fd.has('b')
})())
ok('formdata empty key skipped', (() => {
  const fd = serializeBody({
    mode: 'formdata',
    formdata: [
      { key: '', kind: 'text', enabled: true, value: 'x' }
    ]
  })
  return fd === undefined
})())
ok('formdata all empty -> undefined', serializeBody({
  mode: 'formdata',
  formdata: []
}) === undefined)

console.log('body.isMethodWithBody')
ok('POST has body', isMethodWithBody('POST'))
ok('GET no body', !isMethodWithBody('GET'))
ok('DELETE no body', !isMethodWithBody('DELETE'))
ok('PATCH has body', isMethodWithBody('PATCH'))

console.log('headers.formdata content-type strip')
ok('user Content-Type stripped for formdata', (() => {
  const { headers, dropped } = processHeaders(
    [{ key: 'Content-Type', value: 'multipart/form-data', enabled: true }],
    { mode: 'formdata', formdata: [] }
  )
  return !('Content-Type' in headers) && dropped.some(d => d.reason.includes('multipart'))
})())
ok('user X-Custom kept for formdata', (() => {
  const { headers } = processHeaders(
    [{ key: 'X-Custom', value: 'yes', enabled: true }],
    { mode: 'formdata', formdata: [] }
  )
  return headers['X-Custom'] === 'yes'
})())

console.log('')
if (failures > 0) {
  console.error(`FAILED: ${failures} test(s)`)
  process.exit(1)
} else {
  console.log('All tests passed.')
}