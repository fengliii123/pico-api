<script setup lang="ts">
// JSON Tree View — lazy rendering edition.
//
// The old implementation flattened the whole document into one array and
// rendered every node (with a 10k-node kill switch). This version keeps a
// shared expansion Set and materializes children only while expanded, so
// arbitrarily large JSON opens instantly collapsed-by-default (first two
// levels open). Search uses core/jsonTree helpers and auto-expands the
// ancestors of every hit.

import { computed, provide, ref, watch } from 'vue'
import { Button, Input, message } from 'ant-design-vue'
import { ExpandOutlined, ShrinkOutlined, SearchOutlined } from '@ant-design/icons-vue'
import JsonTreeNode from './JsonTreeNode.vue'
import { defaultExpandedPaths, visiblePathsFor } from '@/core/jsonTree'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()

const props = defineProps<{
  data: any
}>()

const searchQuery = ref('')
const copiedPath = ref<string | null>(null)

const expandedKeys = ref<Set<string>>(new Set())

// Re-seed default expansion whenever a new response arrives.
watch(
  () => props.data,
  (v) => {
    searchQuery.value = ''
    expandedKeys.value = new Set(defaultExpandedPaths(v, 2))
  },
  { immediate: true }
)

// Search: matched paths + ancestors stay visible and get expanded.
const visibleSet = computed<Set<string> | null>(() => {
  if (!searchQuery.value.trim()) return null
  const vis = visiblePathsFor(props.data, searchQuery.value)
  if (vis && vis.size > 0) {
    const expanded = new Set(expandedKeys.value)
    for (const p of vis) {
      if (isContainerPath(p)) expanded.add(p)
    }
    expandedKeys.value = expanded
  }
  return vis
})

function isContainerPath(path: string): boolean {
  let cur: any = props.data
  if (!path) return cur !== null && typeof cur === 'object'
  for (const raw of path.split(/(?=[.[])/)) {
    const seg = raw.replace(/^[.]/, '')
    if (seg.startsWith('[')) {
      cur = cur?.[Number(seg.slice(1, -1))]
    } else {
      cur = cur?.[seg]
    }
    if (cur === undefined || cur === null) return false
  }
  return typeof cur === 'object' && cur !== null
}

function toggle(path: string) {
  const next = new Set(expandedKeys.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  expandedKeys.value = next
}

function expandAll() {
  // Deliberately materializes everything — user-initiated, may be slow on
  // very large documents (that's the trade for unlimited depth).
  const all = new Set<string>()
  const walk = (v: any, path: string) => {
    if (v === null || typeof v !== 'object') return
    if (path) all.add(path)
    if (Array.isArray(v)) v.forEach((item: any, i: number) => walk(item, `${path}[${i}]`))
    else for (const [k, child] of Object.entries(v)) walk(child, path ? `${path}.${k}` : k)
  }
  walk(props.data, '')
  expandedKeys.value = all
}

function collapseAll() {
  expandedKeys.value = new Set()
}

async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path)
    copiedPath.value = path
    setTimeout(() => { copiedPath.value = null }, 1500)
  } catch {
    message.error(t.value.clipboardWriteFailed)
  }
}

provide('jsonTreeCtx', {
  isExpanded: (p: string) => expandedKeys.value.has(p),
  toggle,
  isVisible: (p: string) => visibleSet.value === null || visibleSet.value.has(p),
  copyPath,
  copiedPath: () => copiedPath.value
})
</script>

<template>
  <div class="json-tree">
    <div class="json-tree-toolbar">
      <Input
        v-model:value="searchQuery"
        :placeholder="t.jsonSearchPlaceholder"
        size="small"
        allow-clear
        style="width: 200px"
      >
        <template #prefix>
          <SearchOutlined style="color: var(--text-secondary); font-size: 12px" />
        </template>
      </Input>
      <div class="toolbar-actions">
        <Button size="small" @click="expandAll">
          <template #icon><ExpandOutlined /></template>
          {{ t.expandAllBtn }}
        </Button>
        <Button size="small" @click="collapseAll">
          <template #icon><ShrinkOutlined /></template>
          {{ t.collapseAllBtn }}
        </Button>
      </div>
    </div>
    <div class="json-tree-content">
      <JsonTreeNode :node-key="''" :value="data" path="" :depth="0" />
    </div>
  </div>
</template>

<style scoped>
/* JsonTreeView sits inside ResponsePanel's .code-wrap, which already
 * paints --code-bg + border + shadow. We just need a transparent surface
 * here so the parent's "code panel" identity carries through. Tokens
 * drive all colors so the tree follows light/eye/dark automatically. */
.json-tree {
  background: transparent;
  overflow: hidden;
}

.json-tree-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-5);
  background: var(--code-toolbar-bg);
  border-bottom: 1px solid var(--code-border);
}

.toolbar-actions {
  display: flex;
  gap: var(--space-1);
}

.json-tree-content {
  padding: var(--space-3) var(--space-5);
  max-height: 50vh;
  overflow: auto;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
}
</style>
