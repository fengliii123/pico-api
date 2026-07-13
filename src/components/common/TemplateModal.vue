<script setup lang="ts">
// Request Templates Modal:
// - Pre-built templates for common API patterns
// - OAuth 2.0 flow, GraphQL query, Webhook receiver, etc.
// - One-click create request from template

import { ref, computed } from 'vue'
import { Modal, Button, Tabs, message } from 'ant-design-vue'
import { ApiOutlined, LockOutlined, ThunderboltOutlined, RocketOutlined, CloudOutlined, KeyOutlined } from '@ant-design/icons-vue'
import { useRequestStore } from '@/stores/request'
import { useResponseStore } from '@/stores/response'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const reqStore = useRequestStore()
const resStore = useResponseStore()

interface Template {
  id: string
  name: string
  description: string
  icon: any
  method: string
  url: string
  headers: Array<{ key: string; value: string; enabled: boolean }>
  body?: {
    mode: 'raw' | 'none' | 'formdata'
    rawType?: 'json'
    rawText?: string
    formdata?: Array<{ key: string; kind: 'text' | 'file'; enabled: boolean; value?: string }>
  }
}

const templates: Template[] = [
  // OAuth 2.0
  {
    id: 'oauth-token',
    name: 'OAuth 2.0 Token Request',
    description: 'Request an access token using client credentials',
    icon: LockOutlined,
    method: 'POST',
    url: 'https://{{auth_host}}/oauth/token',
    headers: [
      { key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true },
      { key: 'Authorization', value: 'Basic {{client_credentials}}', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: 'grant_type=client_credentials&scope={{scopes}}'
    }
  },
  {
    id: 'oauth-refresh',
    name: 'OAuth 2.0 Refresh Token',
    description: 'Refresh an expired access token',
    icon: LockOutlined,
    method: 'POST',
    url: 'https://{{auth_host}}/oauth/token',
    headers: [
      { key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: 'grant_type=refresh_token&refresh_token={{refresh_token}}&client_id={{client_id}}'
    }
  },

  // GraphQL
  {
    id: 'graphql-query',
    name: 'GraphQL Query',
    description: 'Execute a GraphQL query',
    icon: ThunderboltOutlined,
    method: 'POST',
    url: 'https://{{api_host}}/graphql',
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true },
      { key: 'Authorization', value: 'Bearer {{access_token}}', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: JSON.stringify({
        query: `query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
  }
}`,
        variables: { id: '1' }
      }, null, 2)
    }
  },
  {
    id: 'graphql-mutation',
    name: 'GraphQL Mutation',
    description: 'Execute a GraphQL mutation',
    icon: ThunderboltOutlined,
    method: 'POST',
    url: 'https://{{api_host}}/graphql',
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true },
      { key: 'Authorization', value: 'Bearer {{access_token}}', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: JSON.stringify({
        query: `mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    name
    email
  }
}`,
        variables: {
          input: {
            name: 'New User',
            email: 'user@example.com'
          }
        }
      }, null, 2)
    }
  },
  {
    id: 'graphql-introspection',
    name: 'GraphQL Introspection',
    description: 'Fetch schema introspection',
    icon: ThunderboltOutlined,
    method: 'POST',
    url: 'https://{{api_host}}/graphql',
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: JSON.stringify({
        query: `{ __schema { types { name kind description } } }`
      }, null, 2)
    }
  },

  // REST API
  {
    id: 'rest-crud-get',
    name: 'REST GET Resource',
    description: 'Fetch a single resource by ID',
    icon: ApiOutlined,
    method: 'GET',
    url: 'https://{{api_host}}/api/{{resource}}/{{id}}',
    headers: [
      { key: 'Authorization', value: 'Bearer {{access_token}}', enabled: true },
      { key: 'Accept', value: 'application/json', enabled: true }
    ]
  },
  {
    id: 'rest-crud-list',
    name: 'REST GET List',
    description: 'Fetch paginated list of resources',
    icon: ApiOutlined,
    method: 'GET',
    url: 'https://{{api_host}}/api/{{resource}}?page={{page}}&limit={{limit}}',
    headers: [
      { key: 'Authorization', value: 'Bearer {{access_token}}', enabled: true },
      { key: 'Accept', value: 'application/json', enabled: true }
    ]
  },
  {
    id: 'rest-crud-create',
    name: 'REST POST Create',
    description: 'Create a new resource',
    icon: ApiOutlined,
    method: 'POST',
    url: 'https://{{api_host}}/api/{{resource}}',
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true },
      { key: 'Authorization', value: 'Bearer {{access_token}}', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: JSON.stringify({
        name: 'New Item',
        description: 'Item description'
      }, null, 2)
    }
  },
  {
    id: 'rest-crud-update',
    name: 'REST PUT Update',
    description: 'Full update of a resource',
    icon: ApiOutlined,
    method: 'PUT',
    url: 'https://{{api_host}}/api/{{resource}}/{{id}}',
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true },
      { key: 'Authorization', value: 'Bearer {{access_token}}', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: JSON.stringify({
        id: '{{id}}',
        name: 'Updated Item',
        description: 'Updated description'
      }, null, 2)
    }
  },
  {
    id: 'rest-crud-delete',
    name: 'REST DELETE',
    description: 'Delete a resource',
    icon: ApiOutlined,
    method: 'DELETE',
    url: 'https://{{api_host}}/api/{{resource}}/{{id}}',
    headers: [
      { key: 'Authorization', value: 'Bearer {{access_token}}', enabled: true }
    ]
  },

  // Webhook
  {
    id: 'webhook-github-pr',
    name: 'GitHub Webhook (PR)',
    description: 'Verify GitHub pull request webhook',
    icon: RocketOutlined,
    method: 'POST',
    url: 'https://your-webhook-endpoint.com/github/pr',
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true },
      { key: 'X-GitHub-Event', value: 'pull_request', enabled: true },
      { key: 'X-GitHub-Delivery', value: '{{uuid}}', enabled: true },
      { key: 'X-Hub-Signature-256', value: 'sha256={{signature}}', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: JSON.stringify({
        action: 'opened',
        pull_request: {
          id: 12345678,
          number: 42,
          title: 'Add new feature',
          user: { login: 'username' }
        }
      }, null, 2)
    }
  },
  {
    id: 'webhook-stripe',
    name: 'Stripe Webhook',
    description: 'Handle Stripe payment events',
    icon: RocketOutlined,
    method: 'POST',
    url: 'https://your-webhook-endpoint.com/stripe/webhook',
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true },
      { key: 'Stripe-Signature', value: '{{stripe_signature}}', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: JSON.stringify({
        id: 'evt_test_webhook',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            amount: 2000,
            currency: 'usd'
          }
        }
      }, null, 2)
    }
  },

  // Authentication
  {
    id: 'auth-login',
    name: 'Login / Authenticate',
    description: 'Authenticate user with credentials',
    icon: KeyOutlined,
    method: 'POST',
    url: 'https://{{api_host}}/auth/login',
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: JSON.stringify({
        email: 'user@example.com',
        password: 'password123'
      }, null, 2)
    }
  },
  {
    id: 'auth-logout',
    name: 'Logout',
    description: 'Invalidate session or token',
    icon: KeyOutlined,
    method: 'POST',
    url: 'https://{{api_host}}/auth/logout',
    headers: [
      { key: 'Authorization', value: 'Bearer {{access_token}}', enabled: true }
    ]
  },
  {
    id: 'auth-register',
    name: 'Register / Sign Up',
    description: 'Create a new user account',
    icon: KeyOutlined,
    method: 'POST',
    url: 'https://{{api_host}}/auth/register',
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true }
    ],
    body: {
      mode: 'raw',
      rawType: 'json',
      rawText: JSON.stringify({
        name: 'New User',
        email: 'user@example.com',
        password: 'securePassword123'
      }, null, 2)
    }
  },

  // File Upload
  {
    id: 'upload-formdata',
    name: 'File Upload (multipart/form-data)',
    description: 'Upload a file using form data',
    icon: CloudOutlined,
    method: 'POST',
    url: 'https://{{api_host}}/upload',
    headers: [
      { key: 'Authorization', value: 'Bearer {{access_token}}', enabled: true }
    ],
    body: {
      mode: 'formdata' as const,
      formdata: [
        { key: 'file', kind: 'file' as const, enabled: true },
        { key: 'description', kind: 'text' as const, value: 'File description', enabled: true }
      ]
    }
  },

  // Health Check
  {
    id: 'health-check',
    name: 'Health Check',
    description: 'Check API service health',
    icon: CloudOutlined,
    method: 'GET',
    url: 'https://{{api_host}}/health',
    headers: []
  },
  {
    id: 'health-ready',
    name: 'Readiness Probe',
    description: 'Check if service is ready to accept traffic',
    icon: CloudOutlined,
    method: 'GET',
    url: 'https://{{api_host}}/ready',
    headers: []
  }
]

