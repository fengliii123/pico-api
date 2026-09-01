// $ref resolution in OpenAPI import: local pointers under
// components/schemas (OAS3) and definitions (Swagger 2), nested refs,
// requestBodies/parameters refs, external-ref warnings, cycle guard.
import { describe, expect, it } from 'vitest'
import { parseOpenApi } from '@/core/openapi/import'

describe('parseOpenApi $ref resolution', () => {
  it('resolves requestBody schema $ref from components/schemas', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      servers: [{ url: 'https://api.test/v1' }],
      paths: {
        '/users': {
          post: {
            operationId: 'createUser',
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/NewUser' }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          NewUser: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'alice' },
              role: { type: 'string', default: 'member' }
            }
          }
        }
      }
    }
    const res = parseOpenApi(JSON.stringify(doc))
    expect(res.warnings.join(' ')).not.toContain('$ref')
    const req = res.requests[0]
    expect(req.method).toBe('POST')
    expect(req.url).toBe('{{baseUrl}}/users')
    expect(req.body.mode).toBe('raw')
    const body = JSON.parse((req.body as any).rawText)
    expect(body.name).toBe('alice')
    expect(body.role).toBe('member')
  })

  it('resolves whole-parameter and whole-requestBody $refs', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: {
        '/search': {
          get: {
            operationId: 'search',
            parameters: [{ $ref: '#/components/parameters/Limit' }],
            requestBody: { $ref: '#/components/requestBodies/Filter' }
          }
        }
      },
      components: {
        parameters: {
          Limit: { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        },
        requestBodies: {
          Filter: {
            content: {
              'application/x-www-form-urlencoded': {
                schema: { $ref: '#/components/schemas/Filter' }
              }
            }
          }
        },
        schemas: {
          Filter: {
            type: 'object',
            properties: { q: { type: 'string', example: 'hi' } }
          }
        }
      }
    }
    const res = parseOpenApi(JSON.stringify(doc))
    const req = res.requests[0]
    expect(req.params).toEqual([{ key: 'limit', value: '20', enabled: true }])
    expect(req.body.mode).toBe('urlencoded')
    expect((req.body as any).urlencoded).toEqual([{ key: 'q', value: 'hi', enabled: true }])
  })

  it('resolves Swagger 2.0 #/definitions refs after the on-the-fly upgrade', () => {
    const doc = {
      swagger: '2.0',
      info: { title: 't', version: '1' },
      host: 'api.test',
      basePath: '/v2',
      schemes: ['https'],
      paths: {
        '/pets': {
          post: {
            operationId: 'addPet',
            parameters: [{
              in: 'body',
              name: 'body',
              schema: { $ref: '#/definitions/Pet' }
            }]
          }
        }
      },
      definitions: {
        Pet: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'rex' },
            tag: { $ref: '#/definitions/Tag' }
          }
        },
        Tag: { type: 'string', default: 'vip' }
      }
    }
    const res = parseOpenApi(JSON.stringify(doc))
    expect(res.warnings.join(' ')).not.toContain('$ref')
    const body = JSON.parse((res.requests[0].body as any).rawText)
    expect(body.name).toBe('rex')
    expect(body.tag).toBe('vip')
  })

  it('warns once for external $refs and keeps importing', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: {
        '/x': {
          get: {
            operationId: 'getX',
            parameters: [{ $ref: 'other.yaml#/Param' }]
          }
        }
      }
    }
    const res = parseOpenApi(JSON.stringify(doc))
    expect(res.warnings.some(w => w.includes('other.yaml#/Param'))).toBe(true)
    expect(res.requests).toHaveLength(1)
  })

  it('survives cyclic schema refs without hanging', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: {
        '/tree': {
          post: {
            operationId: 'node',
            requestBody: {
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } }
            }
          }
        }
      },
      components: {
        schemas: {
          Node: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'root' },
              child: { $ref: '#/components/schemas/Node' }
            }
          }
        }
      }
    }
    const res = parseOpenApi(JSON.stringify(doc))
    const body = JSON.parse((res.requests[0].body as any).rawText)
    expect(body.name).toBe('root')
    // The cycle resolves down to whatever the depth cap allows — no throw,
    // no hang; the exact depth is an implementation detail.
    expect(res.warnings.some(w => w.includes('Unresolved'))).toBe(false)
  })
})
