<script setup lang="ts">
// Capture panel — sidebar replacement shown when the user toggles to
// "Capture" mode in the side panel / options page. Drives the capture
// store, lists captured requests, and lets the user save any of them
// into the active collection as a normal request.
//
// Saving a row defers to FolderPicker so the user can file it where
// they want (or leave it Unfiled).

import { computed, ref, watch } from 'vue'
import { Button, Tag, Tooltip, message, Input, Modal } from 'ant-design-vue'
import {
  PlayCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  SaveOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  ExportOutlined,
  CopyOutlined,
  SnippetsOutlined
} from '@ant-design/icons-vue'
import { useCaptureStore } from '@/stores/capture'
import { useCollectionStore } from '@/stores/collection'
import { useRequestStore } from '@/stores/request'
import { useEnvironmentStore } from '@/stores/environment'
// `debugger` is now declared as a required permission in the manifest, so
// no runtime request is needed (or possible — Chrome refuses runtime
// requests for `debugger`). We still do a defensive check via hasDebugger
// so a misconfigured manifest produces a clear error instead of a
// confusing chrome.debugger.attach failure.
import { hasDebugger } from '@/core/permissions'
import FolderPicker from '@/components/tree/FolderPicker.vue'
import StatusTag from '@/components/common/StatusTag.vue'
import CaptureRow from './CaptureRow.vue'
import CaptureFilters from './CaptureFilters.vue'
import { capturedToDraft } from '@/core/capture-to-request'
import { exportOpenApi } from '@/core/openapi/export'
import { downloadTextFile } from '@/utils/download'
import { draftToCurl } from '@/core/curl'
import { useI18n } from '@/i18n/useI18n'
import { fmt } from '@/i18n'
import type { CapturedRequest } from '@/core/types'

const { t } = useI18n()

const capStore = useCaptureStore()
const collStore = useCollectionStore()
const reqStore = useRequestStore()
const envStore = useEnvironmentStore()

const searchQuery = ref('')
const methodFilters = ref<Set<string>>(new Set())
const statusFilters = ref<Set<string>>(new Set()) // '2xx', '3xx', '4xx', '5xx'
const hostFilter = ref('')

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const STATUS_OPTIONS = [
  { label: '2xx', value: '2xx', min: 200, max: 299 },
  { label: '3xx', value: '3xx', min: 300, max: 399 },
  { label: '4xx', value: '4xx', min: 400, max: 499 },
  { label: '5xx', value: '5xx', min: 500, max: 599 }
]

function toggleMethodFilter(method: string) {
  if (methodFilters.value.has(method)) {
    methodFilters.value.delete(method)
  } else {
    methodFilters.value.add(method)
  }
  methodFilters.value = new Set(methodFilters.value)
}

function toggleStatusFilter(status: string) {
  if (statusFilters.value.has(status)) {
    statusFilters.value.delete(status)
  } else {
    statusFilters.value.add(status)
  }
  statusFilters.value = new Set(statusFilters.value)
}

function clearFilters() {
  searchQuery.value = ''
  methodFilters.value = new Set()
  statusFilters.value = new Set()
  hostFilter.value = ''
}

const hasActiveFilters = computed<boolean>(() =>
  Boolean(searchQuery.value || methodFilters.value.size > 0 ||
    statusFilters.value.size > 0 || hostFilter.value)
)

function matchesFilters(req: CapturedRequest): boolean {
  // Search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    const urlMatch = req.url.toLowerCase().includes(q)
    const methodMatch = req.method.toLowerCase().includes(q)
    if (!urlMatch && !methodMatch) return false
  }

  // Host filter
  if (hostFilter.value) {
    try {
      const u = new URL(req.url)
      if (!u.host.includes(hostFilter.value.toLowerCase())) return false
    } catch {
      return false
    }
  }

  // Method filter
  if (methodFilters.value.size > 0) {
    if (!methodFilters.value.has(req.method.toUpperCase())) return false
  }

  // Status filter
  if (statusFilters.value.size > 0 && req.response) {
    const status = req.response.status
    const matches = STATUS_OPTIONS
      .filter(o => statusFilters.value.has(o.value))
      .some(o => status >= o.min && status <= o.max)
    if (!matches) return false
  }

  return true
}

const filteredRequests = computed(() =>
  capStore.requests.filter(matchesFilters)
)

