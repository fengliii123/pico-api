<script setup lang="ts">
// One node of the lazy JSON tree. Children are enumerated and rendered
// ONLY while the node is expanded — a 100k-node document costs nothing
// until the user drills into it. Communicates with the root JsonTreeView
// via provide/inject (expansion set + search visibility set).

import { computed, inject } from 'vue'
import { Button, Tooltip } from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import { lastSegment } from '@/core/jsonTree'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()

const props = defineProps<{
  nodeKey: string
  value: unknown
  path: string
  depth: number
}>()

type TreeCtx = {
  isExpanded: (path: string) => boolean
  toggle: (path: string) => void
  isVisible: (path: string) => boolean
  copyPath: (path: string) => void
  copiedPath: () => string | null
}
const ctx = inject<TreeCtx>('jsonTreeCtx')

const isContainer = computed(() => props.value !== null && typeof props.value === 'object')
const expanded = computed(() => ctx?.isExpanded(props.path) ?? false)
const visible = computed(() => ctx?.isVisible(props.path) ?? true)

// One level of children — only computed when rendered (i.e. expanded).
const children = computed(() => {
  if (!isContainer.value) return []
  const v = props.value as Record<string, unknown> | unknown[]
  if (Array.isArray(v)) {
    return v.map((item, i) => ({ key: `${props.nodeKey}[${i}]`, value: item, path: `${props.path}[${i}]` }))
  }
  return Object.entries(v).map(([k, val]) => ({
    key: k,
    value: val,
    path: props.path ? `${props.path}.${k}` : k
  }))
})

const displayKey = computed(() => props.nodeKey || 'root')

const preview = computed(() => {
  if (!isContainer.value) return ''
  return Array.isArray(props.value)
    ? `[${(props.value as unknown[]).length}]`
    : `{${Object.keys(props.value as object).length}}`
})

const valueClass = computed(() => {
  if (props.value === null) return 'json-null'
  switch (typeof props.value) {
    case 'string': return 'json-string'
    case 'number': return 'json-number'
    case 'boolean': return 'json-boolean'
    default: return ''
  }
})

const valueText = computed(() => {
  if (props.value === null) return 'null'
  if (typeof props.value === 'string') return `"${props.value}"`
  return String(props.value)
})
</script>

<template>
  <div v-if="visible" class="json-node" :style="{ paddingLeft: depth * 16 + 'px' }">
    <div v-if="isContainer" class="json-container-row" @click="ctx?.toggle(path)">
      <span class="json-toggle">{{ expanded ? '▼' : '▶' }}</span>
      <span class="json-key">{{ displayKey }}</span>
      <span class="json-bracket">{{ Array.isArray(value) ? '[' : '{' }}</span>
      <span v-if="!expanded" class="json-preview">{{ preview }}</span>
      <span v-else class="json-bracket-children">{{ Array.isArray(value) ? '[' : '{' }}</span>
      <span v-if="!expanded" class="json-bracket">{{ Array.isArray(value) ? ']' : '}' }}</span>
    </div>
    <div v-else class="json-value-row">
      <span class="json-key">{{ displayKey }}</span>
      <span class="json-colon">:</span>
      <span :class="['json-value', valueClass]">{{ valueText }}</span>
      <Tooltip :title="ctx?.copiedPath() === path ? t.copied : t.copyPath">
        <Button
          size="small"
          type="text"
          class="copy-path-btn"
          @click.stop="ctx?.copyPath(path)"
        >
          <template #icon>
            <CopyOutlined :style="{ color: ctx?.copiedPath() === path ? 'var(--status-success)' : 'var(--text-tertiary)' }" />
          </template>
        </Button>
      </Tooltip>
    </div>
    <template v-if="isContainer && expanded">
      <JsonTreeNode
        v-for="child in children"
        :key="child.path"
        :node-key="child.key"
        :value="child.value"
        :path="child.path"
        :depth="depth + 1"
      />
      <div class="json-closing" :style="{ paddingLeft: depth * 16 + 'px' }">
        <span class="json-toggle close-spacer"> </span>
        <span class="json-bracket">{{ Array.isArray(value) ? ']' : '}' }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.json-node {
  white-space: nowrap;
}
.json-container-row,
.json-value-row {
  cursor: pointer;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
}
.json-value-row { cursor: default; }
.json-container-row:hover {
  background: var(--accent-soft-bg);
}
.json-toggle {
  width: 14px;
  color: var(--text-tertiary);
  font-size: 10px;
  flex-shrink: 0;
}
.json-key { color: var(--code-key); }
.json-colon { color: var(--text-tertiary); }
.json-bracket, .json-bracket-children { color: var(--text-tertiary); }
.json-preview {
  color: var(--text-secondary);
  font-style: italic;
}
.json-value { flex-shrink: 0; }
.json-string { color: var(--status-success); }
.json-number { color: var(--tag-warning-fg); }
.json-boolean { color: var(--tag-danger-fg); }
.json-null { color: var(--text-tertiary); font-style: italic; }
.json-closing {
  display: flex;
  align-items: center;
}
.close-spacer { width: 14px; flex-shrink: 0; }
.copy-path-btn {
  padding: 0 var(--space-1, 4px) !important;
  height: 20px !important;
  opacity: 0;
  transition: opacity 0.15s;
}
.json-node:hover .copy-path-btn { opacity: 1; }
</style>
