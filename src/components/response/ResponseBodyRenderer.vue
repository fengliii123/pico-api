<script setup lang="ts">
// Response body renderer: handles Content-Type aware rendering
// (image / pdf / binary / text / json tree / pretty / raw) plus the
// toolbar (view-mode toggle, copy, save).
//
// Self-contained: takes a `result` prop and derives everything else,
// including image/PDF object URLs (revoked on result change / unmount).

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Button, Tooltip, message } from 'ant-design-vue'
import { CopyOutlined, DownloadOutlined, BranchesOutlined, FileTextOutlined } from '@ant-design/icons-vue'
import JsonTreeView from '@/components/common/JsonTreeView.vue'
import { classify } from '@/core/mime'
import { formatBytes } from '@/utils/format'
import { downloadBlob } from '@/utils/download'
import type { ResponseResult } from '@/core/types'
import { useI18n } from '@/i18n/useI18n'
import { fmt } from '@/i18n'

const { t } = useI18n()
const props = defineProps<{
  result: ResponseResult
}>()

const viewMode = ref<'pretty' | 'raw' | 'tree'>('pretty')
const parsedJson = ref<any>(null)
const imageUrl = ref<string | null>(null)
const pdfUrl = ref<string | null>(null)
const prettyJson = ref<string>('')
const prettyXml = ref<string>('')

const kind = computed(() => classify(props.result.mime, props.result.body.text))

// Thresholds for keeping the renderer responsive on large bodies.
const PRETTY_LIMIT = 1_000_000      // 1 MB — skip pretty above this
const RENDER_LIMIT = 5_000_000      // 5 MB — cap the DOM text above this

const rawBodySize = computed(() => props.result.body.text.length)
const prettyDisabled = computed(() => rawBodySize.value > PRETTY_LIMIT)
const renderTruncated = computed(() => rawBodySize.value > RENDER_LIMIT)

const bodyText = computed(() => {
  const raw = props.result.body.text
  if (renderTruncated.value) {
    return raw.slice(0, RENDER_LIMIT) + `\n\n…[truncated — response is ${(raw.length / 1024 / 1024).toFixed(1)} MB, copy for full content]`
  }
  if (viewMode.value === 'raw' || prettyDisabled.value) return raw
  if (kind.value === 'json') return prettyJson.value
  if (kind.value === 'xml' || kind.value === 'html') return prettyXml.value
  return raw
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function highlightJson(s: string): string {
  const re = /("(?:\\.|[^"\\])*"\s*:?)|(\b(?:true|false)\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],])/g
  return escapeHtml(s).replace(re, (_m, str, bool, nul, num, punct) => {
    if (str !== undefined) {
      const isKey = /:\s*$/.test(str.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
      return isKey
        ? `<span class="tk-key">${str}</span>`
        : `<span class="tk-str">${str}</span>`
    }
    if (bool !== undefined) return `<span class="tk-kw">${bool}</span>`
    if (nul !== undefined) return `<span class="tk-kw">${nul}</span>`
    if (num !== undefined) return `<span class="tk-num">${num}</span>`
    if (punct !== undefined) return `<span class="tk-punc">${punct}</span>`
    return _m
  })
}

const bodyHtml = computed(() => kind.value === 'json' ? highlightJson(bodyText.value) : '')

async function copyBody() {
  try {
    await navigator.clipboard.writeText(bodyText.value)
    message.success(t.value.copied)
  } catch {
    message.error(t.value.copyFailed)
  }
}

async function downloadBody() {
  try {
    const blob = props.result.body.blob
    const mime = props.result.mime || 'application/octet-stream'
    const extension = mime.split('/')[1]?.split(';')[0] || 'bin'
    const filename = `response-${Date.now()}.${extension}`
    downloadBlob(filename, blob)
    message.success(fmt(t.value.downloadedFile, { name: filename }))
  } catch {
    message.error(t.value.downloadFailed)
  }
}

const canShowTree = computed(() => {
  return kind.value === 'json' && parsedJson.value !== null &&
    (typeof parsedJson.value === 'object' && parsedJson.value !== null)
})

// Re-derive derived state whenever a new response arrives. Revoke any
// outstanding object URLs so we don't leak blob references between sends.
watch(() => props.result, (r) => {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = null
  }
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = null
  }
  parsedJson.value = null

  const k = classify(r.mime, r.body.text)
  if (k === 'image') {
    imageUrl.value = URL.createObjectURL(r.body.blob)
  } else if (k === 'pdf') {
    pdfUrl.value = URL.createObjectURL(r.body.blob)
  } else if (k === 'json') {
    try {
      const parsed = JSON.parse(r.body.text)
      parsedJson.value = parsed
      prettyJson.value = JSON.stringify(parsed, null, 2)
    } catch {
      prettyJson.value = r.body.text
    }
  } else if (k === 'xml' || k === 'html') {
    try {
      const doc = new DOMParser().parseFromString(r.body.text, 'text/xml')
      const ser = new XMLSerializer()
      prettyXml.value = ser.serializeToString(doc)
    } catch {
      prettyXml.value = r.body.text
    }
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
})
</script>

<template>
  <div v-if="kind === 'image'" class="image-container">
    <img v-if="imageUrl" :src="imageUrl" alt="response" />
    <div class="image-actions">
      <Button size="small" @click="downloadBody">
        <template #icon><DownloadOutlined /></template>
        {{ t.download }}
      </Button>
    </div>
  </div>
  <div v-else-if="kind === 'pdf'" class="pdf-container">
    <iframe v-if="pdfUrl" :src="pdfUrl" class="pdf-iframe" />
    <div class="pdf-placeholder binary-placeholder">
      <FileTextOutlined style="font-size: 48px; margin-bottom: 12px;" />
      <p>{{ t.pdfPreview }}</p>
      <p style="font-size: 11px; margin-top: 8px;">{{ formatBytes(result.body.size) }}</p>
    </div>
    <div class="binary-actions">
      <Button size="small" @click="downloadBody">
        <template #icon><DownloadOutlined /></template>
        {{ t.download }}
      </Button>
    </div>
  </div>
  <div v-else-if="kind === 'binary'" class="binary-container">
    <div class="binary-placeholder">
      <DownloadOutlined style="font-size: 32px; margin-bottom: 8px;" />
      <p>{{ t.binaryData }} — {{ formatBytes(result.body.size) }}</p>
    </div>
    <Button size="small" @click="downloadBody">
      <template #icon><DownloadOutlined /></template>
      {{ t.download }}
    </Button>
  </div>
  <div v-else class="code-wrap">
    <div class="code-toolbar">
      <div class="code-toolbar-info">
        <span class="code-mime">{{ result.mime || 'text' }}</span>
        <span v-if="prettyDisabled" class="code-size-warn" :title="t.largePrettyOff">
          {{ t.largePrettyOff }}
        </span>
        <span v-else-if="renderTruncated" class="code-size-warn" :title="t.truncated">
          {{ t.truncated }}
        </span>
      </div>
      <div class="code-toolbar-actions">
        <template v-if="kind === 'json' || kind === 'xml' || kind === 'html'">
          <div class="seg">
            <Tooltip v-if="kind === 'json'" :title="t.treeView">
              <button
                class="seg-btn"
                :class="{ active: viewMode === 'tree' }"
                @click="viewMode = 'tree'"
              >
                <BranchesOutlined />
              </button>
            </Tooltip>
            <Tooltip :title="t.prettyView">
              <button
                class="seg-btn"
                :class="{ active: viewMode === 'pretty' }"
                @click="viewMode = 'pretty'"
              >
                <FileTextOutlined />
              </button>
            </Tooltip>
            <Tooltip :title="t.rawView">
              <button
                class="seg-btn"
                :class="{ active: viewMode === 'raw' }"
                @click="viewMode = 'raw'"
              >
                {{ t.raw }}
              </button>
            </Tooltip>
          </div>
        </template>
        <Button size="small" class="copy-btn" @click="copyBody">
          <template #icon><CopyOutlined /></template>
          {{ t.copy }}
        </Button>
        <Button size="small" class="copy-btn" @click="downloadBody">
          <template #icon><DownloadOutlined /></template>
          Save
        </Button>
      </div>
    </div>
    <template v-if="viewMode === 'tree' && canShowTree">
      <JsonTreeView :data="parsedJson" />
    </template>
    <template v-else>
      <pre
        v-if="kind === 'json'"
        class="code-block code-json"
        v-html="bodyHtml"
      />
      <pre v-else class="code-block">{{ bodyText }}</pre>
    </template>
  </div>
</template>

<style scoped>
.image-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
}
.image-container img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
.image-actions { display: flex; gap: var(--space-3); }