const expanded = ref<Set<string>>(new Set())
function toggleExpand(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
  expanded.value = new Set(expanded.value)
}

const exportModalOpen = ref(false)
const exportFormat = ref<'curl' | 'openapi'>('curl')
const selectedForExport = ref<Set<string>>(new Set())

function openExportModal() {
  if (filteredRequests.value.length === 0) {
    message.warning(t.value.noRequestsToExport)
    return
  }
  selectedForExport.value = new Set(filteredRequests.value.map(r => r.cdpRequestId))
  exportModalOpen.value = true
}

async function doExport() {
  const requests = filteredRequests.value.filter(r => selectedForExport.value.has(r.cdpRequestId))

  if (exportFormat.value === 'curl') {
    const commands = requests.map(req => {
      const draft = capturedToDraft(req)
      return draftToCurl(draft, envStore.activeVariables, envStore.globals.variables)
    })
    const combined = commands.join('\n\n# ---\n\n')
    try {
      await navigator.clipboard.writeText(combined)
      message.success(fmt(t.value.copiedCurlCommands, { n: commands.length }))
    } catch {
      message.error(t.value.failedCopyClipboard)
    }
  } else {
    // OpenAPI export - convert captured requests to SavedRequest-like objects
    const fakeSavedRequests = requests.map((req, idx) => ({
      id: req.cdpRequestId,
      folderId: null,
      name: req.url.split('/').pop() || `Request ${idx + 1}`,
      method: req.method as any,
      url: req.url,
      headers: req.headers.map(([k, v]) => ({ key: k, value: v, enabled: true })),
      params: [] as any[],
      body: { mode: 'none' as const },
      order: idx,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))

    const json = exportOpenApi({
      scope: 'single',
      title: t.value.exportCapturedTitle,
      requestIds: fakeSavedRequests.map(r => r.id),
      requests: fakeSavedRequests as any,
      folders: []
    })
    downloadTextFile(`captured-${Date.now()}.openapi.json`, json, 'application/json')
    message.success(t.value.exportedOpenApi)
  }

  exportModalOpen.value = false
}

function selectAllForExport() {
  selectedForExport.value = new Set(filteredRequests.value.map(r => r.cdpRequestId))
}

function deselectAllForExport() {
  selectedForExport.value = new Set()
}

async function onStart() {
  // `debugger` is declared as a required permission in the manifest, so
  // chrome.debugger.attach should always work — but if the manifest is
  // misconfigured (e.g. someone reverted the change), we want a clear
  // error here instead of the cryptic "Cannot find a host" or
  // "permission denied" chrome.debugger.attach would throw.
  const granted = await hasDebugger()
  if (!granted) {
    capStore.status = 'idle'
    capStore.error = t.value.capturePermissionUnavailable
    message.warning(capStore.error)
    return
  }
  await capStore.start()
  if (capStore.status === 'capturing') message.success(t.value.captureStarted)
}
async function onStop() {
  await capStore.stop()
  message.info(t.value.captureStopped)
}
async function onClear() {
  await capStore.clear()
}

// Folder picker state for the row the user is currently saving.
const pickerOpen = ref(false)
const pickerFor = ref<CapturedRequest | null>(null)
function beginSave(req: CapturedRequest) {
  pickerFor.value = req
  pickerOpen.value = true
}

async function onFolderPicked(folderId: string | null) {
  const captured = pickerFor.value
  pickerFor.value = null
  if (!captured) return
  const draft = capturedToDraft(captured)
  const now = Date.now()
  const created = await collStore.createRequest(folderId, {
    name: draft.name,
    method: draft.method,
    url: draft.url,
    headers: draft.headers,
    params: draft.params,
    body: draft.body
  })
  void now
  reqStore.loadFromSaved(created)
  message.success(fmt(t.value.savedRequest, { name: created.name }))
}

function loadToEditor(captured: CapturedRequest) {
  const d = capturedToDraft(captured)
  reqStore.loadFromDraft(d)
  message.success(fmt(t.value.loadedRequestIntoEditor, { name: d.name }))
}

const statusColor = computed<'default' | 'processing' | 'success' | 'error' | 'warning'>(() => {
  switch (capStore.status) {
    case 'capturing': return 'processing'
    case 'stopped': return 'default'
    case 'error': return 'error'
    default: return 'default'
  }
})

const statusLabel = computed(() => {
  switch (capStore.status) {
    case 'capturing': return t.value.capturing
    case 'stopped': return t.value.stopped
    case 'error': return t.value.capturePermissionError
    default: return t.value.idle
  }
})

function methodTagColor(method: string): string {
  const m = method.toUpperCase()
  if (m === 'GET') return 'blue'
  if (m === 'POST') return 'green'
  if (m === 'PUT' || m === 'PATCH') return 'orange'
  if (m === 'DELETE') return 'red'
  return 'default'
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = (u.pathname + u.search) || '/'
    return u.host + path
  } catch {
    return url
  }
}

