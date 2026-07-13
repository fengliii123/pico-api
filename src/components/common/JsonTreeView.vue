<script setup lang="ts">
// JSON Tree View component for collapsible JSON visualization
// Supports expand/collapse all, search within JSON, copy path

import { computed, ref, watch } from 'vue'
import { Button, Input, Tooltip } from 'ant-design-vue'
import { ExpandOutlined, ShrinkOutlined, CopyOutlined, SearchOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  data: any
}>()

interface TreeNode {
  key: string
  value: any
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  path: string
  depth: number
  collapsed?: boolean
}

const allCollapsed = ref(false)
const searchQuery = ref('')
const copiedPath = ref<string | null>(null)

function getType(value: any): TreeNode['type'] {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value as TreeNode['type']
}

function buildTree(data: any, path: string = '', depth: number = 0): TreeNode[] {
  const nodes: TreeNode[] = []
  const type = getType(data)

  if (type === 'object' && data !== null) {
    const keys = Object.keys(data)
    nodes.push({
      key: path || 'root',
      value: data,
      type,
      path,
      depth,
      collapsed: allCollapsed.value
    })
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key
      nodes.push(...buildTree(data[key], childPath, depth + 1))
    }
  } else if (type === 'array') {
    nodes.push({
      key: path || 'root',
      value: data,
      type,
      path,
      depth,
      collapsed: allCollapsed.value
    })
    data.forEach((item: any, index: number) => {
      const childPath = `${path}[${index}]`
      nodes.push(...buildTree(item, childPath, depth + 1))
    })
  } else {
    nodes.push({
      key: path,
      value: data,
      type,
      path,
      depth
    })
  }

  return nodes
}

const treeData = computed(() => buildTree(props.data))

const collapsedKeys = ref<Set<string>>(new Set())

function toggleCollapse(key: string) {
  if (collapsedKeys.value.has(key)) {
    collapsedKeys.value.delete(key)
  } else {
    collapsedKeys.value.add(key)
  }
  collapsedKeys.value = new Set(collapsedKeys.value)
}

function expandAll() {
  collapsedKeys.value = new Set()
  allCollapsed.value = false
}

function collapseAll() {
  allCollapsed.value = true
  collapsedKeys.value = new Set()
}

function isCollapsed(key: string): boolean {
  return collapsedKeys.value.has(key)
}

async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path)
    copiedPath.value = path
    setTimeout(() => { copiedPath.value = null }, 1500)
  } catch {
    // ignore
  }
}

// Filter nodes based on search query
const filteredNodes = computed(() => {
  if (!searchQuery.value.trim()) return treeData.value

  const q = searchQuery.value.toLowerCase()
  return treeData.value.filter(node => {
    const pathMatch = node.path.toLowerCase().includes(q)
    const valueMatch = String(node.value).toLowerCase().includes(q)
    return pathMatch || valueMatch
  })
})

function formatValue(node: TreeNode): string {
  switch (node.type) {
    case 'string':
      return `"${node.value}"`
    case 'null':
      return 'null'
    case 'boolean':
    case 'number':
      return String(node.value)
    case 'object':
      return `{${Object.keys(node.value).length}}`
    case 'array':
      return `[${node.value.length}]`
    default:
      return String(node.value)
  }
}

function getValueClass(node: TreeNode): string {
  switch (node.type) {
    case 'string': return 'json-string'
    case 'number': return 'json-number'
    case 'boolean': return 'json-boolean'
    case 'null': return 'json-null'
    default: return ''
  }
}

// Check if node is a container (object or array)
function isContainer(node: TreeNode): boolean {
  return node.type === 'object' || node.type === 'array'
}

// Get the display key (without root)
function getDisplayKey(path: string): string {
  if (!path) return ''
  const parts = path.split('.')
  return parts[parts.length - 1]
}

// Check if we should render this node (parent must be expanded)
function shouldRender(node: TreeNode): boolean {
  if (node.depth === 0) return true

  // Find parent key
  const pathParts = node.path.split(/[.[\]_]/)
  pathParts.pop()
  let parentKey = pathParts.join('.')

  // Handle array indices
  parentKey = parentKey.replace(/\[\d+\]/g, (m) => `.${m.slice(1, -1)}`)

  return !isCollapsed(parentKey)
}