// Categorize templates
const categories = computed(() => {
  const cats: Record<string, Template[]> = {
    'OAuth 2.0': templates.filter(t => t.id.startsWith('oauth')),
    'GraphQL': templates.filter(t => t.id.startsWith('graphql')),
    'REST API': templates.filter(t => t.id.startsWith('rest')),
    'Webhook': templates.filter(t => t.id.startsWith('webhook')),
    'Authentication': templates.filter(t => t.id.startsWith('auth')),
    'File Upload': templates.filter(t => t.id.startsWith('upload')),
    'Health Check': templates.filter(t => t.id.startsWith('health'))
  }
  return cats
})

const activeCategory = ref('REST API')

function useTemplate(template: Template) {
  reqStore.newRequest(null)
  reqStore.setName(template.name)
  reqStore.setMethod(template.method as any)
  reqStore.setUrl(template.url)
  reqStore.setHeaders(template.headers)

  if (template.body) {
    reqStore.setBody(template.body as any)
  } else {
    reqStore.setBody({ mode: 'none' })
  }

  resStore.setActive(null)
  message.success(`Created "${template.name}" template`)
  emit('update:open', false)
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <Modal
    :open="open"
    title="Request Templates"
    width="800px"
    :footer="null"
    @cancel="close"
  >
    <div class="templates-modal">
      <div class="template-sidebar">
        <div
          v-for="(items, category) in categories"
          :key="category"
          class="category-item"
          :class="{ active: activeCategory === category }"
          @click="activeCategory = category"
        >
          {{ category }}
          <span class="category-count">{{ items.length }}</span>
        </div>
      </div>

      <div class="template-list">
        <div
          v-for="template in categories[activeCategory]"
          :key="template.id"
          class="template-card"
          @click="useTemplate(template)"
        >
          <div class="template-header">
            <component :is="template.icon" class="template-icon" />
            <span class="template-name">{{ template.name }}</span>
          </div>
          <p class="template-description">{{ template.description }}</p>
          <div class="template-meta">
            <span class="template-method" :class="`method-${template.method.toLowerCase()}`">
              {{ template.method }}
            </span>
            <span class="template-url-preview">
              {{ template.url.split('/')[2] || template.url }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.templates-modal {
  display: flex;
  gap: 16px;
  min-height: 400px;
  max-height: 70vh;
}

.template-sidebar {
  width: 160px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-base);
  padding-right: 12px;
}

.category-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.category-item:hover {
  background: var(--bg-muted);
  color: var(--text-primary);
}

.category-item.active {
  background: var(--accent-soft-bg);
  color: var(--accent);
  font-weight: 500;
}

.category-count {
  font-size: 11px;
  background: var(--bg-muted);
  padding: 2px 6px;
  border-radius: 10px;
}

.template-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 4px;
}

.template-card {
  padding: 12px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.template-card:hover {
  border-color: var(--accent);
  background: var(--accent-soft-bg);
}

.template-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.template-icon {
  font-size: 16px;
  color: var(--accent);
}

.template-name {
  font-weight: 500;
  font-size: 13px;
  color: var(--text-primary);
}

.template-description {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 8px;
  line-height: 1.4;
}

.template-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.template-method {
  font-weight: 600;
  font-family: 'SF Mono', Menlo, monospace;
  padding: 2px 6px;
  border-radius: 3px;
}

.method-get { color: #52c41a; background: rgba(82, 196, 26, 0.1); }
.method-post { color: #fa8c16; background: rgba(250, 140, 22, 0.1); }
.method-put { color: #1890ff; background: rgba(24, 144, 255, 0.1); }
.method-patch { color: #722ed1; background: rgba(114, 46, 209, 0.1); }
.method-delete { color: #f5222d; background: rgba(245, 34, 45, 0.1); }

.template-url-preview {
  color: var(--text-tertiary);
  font-family: 'SF Mono', monospace;
}
</style>