function formatTime(ts: number): string {
  const ms = ts > 1e9 ? ts * 1000 : ts
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<template>
  <div class="cap-panel">
    <div class="cap-toolbar">
      <Tag :color="statusColor" class="cap-status-tag">{{ statusLabel }}</Tag>
      <Tooltip :title="capStore.status === 'capturing' ? t.stopCaptureHint : t.startCaptureHint">
        <Button
          size="small"
          :type="capStore.status === 'capturing' ? 'primary' : 'default'"
          :danger="capStore.status === 'capturing'"
          @click="capStore.status === 'capturing' ? onStop() : onStart()"
        >
          <template #icon>
            <StopOutlined v-if="capStore.status === 'capturing'" />
            <PlayCircleOutlined v-else />
          </template>
          {{ capStore.status === 'capturing' ? t.stopCapture : t.startCapture }}
        </Button>
      </Tooltip>
      <Tooltip :title="t.clearList">
        <Button size="small" type="text" :disabled="capStore.requests.length === 0" @click="onClear">
          <template #icon><DeleteOutlined /></template>
        </Button>
      </Tooltip>
      <Tooltip :title="t.refreshBackground">
        <Button size="small" type="text" @click="capStore.refresh()">
          <template #icon><ReloadOutlined /></template>
        </Button>
      </Tooltip>
      <Tooltip :title="t.exportCaptured">
        <Button size="small" type="text" :disabled="filteredRequests.length === 0" @click="openExportModal">
          <template #icon><ExportOutlined /></template>
        </Button>
      </Tooltip>
    </div>

    <!-- Filters -->
    <CaptureFilters
      v-if="capStore.requests.length > 0"
      :search-query="searchQuery"
      :method-options="METHOD_OPTIONS"
      :method-filters="methodFilters"
      :status-options="STATUS_OPTIONS"
      :status-filters="statusFilters"
      :has-response="capStore.requests.some(r => r.response)"
      :has-active-filters="hasActiveFilters"
      :filtered-count="filteredRequests.length"
      :total-count="capStore.requests.length"
      @update:search-query="(v) => searchQuery = v"
      @toggle-method="toggleMethodFilter"
      @toggle-status="toggleStatusFilter"
      @clear-filters="clearFilters"
    />

    <div v-if="capStore.error" class="cap-error">
      <ExclamationCircleOutlined />
      <span>{{ capStore.error }}</span>
    </div>

    <div class="cap-help" v-if="capStore.requests.length === 0 && capStore.status !== 'capturing'">
      <div class="cap-help-icon"><PlayCircleOutlined /></div>
      <p>{{ t.captureStartHint }}</p>
      <p class="cap-help-note">{{ t.captureDebugBannerNote }}</p>
    </div>
    <div class="cap-list-hint" v-if="filteredRequests.length > 0">
      {{ t.captureInteractionHint }}
    </div>

    <div class="cap-list">
      <CaptureRow
        v-for="req in filteredRequests"
        :key="req.cdpRequestId"
        :req="req"
        :expanded="expanded.has(req.cdpRequestId)"
        :method-tag-color="methodTagColor"
        :shorten-url="shortenUrl"
        :format-time="formatTime"
        @toggle-expand="toggleExpand"
        @load-to-editor="loadToEditor"
        @begin-save="beginSave"
      />
    </div>

    <FolderPicker
      v-model:visible="pickerOpen"
      :current-folder-id="null"
      @select="onFolderPicked"
    />

    <!-- Export Modal -->
    <Modal
      v-model:open="exportModalOpen"
      :title="t.exportCapturedTitle"
      :ok-text="t.export"
      @ok="doExport"
      @cancel="exportModalOpen = false"
    >
      <div class="export-modal-content">
        <div class="export-format">
          <div class="export-format-label">{{ t.exportFormatLabel }}</div>
          <div class="export-format-options">
            <Button
              :type="exportFormat === 'curl' ? 'primary' : 'default'"
              @click="exportFormat = 'curl'"
            >
              <template #icon><SnippetsOutlined /></template>
              {{ t.curlCommands }}
            </Button>
            <Button
              :type="exportFormat === 'openapi' ? 'primary' : 'default'"
              @click="exportFormat = 'openapi'"
            >
              <template #icon><ExportOutlined /></template>
              {{ t.openapiJson }}
            </Button>
          </div>
        </div>
        <div class="export-info">
          <p>{{ filteredRequests.length }} {{ t.requestsWillBeExported }}</p>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.cap-panel {
  display: flex;
  flex-direction: column;
  padding: 0 var(--space-5) var(--space-5);
  gap: var(--space-4);
  min-height: 0;
  flex: 1;
}
.cap-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--border-base);
  flex: 0 0 auto;
}
.cap-status-tag { margin-right: auto; }
.cap-error {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-base);
  background: var(--status-danger-bg);
  color: var(--status-danger);
  font-size: var(--fs-sm);
}
.cap-help {
  padding: var(--space-8) var(--space-2);
  color: var(--text-secondary);
  font-size: var(--fs-base);
  line-height: 1.5;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  animation: fade-rise 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
.cap-help p { margin: 0; }
.cap-help-icon {
  font-size: 32px;
  color: var(--text-tertiary);
  opacity: 0.6;
}
.cap-help-note {
  font-size: var(--fs-xs);
  margin: 0;
  color: var(--text-tertiary);
  max-width: 240px;
}
.cap-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cap-list-hint {
  font-size: 10px;
  color: var(--text-tertiary);
  padding: 4px 0;
  text-align: center;
  border-bottom: 1px solid var(--border-base);
  flex: 0 0 auto;
}
.cap-row {
  border-bottom: 1px solid var(--border-base);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  cursor: pointer;
  padding: var(--space-3) var(--space-2);
  position: relative;
  transition: background-color var(--ease-fast);
}
.cap-row::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  background: var(--accent);
  opacity: 0;
  transition: opacity var(--ease-fast);
  pointer-events: none;
}
.cap-row:hover { background: var(--bg-muted); }
.cap-row:hover::before { opacity: 1; }
.cap-row-open { background: var(--bg-muted); }
.cap-row-open::before { opacity: 1; }
.cap-row-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cap-method {
  flex: 0 0 48px;
  font-size: 10px;
  padding: 0 4px;
  line-height: 16px;
  text-align: center;
  min-width: 36px;
}
.cap-url {
  flex: 1;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 11px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.cap-status { flex: 0 0 auto; }
.cap-time {
  flex: 0 0 60px;
  font-size: 10px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'Menlo', monospace;
  text-align: right;
}
.cap-row-actions { flex: 0 0 auto; opacity: 0; transition: opacity 0.1s; }
.cap-row:hover .cap-row-actions { opacity: 1; }
.cap-row-detail {
  flex: 1 1 100%;
  padding: 8px 4px 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cap-detail-section { display: flex; flex-direction: column; gap: 4px; }
.cap-detail-label {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-tertiary);
  letter-spacing: 0.04em;
  font-weight: 600;
}
.cap-detail-value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  word-break: break-all;
}
.cap-detail-rows { display: flex; flex-direction: column; gap: 2px; }
.cap-detail-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  font-size: 11px;
  gap: 6px;
  align-items: start;
}
.cap-detail-key {
  color: var(--code-key);
  font-family: 'SF Mono', 'Menlo', monospace;
  padding-top: 4px;
  word-break: break-all;
}
.cap-detail-textarea {
  width: 100%;
  min-height: 24px;
  /* field-sizing: content (Chrome 123+) auto-grows; older browsers fall
     back to a scrollable textarea. Keeps long URLs / token values from
     blowing out the row width. */
  field-sizing: content;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: 3px;
  padding: 3px 6px;
  resize: vertical;
  outline: none;
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.4;
}
.cap-detail-textarea:focus {
  border-color: var(--accent);
}
.cap-detail-body {
  background: var(--bg-muted);
  max-height: 200px;
}
.cap-mono { font-family: 'SF Mono', 'Menlo', monospace; }
.cap-mime { color: var(--text-tertiary); font-size: 11px; }
</style>
