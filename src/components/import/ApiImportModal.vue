<script setup lang="ts">
// Import modal — supports two formats via a Segmented switch:
//   - cURL: paste one `curl …` command, creates a single request.
//   - OpenAPI / Swagger: paste a JSON spec, creates one request per
//     operation, grouped into folders by `tags`.
//
// Conflict policy on OpenAPI import: skip operations whose
// (method, pathname) already exists in the collection. Show counts in
// the preview pane so the user knows what will land.

import { computed, ref, watch } from 'vue'
import { Modal, Input, Button, Alert, Segmented, message, Tag, Upload } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { useCollectionStore } from '@/stores/collection'
import { useRequestStore } from '@/stores/request'
import { useEnvironmentStore } from '@/stores/environment'
import { fromCurl } from '@/core/curl'
import { parseOpenApi } from '@/core/openapi/import'
import FolderPicker from '@/components/tree/FolderPicker.vue'
import type { DraftRequest, HttpMethod, SavedRequest } from '@/core/types'
import { useI18n } from '@/i18n/useI18n'
import { fmt } from '@/i18n'
import { MAX_DEPTH } from '@/stores/collection'

type Mode = 'curl' | 'openapi'

const { t } = useI18n()
const open = defineModel<boolean>('open', { default: false })

const collStore = useCollectionStore()
const reqStore = useRequestStore()

const mode = ref<Mode>('curl')
const text = ref('')
const error = ref('')
const warnings = ref<string[]>([])
const destinationFolder = ref<string | null>(null)
const folderPickerOpen = ref(false)

// Reset on open so the user starts fresh each time.
watch(open, v => {
  if (v) {
    mode.value = 'curl'
    text.value = ''
    error.value = ''
    warnings.value = []
    destinationFolder.value = null
  }
})

const destinationLabel = computed(() => {
  if (!destinationFolder.value) return t.value.unfiledRoot
  const f = collStore.foldersById.get(destinationFolder.value)
  return f ? f.name : t.value.unfiledRoot
})


async function importCurl() {
  const result = fromCurl(text.value)
  warnings.value = result.warnings
  const draft = result.request
  const created = await collStore.createRequest(destinationFolder.value, {
    name: draft.name,
    method: draft.method,
    url: draft.url,
    headers: draft.headers,
    params: draft.params,
    body: draft.body
  })
  reqStore.loadFromSaved(created)
  message.success(t.value.imported)
  open.value = false
}


// Seed the {{baseUrl}} variable for the user so newly-imported URLs
// (which use the {{baseUrl}} placeholder) actually resolve when sent.
// Strategy:
//   - Use the active environment if there is one.
//   - Otherwise create a new environment named after the API + " env"
//     and auto-activate it.
//   - Add or overwrite the `baseUrl` variable. We overwrite (rather
//     than skip) so re-importing the same spec refreshes the URL if
//     the API host changes.
//
// This runs synchronously after the user clicks Import — so by the
// time they click Send on the first imported request, the variable
// is in place. (We use the environment store directly rather than
// re-routing through loadFromSaved.)
async function seedBaseUrlIntoEnvironment(value: string) {
  const envStore = useEnvironmentStore()
  let envId = envStore.activeEnvironmentId

  if (!envId) {
    // Auto-create a generic env so the user can immediately edit it.
    // createEnvironment() also activates it (Postman parity).
    const e = await envStore.createEnvironment(`Imported API ${new Date().toISOString().slice(0, 10)}`)
    e.variables = [{ key: 'baseUrl', value, enabled: true }]
    await envStore.updateEnvironmentVariables(e.id, e.variables)
    return
  }

  // Active env exists — add or refresh `baseUrl`.
  const env = envStore.environmentsById.get(envId)
  if (!env) return
  const idx = env.variables.findIndex(v => v.key === 'baseUrl')
  if (idx >= 0) {
    env.variables[idx]!.value = value
  } else {
    env.variables.push({ key: 'baseUrl', value, enabled: true })
  }
  await envStore.updateEnvironmentVariables(envId, env.variables)
}

