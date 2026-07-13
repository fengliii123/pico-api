<script setup lang="ts">
// Command Palette Modal:
// - Opens with Cmd+K / Ctrl+K
// - Fuzzy search across commands, requests, and folders
// - Categorized results: Actions, Requests, Folders
// - Keyboard navigation (↑↓ to navigate, Enter to execute, Esc to close)

import { computed, ref, watch, nextTick } from 'vue'
import { Input } from 'ant-design-vue'
import { SearchOutlined, SendOutlined, FolderOutlined, ApiOutlined, HistoryOutlined, EnvironmentOutlined, CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { useCollectionStore } from '@/stores/collection'
import { useRequestStore } from '@/stores/request'
import { useEnvironmentStore } from '@/stores/environment'
import { useResponseStore } from '@/stores/response'
import { history as historyDb } from '@/db'
import { useI18n } from '@/i18n/useI18n'
import { fmt } from '@/i18n'
import type { HistoryEntry } from '@/core/types'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
  (e: 'import'): void
  (e: 'export'): void
}>()

const collStore = useCollectionStore()
const reqStore = useRequestStore()
const envStore = useEnvironmentStore()
const resStore = useResponseStore()

const searchQuery = ref('')
const selectedIndex = ref(0)
const inputRef = ref<InstanceType<typeof Input> | null>(null)

interface CommandItem {
  id: string
  type: 'command' | 'request' | 'folder' | 'environment' | 'history'
  label: string
  description?: string
  icon: any
  action: () => void
  keywords?: string
}

const baseCommands = computed<CommandItem[]>(() => [
  { id: 'new-request', type: 'command', label: t.value.cmdNew, description: t.value.cmdNewDesc, icon: PlusOutlined, action: () => { reqStore.newRequest(null); close() } },
  { id: 'new-folder', type: 'command', label: t.value.newFolder, description: t.value.cmdNewFolderDesc, icon: FolderOutlined, action: () => { void collStore.createFolder(null); close() } },
  { id: 'import', type: 'command', label: t.value.cmdImport, description: t.value.cmdImportDesc, icon: ApiOutlined, action: () => emit('import'), keywords: 'curl openapi swagger' },
  { id: 'export', type: 'command', label: t.value.cmdExport, description: t.value.cmdExportDesc, icon: ApiOutlined, action: () => emit('export'), keywords: 'openapi' },
])

// Build commands from saved requests
const requestCommands = computed<CommandItem[]>(() => {
  return collStore.requestList.map(r => ({
    id: `request-${r.id}`,
    type: 'request' as const,
    label: r.name || t.value.unnamedRequest,
    description: `${r.method} ${r.url}`,
    icon: ApiOutlined,
    action: () => {
      reqStore.loadFromSaved(r)
      close()
    },
    keywords: `${r.method} ${r.url}`
  }))
})

// Build commands from folders
const folderCommands = computed<CommandItem[]>(() => {
  return collStore.folderList.map(f => ({
    id: `folder-${f.id}`,
    type: 'folder' as const,
    label: f.name,
    description: t.value.cmdFolderDesc,
    icon: FolderOutlined,
    action: () => {
      // Could expand and highlight, for now just close
      close()
    },
    keywords: f.name
  }))
})

// Environment commands
const environmentCommands = computed<CommandItem[]>(() => {
  const commands: CommandItem[] = []
  // Add "No Environment" option
  commands.push({
    id: 'env-none',
    type: 'environment',
    label: t.value.noEnvironment,
    description: t.value.cmdDeactivateEnvDesc,
    icon: EnvironmentOutlined,
    action: () => { envStore.setActive(null); close() }
  })
  // Add all environments
  for (const env of envStore.environments) {
    const isActive = env.id === envStore.activeEnvironmentId
    commands.push({
      id: `env-${env.id}`,
      type: 'environment',
      label: `${isActive ? '✓ ' : ''}${env.name}`,
      description: fmt(t.value.variablesCount, { n: env.variables.length }),
      icon: EnvironmentOutlined,
      action: () => { envStore.setActive(env.id); close() },
      keywords: 'environment'
    })
  }
  return commands
})

// Recent history commands (last 10)
const recentHistoryCommands = ref<CommandItem[]>([])
async function loadHistoryCommands() {
  const entries = await historyDb.list(10)
  recentHistoryCommands.value = entries.map((h: HistoryEntry) => ({
    id: `history-${h.id}`,
    type: 'history' as const,
    label: h.name || t.value.unnamedRequest,
    description: `${h.method} ${h.url} — ${h.status}`,
    icon: HistoryOutlined,
    action: () => {
      // Re-run from history
      reqStore.newRequest(null)
      reqStore.setName(h.name || t.value.unnamedRequest)
      reqStore.setMethod(h.method)
      reqStore.setUrl(h.url)
      resStore.setActive(null)
      close()
    },
    keywords: `${h.method} ${h.url}`
  }))
}

// Fuzzy search helper
function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  // Simple contains check first
  if (t.includes(q)) return true
  // Fuzzy: all chars in query appear in order in text
  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++
  }
  return qi === q.length
}

