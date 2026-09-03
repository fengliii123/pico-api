// pm.response.to.* / pm.expect().to.* assertion coverage: every assertion
// must pass on matching input and record a failed test with a readable
// error message on mismatch (that's what the Tests tab shows the user).
import { describe, expect, it } from 'vitest'
import { createPmApi, runScriptDirect } from '@/core/scripts/vm'
import type { ResponseResult } from '@/core/types'

function response(overrides: Partial<ResponseResult> = {}): ResponseResult {
  return {
    status: 200,
    statusText: 'OK',
    headers: [['Content-Type', 'application/json'], ['X-Trace-Id', 'abc123']],
    body: { blob: new Blob(['{}']), text: '{"users":["a","b"],"total":2}', size: 27 },
    time: 120,
    mime: 'application/json',
    ...overrides
  }
}

function makePm(res: ResponseResult | null) {
  return createPmApi('https://x.test/', 'GET', {}, undefined, res, [], [])
}

async function run(code: string, res: ResponseResult | null = response()) {
  const pm = makePm(res)
  await runScriptDirect(code, pm)
  return pm._tests
}

describe('pm.response.to assertions', () => {
  it('have.status / header existence / header value', async () => {
    const tests = await run(`pm.test('ok', () => {
      pm.response.to.have.status(200)
      pm.response.to.have.header('content-type')
      pm.response.to.have.header('X-Trace-Id', 'abc123')
      pm.response.to.have.body('"total":2')
    })`)
    expect(tests).toEqual([{ name: 'ok', passed: true }])
  })

  it('have.body() without args asserts non-empty body', async () => {
    const tests = await run(`pm.test('non-empty', () => pm.response.to.have.body())`)
    expect(tests[0].passed).toBe(true)
    const empty = await run(`pm.test('e', () => pm.response.to.have.body())`, response({ body: { blob: new Blob(['']), text: '', size: 0 } }))
    expect(empty[0].passed).toBe(false)
  })

  it('status-class getters: ok / created / serverError', async () => {
    const tests = await run(`pm.test('s', () => { pm.response.to.be.ok })`)
    expect(tests[0].passed).toBe(true)

    const created = await run(`pm.test('c', () => { pm.response.to.be.created })`, response({ status: 201, statusText: 'Created' }))
    expect(created[0].passed).toBe(true)

    const err = await run(`pm.test('e', () => { pm.response.to.be.serverError })`, response({ status: 502, statusText: 'Bad Gateway' }))
    expect(err[0].passed).toBe(true)

    const notOk = await run(`pm.test('n', () => { pm.response.to.be.ok })`, response({ status: 404, statusText: 'Not Found' }))
    expect(notOk[0].passed).toBe(false)
    expect(notOk[0].error).toContain('404')
  })

  it('header miss reports the header name', async () => {
    const tests = await run(`pm.test('h', () => pm.response.to.have.header('Authorization'))`)
    expect(tests[0].passed).toBe(false)
    expect(tests[0].error).toContain('Authorization')
  })
})

describe('pm.expect assertions', () => {
  it('eql (deep), equal (strict), include, a/an', async () => {
    const tests = await run(`const data = pm.response.json(); pm.test('x', () => {
      pm.expect(data).to.eql({ users: ['a', 'b'], total: 2 })
      pm.expect(data.total).to.equal(2)
      pm.expect(data.users).to.include('b')
      pm.expect(data.users).to.be.an('array')
      pm.expect(data.total).to.be.a('number')
    })`)
    expect(tests[0]).toEqual({ name: 'x', passed: true })
  })

  it('eql fails on structural mismatch', async () => {
    const tests = await run(`const data = pm.response.json(); pm.test('x', () => pm.expect(data).to.eql({ users: ['a'], total: 2 }))`)
    expect(tests[0].passed).toBe(false)
    expect(tests[0].error).toContain('deeply equal')
  })

  it('empty / ok / defined / null / true getters', async () => {
    const tests = await run(`pm.test('g', () => {
      pm.expect('').to.be.empty
      pm.expect([]).to.be.empty
      pm.expect({}).to.be.empty
      pm.expect(1).to.be.ok
      pm.expect('x').to.be.defined
      pm.expect(null).to.be.null
      pm.expect(true).to.be.true
      pm.expect(false).to.be.false
    })`)
    expect(tests[0].passed).toBe(true)

    const fail = await run(`pm.test('f', () => pm.expect([1]).to.be.empty)`)
    expect(fail[0].passed).toBe(false)
    expect(fail[0].error).toContain('length')
  })

  it('empty fails on non-emptiable values (numbers / booleans), matching chai', async () => {
    const num = await run(`pm.test('n', () => pm.expect(1).to.be.empty)`)
    expect(num[0].passed).toBe(false)
    expect(num[0].error).toContain('to be empty')

    const bool = await run(`pm.test('b', () => pm.expect(true).to.be.empty)`)
    expect(bool[0].passed).toBe(false)
  })

  it('include works on strings and object keys', async () => {
    const tests = await run(`const data = pm.response.json(); pm.test('i', () => {
      pm.expect(pm.response.text()).to.include('users')
      pm.expect(data).to.include('total')
    })`)
    expect(tests[0].passed).toBe(true)
  })
})