// Live preview — re-parses as the user types so the count + conflict
// summary stays in sync. Failures land in `error` instead of throwing.
const openApiPreview = computed(() => {
  if (mode.value !== 'openapi') return null
  if (!text.value.trim()) return null
  try {
    const result = parseOpenApi(text.value)
    error.value = ''
    warnings.value = result.warnings
    return result
  } catch (e: any) {
    error.value = e?.message ?? 'Could not parse'
    return null
  }
})

// Build the existing (method, pathname) set once per import so we can
// dedup without scanning the collection for every operation.
function existingKeySet(): Set<string> {
  const s = new Set<string>()
  for (const r of collStore.requestList) {
    s.add(`${r.method.toUpperCase()}|${pathnameOf(r.url)}`)
  }
  return s
}

function pathnameOf(url: string): string {
  try {
    const u = new URL(url, 'http://placeholder')
    return u.pathname
  } catch {
    // Strip query string if URL() fails
    const i = url.indexOf('?')
    return (i >= 0 ? url.slice(0, i) : url).replace(/^https?:\/\/[^/]+/, '')
  }
}

const tagCounts = computed(() => {
  const p = openApiPreview.value
  if (!p) return []
  const m = new Map<string, number>()
  for (const op of p.operations) {
    const tag = op.tag || '(untagged)'
    m.set(tag, (m.get(tag) ?? 0) + 1)
  }
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
})

const conflictCount = computed(() => {
  const p = openApiPreview.value
  if (!p) return 0
  const existing = existingKeySet()
  let n = 0
  for (const op of p.operations) {
    const key = `${op.request.method.toUpperCase()}|${pathnameOf(op.request.url)}`
    if (existing.has(key)) n++
  }
  return n
})

const willImportCount = computed(() => {
  const p = openApiPreview.value
  if (!p) return 0
  return p.operations.length - conflictCount.value
})

async function importOpenApi() {
  const p = openApiPreview.value
  if (!p) {
    error.value = 'Nothing to import'
    return
  }

  // Seed `baseUrl` into the active environment (or create one) so the
  // {{baseUrl}} placeholders we just baked into every URL can resolve.
  // Without this, the user has to manually set the variable — and the
  // previous bug was exactly that people didn't notice the URL was
  // a literal server host.
  if (p.baseUrlValue) {
    await seedBaseUrlIntoEnvironment(p.baseUrlValue)
  }

  const existing = existingKeySet()
  // Tag → folder id cache so multiple ops with the same tag share a folder.
  const folderByTag = new Map<string, string | null>()

  let imported = 0
  let skipped = 0
  // Load the first imported request into the editor so the user sees
  // immediate feedback.
  let firstCreated: SavedRequest | null = null

  for (const op of p.operations) {
    const key = `${op.request.method.toUpperCase()}|${pathnameOf(op.request.url)}`
    if (existing.has(key)) {
      skipped++
      continue
    }
    existing.add(key)

    const tag = op.tag || ''
    let folderId: string | null = destinationFolder.value
    if (tag) {
      if (folderByTag.has(tag)) {
        folderId = folderByTag.get(tag) ?? null
      } else {
        // Tag-based sub-folder is created UNDER the user-chosen
        // destination, so a big import lands as one tidy subtree rather
        // than a flat dump at root.
        const folder = await collStore.createFolder(destinationFolder.value, tag)
        folderId = folder.id
        folderByTag.set(tag, folder.id)
      }
    }

    const created = await collStore.createRequest(folderId, {
      name: op.request.name,
      method: op.request.method as HttpMethod,
      url: op.request.url,
      headers: op.request.headers,
      params: op.request.params,
      body: op.request.body
    })
    if (!firstCreated) firstCreated = created
    imported++
  }

  if (firstCreated) reqStore.loadFromSaved(firstCreated)
  message.success(
    fmt(t.value.importedRequestsSummary, { n: imported }) +
    (skipped > 0 ? fmt(t.value.skippedDuplicatesSummary, { n: skipped }) : '')
  )
  open.value = false
}