.pdf-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
  min-height: 400px;
}
.pdf-iframe {
  flex: 1;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-base);
}
.pdf-placeholder {
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
}

.binary-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
}
.binary-placeholder {
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
}

.code-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  height: 100%;
  min-height: 0;
}
.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--fs-sm);
}
.code-toolbar-info {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--text-secondary);
  min-width: 0;
}
.code-mime {
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: var(--fs-xs);
  padding: 1px var(--space-2);
  background: var(--bg-muted);
  border-radius: var(--radius-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}
.code-size-warn {
  color: var(--status-warning-fg);
  font-size: var(--fs-xs);
}
.code-toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  flex: 0 0 auto;
}

/* Segmented toggle for tree/pretty/raw. */
.seg {
  display: inline-flex;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-base);
  overflow: hidden;
}
.seg-btn {
  border: 0;
  background: transparent;
  padding: var(--space-2) var(--space-4);
  font-size: var(--fs-sm);
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border-right: 1px solid var(--border-strong);
}
.seg-btn:last-child { border-right: 0; }
.seg-btn.active {
  background: var(--accent-soft-bg);
  color: var(--accent-soft-fg);
}
.seg-btn:hover:not(.active) {
  background: var(--bg-muted);
  color: var(--text-primary);
}

.copy-btn.ant-btn-sm {
  font-size: var(--fs-xs);
}

.code-block {
  flex: 1;
  margin: 0;
  padding: var(--space-4);
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  overflow: auto;
  font-family: 'SF Mono', 'Menlo', ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  min-height: 0;
}
.code-block :deep(.tk-key) { color: var(--syntax-key, #2563eb); }
.code-block :deep(.tk-str) { color: var(--syntax-str, #16a34a); }
.code-block :deep(.tk-num) { color: var(--syntax-num, #ea580c); }
.code-block :deep(.tk-kw) { color: var(--syntax-kw, #dc2626); }
.code-block :deep(.tk-punc) { color: var(--text-tertiary); }
</style>