// Count children
function countChildren(node: TreeNode): { objects: number; arrays: number; primitives: number } {
  if (!isContainer(node)) return { objects: 0, arrays: 0, primitives: 1 }

  let objects = 0, arrays = 0, primitives = 0
  const children = treeData.value.filter(n => {
    const nodeParent = n.path.split(/[.[\]_]/).slice(0, -1).join('.')
    return nodeParent === node.path || n.path.startsWith(node.path + '.') || n.path.startsWith(node.path + '[')
  })

  for (const child of children) {
    if (child.depth === node.depth) continue
    if (child.type === 'object') objects++
    else if (child.type === 'array') arrays++
    else primitives++
  }

  return { objects, arrays, primitives }
}

// Collapse to specific depth
function collapseToDepth(maxDepth: number) {
  allCollapsed.value = false
  const keysToCollapse = new Set<string>()

  for (const node of treeData.value) {
    if (node.depth >= maxDepth && isContainer(node)) {
      keysToCollapse.add(node.path)
    }
  }

  collapsedKeys.value = keysToCollapse
}
</script>

<template>
  <div class="json-tree">
    <div class="json-tree-toolbar">
      <Input
        v-model:value="searchQuery"
        placeholder="Search keys or values..."
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
          Expand
        </Button>
        <Button size="small" @click="collapseAll">
          <template #icon><ShrinkOutlined /></template>
          Collapse
        </Button>
      </div>
    </div>
    <div class="json-tree-content">
      <template v-for="node in filteredNodes" :key="node.path">
        <div
          v-if="shouldRender(node)"
          class="json-node"
          :style="{ paddingLeft: node.depth * 16 + 'px' }"
        >
          <template v-if="isContainer(node)">
            <div class="json-container-row" @click="toggleCollapse(node.path)">
              <span class="json-toggle">
                {{ isCollapsed(node.path) ? '▶' : '▼' }}
              </span>
              <span class="json-key">{{ getDisplayKey(node.path) || 'root' }}</span>
              <span class="json-bracket">{{ node.type === 'array' ? '[' : '{' }}</span>
              <span v-if="isCollapsed(node.path)" class="json-preview">
                {{ formatValue(node) }}
              </span>
              <span class="json-bracket">{{ node.type === 'array' ? ']' : '}' }}</span>
            </div>
          </template>
          <template v-else>
            <div class="json-value-row">
              <span class="json-key">{{ getDisplayKey(node.path) || 'root' }}</span>
              <span class="json-colon">:</span>
              <span :class="['json-value', getValueClass(node)]">{{ formatValue(node) }}</span>
              <Tooltip :title="copiedPath === node.path ? 'Copied!' : 'Copy path'">
                <Button
                  size="small"
                  type="text"
                  class="copy-path-btn"
                  @click.stop="copyPath(node.path)"
                >
                  <template #icon>
                    <CopyOutlined :style="{ color: copiedPath === node.path ? 'var(--status-success)' : 'var(--text-tertiary)' }" />
                  </template>
                </Button>
              </Tooltip>
            </div>
          </template>
        </div>
      </template>
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

.json-node {
  white-space: nowrap;
}

.json-container-row {
  cursor: pointer;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.json-container-row:hover {
  background: var(--accent-soft-bg);
  margin: 0 calc(-1 * var(--space-5));
  padding: 0 var(--space-5);
}

.json-value-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.json-toggle {
  width: 14px;
  color: var(--text-tertiary);
  font-size: 10px;
  flex-shrink: 0;
}

.json-key {
  color: var(--code-key);
}

.json-colon {
  color: var(--text-tertiary);
}

.json-bracket {
  color: var(--text-tertiary);
}

.json-preview {
  color: var(--text-secondary);
  font-style: italic;
}

.json-value {
  flex-shrink: 0;
}

.json-string {
  color: var(--status-success);
}

.json-number {
  color: var(--tag-warning-fg);
}

.json-boolean {
  color: var(--tag-danger-fg);
}

.json-null {
  color: var(--text-tertiary);
  font-style: italic;
}

.copy-path-btn {
  padding: 0 var(--space-1) !important;
  height: 20px !important;
  opacity: 0;
  transition: opacity 0.15s;
}

.json-node:hover .copy-path-btn {
  opacity: 1;
}
</style>
