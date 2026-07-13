<script setup lang="ts">
// Environment management modal. Master-detail layout:
//   - left: list of environments + Globals
//   - right: KeyValueTable for the selected item
//
// We reuse KeyValueTable (with rowKind=undefined so it shows plain inputs,
// no header-autocomplete) since EnvironmentVariable's shape matches
// KeyValueRow.

import { computed, ref, watch } from 'vue'
import { Modal, Button, Input, Empty, message, Upload } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined, GlobalOutlined, SettingOutlined, UploadOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { useEnvironmentStore } from '@/stores/environment'
import KeyValueTable from '@/components/request/KeyValueTable.vue'
import { downloadTextFile } from '@/utils/download'
import type { KeyValueRow, EnvironmentVariable } from '@/core/types'
import { useI18n } from '@/i18n/useI18n'
import { fmt } from '@/i18n'

const { t } = useI18n()
const open = defineModel<boolean>('open', { default: false })

const envStore = useEnvironmentStore()

// Selection state inside the modal. '__globals__' is a sentinel for the
// Globals tab; otherwise it's an environment id. Persists across modal
// reopens but resets to Globals if the selected env gets deleted.
const selectedId = ref<string | null>(null)

// When opening, default-select the active environment (or Globals) so the
// user sees something useful immediately.
watch(open, (v) => {
  if (v && selectedId.value === null) {
    selectedId.value = envStore.activeEnvironmentId ?? '__globals__'
  }
})

const selectedEnv = computed(() =>
  selectedId.value && selectedId.value !== '__globals__'
    ? envStore.environments.find(e => e.id === selectedId.value)
    : undefined
)

const isGlobals = computed(() => selectedId.value === '__globals__')

// Make a defensive copy for the KeyValueTable; the table emits full row
// arrays on every edit, so we don't need a deep reactive clone.
const tableRows = computed<KeyValueRow[]>(() => {
  if (isGlobals.value) {
    return envStore.globals.variables.map(v => ({ ...v }))
  }
  if (selectedEnv.value) {
    return selectedEnv.value.variables.map(v => ({ ...v }))
  }
  return []
})

function rowsToVars(rows: KeyValueRow[]): EnvironmentVariable[] {
  return rows.map(r => ({ key: r.key, value: r.value, enabled: r.enabled }))
}

function onUpdate(rows: KeyValueRow[]) {
  const vars = rowsToVars(rows)
  if (isGlobals.value) {
    envStore.updateGlobals(vars)
  } else if (selectedEnv.value) {
    envStore.updateEnvironmentVariables(selectedEnv.value.id, vars)
  }
}

async function newEnvironment() {
  const n = envStore.environments.length + 1
  const e = await envStore.createEnvironment(`Environment ${n}`)
  selectedId.value = e.id
}

async function deleteCurrent() {
  if (!selectedEnv.value) return
  const id = selectedEnv.value.id
  const name = selectedEnv.value.name
  Modal.confirm({
    title: fmt(t.value.deleteEnvironmentTitle, { name }),
    content: t.value.deleteEnvironmentContent,
    okText: t.value.delete,
    okType: 'danger',
    cancelText: t.value.cancel,
    async onOk() {
      await envStore.deleteEnvironment(id)
      selectedId.value = '__globals__'
      message.success(t.value.deleted)
    }
  })
}

function onRename(e: Event) {
  if (!selectedEnv.value) return
  const v = (e.target as HTMLInputElement).value
  envStore.renameEnvironment(selectedEnv.value.id, v || 'Untitled')
}

function parseEnvFile(content: string): KeyValueRow[] {
  const lines = content.split('\n')
  const rows: KeyValueRow[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Handle: KEY=value, KEY="value", KEY='value'
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()

      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      if (key) {
        rows.push({ key, value, enabled: true })
      }
    }
  }

  return rows
}

function parseJsonVariables(content: string): KeyValueRow[] {
  try {
    const obj = JSON.parse(content)
    const rows: KeyValueRow[] = []

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        rows.push({ key, value: String(value), enabled: true })
      }
    }

    return rows
  } catch {
    return []
  }
}

async function handleImport(file: File) {
  try {
    const content = await file.text()
    let rows: KeyValueRow[] = []

    if (file.name.endsWith('.env')) {
      rows = parseEnvFile(content)
    } else if (file.name.endsWith('.json')) {
      rows = parseJsonVariables(content)
    } else {
      // Try both formats
      rows = parseEnvFile(content)
      if (rows.length === 0) {
        rows = parseJsonVariables(content)
      }
    }

    if (rows.length === 0) {
      message.warning(t.value.noValidVariablesInFile)
      return
    }

    // Merge with existing variables
    const existingKeys = new Set(tableRows.value.map(r => r.key))
    const newRows = [...tableRows.value]

    for (const row of rows) {
      if (!existingKeys.has(row.key)) {
        newRows.push(row)
      }
    }

    onUpdate(newRows)
    message.success(fmt(t.value.importedVariablesCount, { n: rows.length }))
  } catch {
    message.error(t.value.failedToImportFile)
  }
}

function exportVariables() {
  const vars = tableRows.value
  if (vars.length === 0) {
    message.warning(t.value.noVariablesToExport)
    return
  }

  const lines = vars
    .filter(v => v.key.trim())
    .map(v => `${v.key}=${v.value}`)
    .join('\n')

  downloadTextFile(`${selectedEnv.value?.name || 'globals'}.env`, lines, 'text/plain')
  message.success(t.value.exportedEnvFile)
}

