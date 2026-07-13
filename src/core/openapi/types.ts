// Minimal OpenAPI 3.x / Swagger 2.0 type fragments.
//
// We don't model the full spec — only the fields we need to round-trip
// our DraftRequest. Anything we don't read is left alone by `JSON.parse`
// and dropped by `export.ts` (which builds a fresh document from scratch).
//
// Field names follow the spec verbatim so users reading the source can
// grep against e.g. https://swagger.io/specification/.


export type ParameterIn = 'query' | 'header' | 'path' | 'cookie' // OAS3
                       | 'body' | 'formData'                      // Swagger 2.0 only

export interface Parameter {
  name: string
  in: ParameterIn
  description?: string
  required?: boolean
  deprecated?: boolean
  // OAS3: schema + example. Swagger 2: schema for body, type for query/header.
  schema?: Schema
  example?: unknown
  // Swagger 2.0 inline fields (used when in !== 'body'):
  type?: string
  format?: string
  default?: unknown
  enum?: unknown[]
}

export interface Schema {
  type?: string
  format?: string
  // Object schema fields
  properties?: Record<string, Schema>
  required?: string[]
  // Array schema fields
  items?: Schema
  // Reference (we keep $ref as a string — callers resolve if they want)
  $ref?: string
  // Example value (used by importer to seed raw body text)
  example?: unknown
  description?: string
  enum?: unknown[]
  default?: unknown
  // Free-form passthrough so we don't lose fields we don't model
  [key: string]: unknown
}

export interface MediaType {
  schema?: Schema
  example?: unknown
  examples?: Record<string, { value: unknown }>
}

export interface RequestBody {
  description?: string
  required?: boolean
  content?: Record<string, MediaType>
}

export interface Responses {
  [statusCode: string]: {
    description?: string
    content?: Record<string, MediaType>
  }
}

export interface Operation {
  tags?: string[]
  summary?: string
  description?: string
  operationId?: string
  deprecated?: boolean
  parameters?: Parameter[]
  requestBody?: RequestBody      // OAS3 only
  responses?: Responses
  // Swagger 2.0 puts body & formData in parameters[] — we lift them
  // during normalisation in swagger2.ts.
}

export interface PathItem {
  // PathItem can be a $ref OR an object with method keys. We treat as
  // the latter and ignore $ref (rare in practice).
  summary?: string
  description?: string
  parameters?: Parameter[]   // shared across all methods in this path
  get?: Operation
  post?: Operation
  put?: Operation
  patch?: Operation
  delete?: Operation
  head?: Operation
  options?: Operation
}

export interface Info {
  title: string
  version?: string
  description?: string
}

// Subset of OpenAPI 3.x Document. Anything we don't read gets discarded
// by export.ts (which generates fresh).
export interface OpenApiDocument {
  // OAS3 marker
  openapi?: string
  // Swagger 2.0 marker
  swagger?: string
  info?: Info
  // OAS3 only; Swagger 2 has host/basePath/schemes instead.
  servers?: Array<{ url: string; description?: string }>
  // Swagger 2.0 fallbacks:
  host?: string
  basePath?: string
  schemes?: string[]
  paths: Record<string, PathItem>
  components?: { schemas?: Record<string, Schema> }
  // Swagger 2.0 equivalent of components.schemas
  definitions?: Record<string, Schema>
}

// HTTP methods we look at in a PathItem. Order here controls tree order
// in the imported collection.
export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const
export type HttpMethodKey = typeof HTTP_METHODS[number]
