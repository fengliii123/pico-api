<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Modal, Button, Input, Tag, Empty } from 'ant-design-vue'
import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { history as historyDb } from '@/db'
import { useRequestStore } from '@/stores/request'
import { useResponseStore } from '@/stores/response'
import { useI18n } from '@/i18n/useI18n'
import { fmt } from '@/i18n'
import { methodColor } from '@/utils/methodColors'
import type { HistoryEntry } from '@/core/types'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const reqStore = useRequestStore()
const resStore = useResponseStore()

const entries = ref<HistoryEntry[]>([])
const loading = ref(false)
const searchQuery = ref('')
const methodFilter = ref<string | null>(null)
const statusFilter = ref<string | null>(null)

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const statusOptions = computed(() => [
  { label: t.value.status2xx, value: '2xx', range: [200, 299] as const },
  { label: t.value.status3xx, value: '3xx', range: [300, 399] as const },
  { label: t.value.status4xx, value: '4xx', range: [400, 499] as const },
  { label: t.value.status5xx, value: '5xx', range: [500, 599] as const },
])

async function loadHistory() {
  loading.value = true
  try {
    entries.value = await historyDb.list(50)
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (open) => {
  if (open) {
    void loadHistory()
  }
})

const filteredEntries = computed(() => {
  let result = entries.value

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.url.toLowerCase().includes(q) ||
      e.method.toLowerCase().includes(q)
    )
  }

  if (methodFilter.value) {
    result = result.filter(e => e.method === methodFilter.value)
  }

  if (statusFilter.value) {
    const opt = statusOptions.value.find(o => o.value === statusFilter.value)
    if (opt) {
      result = result.filter(e => e.status >= opt.range[0] && e.status <= opt.range[1])
    }
  }

  return result
})

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return fmt(t.value.timeDaysAgo, { n: days })
  if (hours > 0) return fmt(t.value.timeHoursAgo, { n: hours })
  if (minutes > 0) return fmt(t.value.timeMinutesAgo, { n: minutes })
  return t.value.timeJustNow
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'warning'
  if (status >= 400 && status < 500) return 'error'
  if (status >= 500) return 'error'
  return 'default'
}

function getMethodColor(method: string): string {
  return methodColor(method)
}

function truncateUrl(url: string, maxLen = 50): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    const full = u.host + u.pathname
    if (full.length <= maxLen) return full
    return full.slice(0, maxLen - 3) + '...'
  } catch {
    if (url.length <= maxLen) return url
    return url.slice(0, maxLen - 3) + '...'
  }
}

function runEntry(entry: HistoryEntry) {
  reqStore.newRequest(null)
  reqStore.setName(entry.name || t.value.unnamedRequest)
  reqStore.setMethod(entry.method)
  reqStore.setUrl(entry.url)
  resStore.setActive(null)
  emit('update:open', false)
}

async function deleteEntry(id: string) {
  await historyDb.delete(id)
  entries.value = entries.value.filter(e => e.id !== id)
}

function clearAll() {
  Modal.confirm({
    title: t.value.clearHistoryConfirmTitle,
    content: t.value.clearHistoryConfirmContent,
    okText: t.value.clearAll,
    okType: 'danger',
    cancelText: t.value.cancel,
    onOk: async () => {
      await historyDb.clear()
      entries.value = []
    }
  })
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <Modal
    :open="open"
    :title="t.historyTitle"
    width="800px"
    :footer="null"
    @cancel="close"
  >
    <div class="history-panel">
      <div class="history-toolbar">
        <div class="toolbar-left">
          <Input
            v-model:value="searchQuery"
            :placeholder="t.searchUrlName"
            allow-clear
            style="width: 240px"
          >
            <template #prefix>
              <SearchOutlined style="color: var(--text-secondary)" />
            </template>
          </Input>
          <div class="filter-group">
            <select v-model="methodFilter" class="filter-select">
              <option :value="null">{{ t.allMethods }}</option>
              <option v-for="m in methodOptions" :key="m" :value="m">{{ m }}</option>
            </select>
            <select v-model="statusFilter" class="filter-select">
              <option :value="null">{{ t.allStatus }}</option>
              <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
        </div>
        <div class="toolbar-right">
          <Button size="small" @click="loadHistory">
            <template #icon><ReloadOutlined /></template>
            {{ t.refresh }}
          </Button>
          <Button size="small" danger @click="clearAll" :disabled="entries.length === 0">
            <template #icon><DeleteOutlined /></template>
            {{ t.clearHistory }}
          </Button>
        </div>
      </div>

      <div class="history-list">
        <template v-if="loading">
          <div class="history-loading">{{ t.loading }}</div>
        </template>
        <template v-else-if="filteredEntries.length === 0">
          <Empty
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
            :description="t.noHistoryEntries"
          >
            <template #description>
              <span v-if="searchQuery || methodFilter || statusFilter">
                {{ t.noMatchingEntries }}
              </span>
              <span v-else>
                {{ t.sendRequestsHistoryHint }}
              </span>
            </template>
          </Empty>
        </template>
        <template v-else>
          <div
            v-for="entry in filteredEntries"
            :key="entry.id"
            class="history-entry"
          >
            <div class="entry-main" @click="() => runEntry(entry)">
              <div class="entry-left">
                <span
                  class="method-tag"
                  :style="{ color: getMethodColor(entry.method), borderColor: getMethodColor(entry.method) }"
                >
                  {{ entry.method }}
                </span>
                <span class="entry-name" :title="entry.name">{{ entry.name || t.unnamedRequest }}</span>
              </div>
              <div class="entry-right">
                <Tag :color="getStatusColor(entry.status)" class="status-tag">
                  {{ entry.status }}
                </Tag>
                <span class="entry-duration">{{ formatDuration(entry.time) }}</span>
                <span class="entry-size">{{ formatSize(entry.size) }}</span>
                <span class="entry-time">{{ formatTime(entry.sentAt) }}</span>
              </div>
            </div>
            <div class="entry-url" :title="entry.url">{{ truncateUrl(entry.url) }}</div>
            <div class="entry-actions">
              <Button type="text" size="small" @click.stop="() => runEntry(entry)">
                <template #icon><ReloadOutlined /></template>
                {{ t.rerun }}
              </Button>
              <Button type="text" size="small" danger @click.stop="deleteEntry(entry.id)">
                <template #icon><DeleteOutlined /></template>
                {{ t.delete }}
              </Button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.history-panel {
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}

.history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-base);
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group {
  display: flex;
  gap: 8px;
}

.filter-select {
  padding: 4px 8px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--accent);
}

.history-list {
  flex: 1;
  overflow-y: auto;
  max-height: calc(70vh - 100px);
}

.history-loading {
  text-align: center;
  padding: 32px;
  color: var(--text-secondary);
}

.history-entry {
  padding: 10px 12px;
  border-radius: 4px;
  margin-bottom: 6px;
  background: var(--bg-subtle);
  transition: background 0.15s;
}

.history-entry:hover {
  background: var(--bg-muted);
}

.entry-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  gap: 12px;
}

.entry-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.method-tag {
  font-size: 10px;
  font-weight: 700;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  padding: 2px 5px;
  border: 1px solid;
  border-radius: 3px;
  flex-shrink: 0;
}

.entry-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-tag {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
}

.entry-duration,
.entry-size,
.entry-time {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.entry-url {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-actions {
  margin-top: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.history-entry:hover .entry-actions {
  opacity: 1;
}
</style>