function exportAsJson() {
  const vars = tableRows.value
  if (vars.length === 0) {
    message.warning(t.value.noVariablesToExport)
    return
  }

  const obj: Record<string, string> = {}
  for (const v of vars) {
    if (v.key.trim()) {
      obj[v.key] = v.value
    }
  }

  downloadTextFile(`${selectedEnv.value?.name || 'globals'}.json`, JSON.stringify(obj, null, 2), 'application/json')
  message.success(t.value.exportedJsonFile)
}

// Avoid writing `{{ '{{key}}' }}` in the template — Vue's parser chokes on
// the nested interpolation. Bind the literal through a constant instead.
const KEY_HINT = '{{key}}'
</script>

<template>
  <Modal
    :open="open"
    :title="t.manageEnvironments"
    width="1000px"
    :footer="null"
    @cancel="open = false"
  >
    <div class="env-modal">
      <aside class="env-list">
        <div class="env-list-header">
          <Button size="small" type="primary" ghost block @click="newEnvironment">
            <template #icon><PlusOutlined /></template>
            {{ t.new }}
          </Button>
        </div>
        <div class="env-list-body">
          <div
            v-for="e in envStore.environments"
            :key="e.id"
            class="env-list-item"
            :class="{ active: selectedId === e.id }"
            @click="selectedId = e.id"
          >
            <GlobalOutlined />
            <span class="env-list-name">{{ e.name }}</span>
          </div>
          <div class="env-list-divider" />
          <div
            class="env-list-item"
            :class="{ active: isGlobals }"
            @click="selectedId = '__globals__'"
          >
            <SettingOutlined />
            <span class="env-list-name">{{ t.globals }}</span>
          </div>
        </div>
      </aside>

      <div class="env-editor">
        <template v-if="isGlobals">
          <div class="env-editor-header">
            <div class="env-header-row">
              <div>
                <h4>{{ t.globals }}</h4>
                <span class="env-editor-sub">{{ t.globalsDescription }}</span>
              </div>
              <div class="env-actions">
                <Upload
                  :before-upload="(file) => { handleImport(file); return false }"
                  :show-upload-list="false"
                  accept=".env,.json"
                >
                  <Button size="small">
                    <template #icon><UploadOutlined /></template>
                    Import
                  </Button>
                </Upload>
                <Button size="small" @click="exportVariables">
                  <template #icon><CopyOutlined /></template>
                  .env
                </Button>
                <Button size="small" @click="exportAsJson">
                  JSON
                </Button>
              </div>
            </div>
          </div>
          <KeyValueTable
            :rows="tableRows"
            :key-width="160"
            :disable-drag="true"
            :key-placeholder="t.variableName"
            :value-placeholder="t.value"
            :empty-hint="t.noGlobalsHint"
            @update="onUpdate"
          />
        </template>

        <template v-else-if="selectedEnv">
          <div class="env-editor-header">
            <div class="env-title-row">
              <Input
                :value="selectedEnv.name"
                class="env-name-input"
                @change="onRename"
              />
              <Button danger type="text" @click="deleteCurrent">
                <template #icon><DeleteOutlined /></template>
                {{ t.delete }}
              </Button>
            </div>
            <div class="env-header-row">
              <span class="env-editor-sub">
                <code>{{ KEY_HINT }}</code> {{ t.variableUsageHint }}
              </span>
              <div class="env-actions">
                <Upload
                  :before-upload="(file) => { handleImport(file); return false }"
                  :show-upload-list="false"
                  accept=".env,.json"
                >
                  <Button size="small">
                    <template #icon><UploadOutlined /></template>
                    Import
                  </Button>
                </Upload>
                <Button size="small" @click="exportVariables">
                  <template #icon><CopyOutlined /></template>
                  .env
                </Button>
                <Button size="small" @click="exportAsJson">
                  JSON
                </Button>
              </div>
            </div>
          </div>
          <KeyValueTable
            :rows="tableRows"
            :key-width="160"
            :disable-drag="true"
            :key-placeholder="t.variableName"
            :value-placeholder="t.value"
            :empty-hint="t.noVariablesHint"
            @update="onUpdate"
          />
        </template>

        <div v-else class="env-editor-empty">
          <Empty :description="t.selectEnvironmentHint" />
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.env-modal {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  min-height: 420px;
}
.env-list {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #f0f0f0;
  padding-right: 12px;
}
.env-list-header {
  padding-bottom: 8px;
}
.env-list-body {
  flex: 1;
  overflow-y: auto;
}
.env-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  color: #374151;
  user-select: none;
}
.env-list-item:hover { background: #f0f5ff; }
.env-list-item.active {
  background: #e6f4ff;
  color: #0958d9;
  font-weight: 500;
}
.env-list-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.env-list-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 8px 0;
}
.env-editor { display: flex; flex-direction: column; min-width: 0; }
.env-editor-header {
  margin-bottom: 8px;
}
.env-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.env-title-row h4 { margin: 0; }
.env-name-input { flex: 1; max-width: 320px; }
.env-editor h4 { margin: 0; font-size: 14px; font-weight: 600; }
.env-editor-sub {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.env-editor-sub code {
  background: #f0f0f0;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 11px;
}
.env-editor-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.env-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.env-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
</style>