function onImport() {
  error.value = ''
  warnings.value = []
  if (!text.value.trim()) {
    error.value = 'Paste something first.'
    return
  }
  if (mode.value === 'curl') {
    try {
      void importCurl()
    } catch (e: any) {
      error.value = e?.message ?? 'Could not parse cURL command'
    }
  } else {
    void importOpenApi()
  }
}

// File upload: read the file as text into the textarea so the user can
// review before importing. We deliberately don't auto-trigger Import —
// the user might want to tweak the title or see the preview first.
async function onFileSelected(file: File) {
  if (!file) return
  // Cap file size at 10MB to avoid pathological inputs locking the UI.
  if (file.size > 10 * 1024 * 1024) {
    error.value = `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Limit is 10 MB.`
    return
  }
  try {
    const text2 = await file.text()
    text.value = text2
    error.value = ''
    message.success(fmt(t.value.loadedFileName, { name: file.name }))
  } catch (e: any) {
    error.value = `Could not read file: ${e?.message ?? e}`
  }
}

// antd Upload's beforeUpload returns false to suppress auto-upload; we
// read the file ourselves and stop the upload pipeline.
function onUploadBeforeUpload(file: File): boolean {
  void onFileSelected(file)
  return false
}

// Placeholders are bound through `curlPlaceholder` (computed) instead of
// inline template literals — writing backticks inside :placeholder="..."
// tripped the Vue template parser.
const curlPlaceholder = computed(() =>
  mode.value === 'curl'
    ? `curl 'https://api.example.com/v1/users' -H 'Authorization: Bearer xxx' -d '{"name":"abc"}'`
    : '{ "openapi": "3.0.0", "info": { "title": "…", "version": "1.0" }, "paths": { … } }'
)

const importUrl = ref('')
const fetchingFromUrl = ref(false)

function isUrlLike(s: string): boolean {
  const t = s.trim()
  return t.startsWith('http://') || t.startsWith('https://')
}

async function importFromUrl() {
  const url = importUrl.value.trim()
  if (!url) return
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    error.value = t.value.invalidImportUrl
    return
  }
  fetchingFromUrl.value = true
  error.value = ''
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const content = await res.text()
    text.value = content
    importUrl.value = ''
    message.success(t.value.imported)
  } catch (e: any) {
    error.value = `${t.value.invalidImportUrl} (${e?.message ?? e})`
  } finally {
    fetchingFromUrl.value = false
  }
}

const showNewFolderInput = ref(false)
const newFolderInputName = ref('')

function openNewFolderInput() {
  newFolderInputName.value = t.value.newFolderName
  showNewFolderInput.value = true
}

async function confirmNewFolder() {
  const name = newFolderInputName.value.trim()
  if (!name) {
    message.warning(t.value.nameRequired)
    return
  }
  if (!collStore.canAddChild(destinationFolder.value)) {
    message.warning(fmt(t.value.maxFolderDepthReached, { n: MAX_DEPTH }))
    return
  }
  try {
    await collStore.createFolder(destinationFolder.value, name)
    showNewFolderInput.value = false
  } catch (e: any) {
    message.error(e?.message ?? t.value.couldNotCreateFolder)
  }
}

function cancelNewFolder() {
  showNewFolderInput.value = false
  newFolderInputName.value = ''
}
</script>