// Filtered and categorized results
const filteredResults = computed<{ category: string; items: CommandItem[] }[]>(() => {
  const q = searchQuery.value.trim()
  const results: { category: string; items: CommandItem[] }[] = []

  // Commands
  const filteredCommands = baseCommands.value.filter(cmd =>
    fuzzyMatch(q, cmd.label) || fuzzyMatch(q, cmd.description || '') || fuzzyMatch(q, cmd.keywords || '')
  )
  if (filteredCommands.length > 0) {
    results.push({ category: 'Actions', items: filteredCommands })
  }

  // Requests
  const filteredRequests = requestCommands.value.filter(cmd =>
    fuzzyMatch(q, cmd.label) || fuzzyMatch(q, cmd.description || '') || fuzzyMatch(q, cmd.keywords || '')
  )
  if (filteredRequests.length > 0) {
    results.push({ category: 'Requests', items: filteredRequests.slice(0, 15) })
  }

  // History
  const filteredHistory = recentHistoryCommands.value.filter(cmd =>
    fuzzyMatch(q, cmd.label) || fuzzyMatch(q, cmd.description || '') || fuzzyMatch(q, cmd.keywords || '')
  )
  if (filteredHistory.length > 0) {
    results.push({ category: 'Recent History', items: filteredHistory })
  }

  // Folders
  const filteredFolders = folderCommands.value.filter(cmd =>
    fuzzyMatch(q, cmd.label) || fuzzyMatch(q, cmd.keywords || '')
  )
  if (filteredFolders.length > 0) {
    results.push({ category: 'Folders', items: filteredFolders })
  }

  // Environments
  const filteredEnvs = environmentCommands.value.filter(cmd =>
    fuzzyMatch(q, cmd.label) || fuzzyMatch(q, cmd.description || '') || fuzzyMatch(q, cmd.keywords || '')
  )
  if (filteredEnvs.length > 0) {
    results.push({ category: 'Environments', items: filteredEnvs })
  }

  return results
})

// Flat list for keyboard navigation
const flatItems = computed<CommandItem[]>(() => {
  return filteredResults.value.flatMap(g => g.items)
})

watch(() => props.open, (open) => {
  if (open) {
    searchQuery.value = ''
    selectedIndex.value = 0
    void loadHistoryCommands()
    nextTick(() => {
      const el = document.querySelector<HTMLInputElement>('.palette-input')
      el?.focus()
    })
  }
})

function close() {
  emit('update:open', false)
  emit('close')
}

function selectItem(item: CommandItem) {
  item.action()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, flatItems.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatItems.value[selectedIndex.value]
    if (item) selectItem(item)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

// Reset selection when results change
watch(filteredResults, () => {
  selectedIndex.value = 0
})

function getCategoryIcon(category: string) {
  switch (category) {
    case 'Actions': return SendOutlined
    case 'Requests': return ApiOutlined
    case 'Recent History': return HistoryOutlined
    case 'Folders': return FolderOutlined
    case 'Environments': return EnvironmentOutlined
    default: return ApiOutlined
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="command-palette-overlay" @click.self="close">
      <div class="command-palette" @keydown="onKeyDown">
        <div class="palette-header">
          <SearchOutlined class="search-icon" />
          <input
            ref="inputRef"
            v-model="searchQuery"
            class="palette-input"
            :placeholder="t.searchCommandsHint"
            autofocus
          />
          <span class="palette-hint">⌘K to close</span>
        </div>
        <div class="palette-results">
          <template v-if="flatItems.length > 0">
            <template v-for="group in filteredResults" :key="group.category">
              <div class="result-group">
                <div class="group-header">
                  <component :is="getCategoryIcon(group.category)" />
                  {{ group.category }}
                </div>
                <div
                  v-for="(item, idx) in group.items"
                  :key="item.id"
                  class="result-item"
                  :class="{ selected: flatItems.indexOf(item) === selectedIndex }"
                  @click="selectItem(item)"
                  @mouseenter="selectedIndex = flatItems.indexOf(item)"
                >
                  <component :is="item.icon" class="item-icon" />
                  <div class="item-content">
                    <span class="item-label">{{ item.label }}</span>
                    <span v-if="item.description" class="item-description">{{ item.description }}</span>
                  </div>
                </div>
              </div>
            </template>
          </template>
          <div v-else class="no-results">
            <SearchOutlined />
            <span>{{ t.noResultsFound }}</span>
          </div>
        </div>
        <div class="palette-footer">
          <span class="footer-hint"><kbd>↑↓</kbd> {{ t.navigateHint }}</span>
          <span class="footer-hint"><kbd>↵</kbd> {{ t.selectHint }}</span>
          <span class="footer-hint"><kbd>Esc</kbd> {{ t.closeHint }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.command-palette-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  z-index: 10000;
}

.command-palette {
  width: 600px;
  max-width: 90vw;
  max-height: 70vh;
  background: var(--bg-base);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.palette-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-base);
  gap: 12px;
}

.search-icon {
  color: var(--text-secondary);
  font-size: 16px;
  flex-shrink: 0;
}

.palette-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  color: var(--text-primary);
  outline: none;
}

.palette-input::placeholder {
  color: var(--text-secondary);
}

.palette-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-muted);
  padding: 2px 6px;
  border-radius: 4px;
}

.palette-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.result-group {
  margin-bottom: 8px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
}

.result-item:hover,
.result-item.selected {
  background: var(--accent-soft-bg);
}

.result-item.selected {
  outline: 1px solid var(--accent);
}

.item-icon {
  font-size: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.item-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.item-label {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-description {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px;
  color: var(--text-secondary);
}

.palette-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 8px;
  border-top: 1px solid var(--border-base);
  background: var(--bg-subtle);
}

.footer-hint {
  font-size: 11px;
  color: var(--text-secondary);
}

.footer-hint kbd {
  display: inline-block;
  padding: 1px 4px;
  background: var(--bg-muted);
  border-radius: 3px;
  font-family: inherit;
  font-size: 10px;
  margin-right: 4px;
}
</style>
