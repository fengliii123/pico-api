// Convert a Swagger 2.0 document to an OpenAPI 3.x-ish document that
// our OAS3 importer can chew on. We don't aim for spec-perfect output —
// just enough so the importer's downstream logic sees a uniform shape.
//
// Three things change between Swagger 2 and OAS3 that we care about:
//   1. host/basePath/schemes  →  servers[].url
//   2. parameters[in=body]    →  requestBody.content[application/json]
//   3. parameters[in=formData]→  requestBody.content[multipart/form-data]

import type { OpenApiDocument, Operation, Parameter, RequestBody, MediaType, PathItem } from './types'

export function isSwagger2(doc: any): doc is OpenApiDocument & { swagger: string } {
  return typeof doc?.swagger === 'string' && doc.swagger.startsWith('2.')
}

// Build the OAS3 `servers` equivalent from Swagger 2 `host` + `basePath`
// + `schemes`. We use the first scheme (http or https), defaulting to
// https if missing. If `host` is missing we leave servers empty and the
// importer falls back to bare path strings.
function buildServers(doc: OpenApiDocument): Array<{ url: string }> {
  if (!doc.host) return []
  const scheme = doc.schemes?.[0] ?? 'https'
  const base = doc.basePath && doc.basePath !== '/' ? doc.basePath : ''
  return [{ url: `${scheme}://${doc.host}${base}` }]
}

// Lift `parameters[in=body]` and `parameters[in=formData]` out of the
// parameters list and turn them into an OAS3 `requestBody`. Remaining
// parameters (path/query/header) are returned as-is — the importer's
// downstream logic already reads them by `in` value.
function liftBodyToOperation(op: Operation): Operation {
  if (!op.parameters) return op
  const body = op.parameters.find(p => p.in === 'body')
  const formData = op.parameters.filter(p => p.in === 'formData')

  if (!body && formData.length === 0) return op

  const remaining = op.parameters.filter(p => p.in !== 'body' && p.in !== 'formData')
  const next: Operation = { ...op, parameters: remaining }

  if (body?.schema) {
    const media: MediaType = { schema: body.schema }
    next.requestBody = {
      description: body.description,
      required: body.required,
      content: { 'application/json': media }
    }
  } else if (formData.length > 0) {
    // Build an object schema with one property per formData parameter.
    const properties: Record<string, any> = {}
    const required: string[] = []
    for (const fp of formData) {
      properties[fp.name] = {
        type: fp.type || 'string',
        format: fp.format,
        description: fp.description,
        // formData file uploads use type: 'file'
        ...(fp.type === 'file' ? { format: 'binary' } : {})
      }
      if (fp.required) required.push(fp.name)
    }
    const schema = { type: 'object', properties, ...(required.length > 0 ? { required } : {}) }
    next.requestBody = {
      content: { 'multipart/form-data': { schema } }
    }
  }

  return next
}

export function upgradeSwagger2ToOAS3(doc: OpenApiDocument): OpenApiDocument {
  // 1. servers
  const servers = buildServers(doc)

  // 2. lift body params in every path/method
  const paths: Record<string, PathItem> = {}
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!item) continue
    const nextItem: PathItem = { ...item }
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const) {
      const op = item[method]
      if (op) {
        nextItem[method] = liftBodyToOperation(op)
      }
    }
    paths[path] = nextItem
  }

  // 3. definitions → components.schemas (the importer resolves $refs by
  // looking at components.schemas OR definitions, so this is mostly cosmetic).
  const components = doc.definitions
    ? { schemas: { ...doc.definitions, ...(doc.components?.schemas ?? {}) } }
    : doc.components

  return {
    openapi: '3.0.0',
    info: doc.info ?? { title: 'Imported from Swagger 2.0' },
    servers,
    paths,
    components
  }
}