<template>
  <Modal
    :open="open"
    :title="t.importApi"
    width="780px"
    :footer="null"
    @cancel="open = false"
  >
    <div class="import-mode-row">
      <Segmented
        v-model:value="mode"
        :options="[
          { value: 'curl', label: t.curl },
          { value: 'openapi', label: t.openapiSwagger }
        ]"
      />
      <div class="import-mode-actions">
        <Input
          v-if="mode === 'openapi'"
          v-model:value="importUrl"
          size="small"
          :placeholder="t.importFromUrl"
          class="import-url-input"
          @press-enter="importFromUrl"
        />
        <Button
          v-if="mode === 'openapi'"
          size="small"
          :loading="fetchingFromUrl"
          :disabled="!importUrl.trim()"
          @click="importFromUrl"
        >
          {{ t.importFromUrl }}
        </Button>
        <Upload
          v-if="mode === 'openapi'"
          :before-upload="onUploadBeforeUpload"
          :show-upload-list="false"
          accept=".json,.yaml,.yml,application/json"
        >
          <Button size="small">
            <template #icon><UploadOutlined /></template>
            {{ t.chooseFileEllipsis }}
          </Button>
        </Upload>
      </div>
    </div>

    <div class="import-destination">
      <label class="dest-label">{{ t.folder }}:</label>
      <FolderPicker
        v-model:visible="folderPickerOpen"
        :current-folder-id="destinationFolder"
        @select="(id: string | null) => (destinationFolder = id)"
      >
        <Button size="small">{{ destinationLabel }}</Button>
      </FolderPicker>
      <template v-if="!showNewFolderInput">
        <Button size="small" @click="openNewFolderInput">
          <template #icon><PlusOutlined /></template>
          {{ t.newFolderName }}
        </Button>
      </template>
      <template v-else>
        <Input
          v-model:value="newFolderInputName"
          size="small"
          :placeholder="t.newFolderName"
          class="new-folder-inline-input"
          @press-enter="confirmNewFolder"
          @keydown.esc="cancelNewFolder"
          ref="newFolderInputRef"
        />
        <Button size="small" type="primary" @click="confirmNewFolder">
          {{ t.confirm }}
        </Button>
        <Button size="small" @click="cancelNewFolder">
          {{ t.cancel }}
        </Button>
      </template>
    </div>

    <p v-if="mode === 'curl'" class="import-hint">
      {{ t.pasteCurlHint }}
    </p>
    <p v-else class="import-hint">
      {{ t.pasteOpenapiHint }}
    </p>

    <Input.TextArea
      v-model:value="text"
      :rows="10"
      :placeholder="curlPlaceholder"
      class="import-textarea"
      :spellcheck="false"
    />

    <!-- OpenAPI live preview -->
    <div v-if="mode === 'openapi' && openApiPreview" class="import-preview">
      <div class="preview-summary">
        <Tag color="blue">{{ openApiPreview.operations.length }} 接口</Tag>
        <Tag color="orange">{{ tagCounts.length }} 标签</Tag>
        <Tag v-if="conflictCount > 0" color="red">{{ conflictCount }} 重复跳过</Tag>
      </div>
      <div v-if="tagCounts.length > 0" class="preview-tags">
        <span v-for="[tag, count] in tagCounts" :key="tag" class="preview-tag-row">
          <span class="preview-tag-name">{{ tag }}</span>
          <span class="preview-tag-count">{{ count }}</span>
        </span>
      </div>
    </div>

    <Alert v-if="error" type="error" :message="error" show-icon class="import-alert" />
    <Alert
      v-if="warnings.length > 0"
      type="warning"
      show-icon
      class="import-alert"
      :message="t.headsUp"
    >
      <ul class="warning-list">
        <li v-for="(w, idx) in warnings" :key="idx">{{ w }}</li>
      </ul>
    </Alert>

    <div class="import-actions">
      <Button @click="open = false">{{ t.cancel }}</Button>
      <Button type="primary" :disabled="!text.trim()" @click="onImport">
        <template #icon><PlusOutlined /></template>
        {{ mode === 'curl' ? t.import : `${t.import} ${willImportCount} 接口` }}
      </Button>
    </div>
  </Modal>
</template>

<style scoped>
.import-mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.import-mode-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.import-url-input {
  width: 320px;
}
.import-destination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.dest-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
}
.new-folder-inline-input {
  width: 180px;
}
.import-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 8px;
}
.import-hint code {
  background: var(--border-base);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 11px;
}
.import-textarea :deep(textarea) {
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
}
.import-preview {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-base);
  border-radius: 4px;
  background: var(--bg-muted);
}
.preview-summary {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.preview-tags {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  max-height: 120px;
  overflow-y: auto;
}
.preview-tag-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}
.preview-tag-name { color: var(--text-primary); }
.preview-tag-count {
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'Menlo', monospace;
}
.import-alert { margin-top: 12px; }
.warning-list {
  margin: 4px 0 0;
  padding-left: 16px;
  font-size: 12px;
}
.import-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
