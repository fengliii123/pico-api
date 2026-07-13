<script setup lang="ts">
// Collection tree (left sidebar):
//  - folder nodes: contain sub-folders and saved requests
//  - request nodes: leafs
//  - right-click context menu: new subfolder / rename / delete (folders),
//    rename / delete / duplicate (requests)
//  - drag-and-drop reorder and move between folders, with 5-level depth guard
//  - top-right buttons + toolbar provide first-class folder/request creation

import { computed, h, ref, watch } from 'vue'
import { Tree, Modal, Input, Button, message, Dropdown, Menu } from 'ant-design-vue'
import {
  FolderOutlined,
  FolderAddOutlined,
  FileAddOutlined
} from '@ant-design/icons-vue'
import { useCollectionStore, MAX_DEPTH } from '@/stores/collection'
import { useRequestStore } from '@/stores/request'
import { useEnvironmentStore } from '@/stores/environment'
import { savedToCurl } from '@/core/curl'
import { exportOpenApi } from '@/core/openapi/export'
import { deepClone } from '@/utils/clone'
import { downloadTextFile } from '@/utils/download'
import { methodColor } from '@/utils/methodColors'
import TreeContextMenu from './TreeContextMenu.vue'
import {
  buildTree,
  folderIdFromKey,
  isFolderKey,
  isRequestKey,
  requestIdFromKey
} from './treeUtils'
import type { VNode } from 'vue'
import { useI18n } from '@/i18n/useI18n'
import { fmt } from '@/i18n'

const { t } = useI18n()
const collStore = useCollectionStore()
const reqStore = useRequestStore()
const envStore = useEnvironmentStore()

const treeData = computed(() =>
  buildTree(collStore.folderList, collStore.requestList)
)

// Track which folder nodes are expanded. The Tree component is uncontrolled
// by default — meaning a newly-created child folder is hidden until the user
// manually clicks the expand caret on its parent. To make right-click "New
// subfolder" / "New request" actually visible, we manage expandedKeys
// ourselves and auto-expand any folder whose ancestors we just created into.
const expandedKeys = ref<Set<string>>(new Set())

function expandAncestorsOf(folderId: string) {
  let cur: string | null | undefined = folderId
  while (cur) {
    expandedKeys.value.add(`folder:${cur}`)
    const f = collStore.foldersById.get(cur)
    cur = f?.parentId ?? null
  }
  // Force reactivity: Set mutations don't trigger ref recompute.
  expandedKeys.value = new Set(expandedKeys.value)
}

function onExpand(keys: (string | number)[]) {
  expandedKeys.value = new Set(keys.map(String))
}

// Auto-expand root folders on first paint so the user can see what they have.
watch(
  () => collStore.folderList,
  (list) => {
    if (expandedKeys.value.size === 0) {
      for (const f of list) {
        if (f.parentId === null) expandedKeys.value.add(`folder:${f.id}`)
      }
      expandedKeys.value = new Set(expandedKeys.value)
    }
  },
  { immediate: true }
)

const expandedKeysArr = computed(() => [...expandedKeys.value])

// AntD 4.x doesn't pass the AntTreeNode as `data`; we receive it as the
// first arg. To distinguish folder nodes from request nodes we look at
// the AntTreeNode's `isLeaf` flag.
// Build a short URL preview (scheme + host + first path segment).
function urlPreview(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname
    const trimmed = path.length > 28 ? path.slice(0, 25) + '…' : path
    return `${u.host}${trimmed}`
  } catch {
    return url.length > 32 ? url.slice(0, 29) + '…' : url
  }
}

const titleRender = (dataRef: any): VNode => {
  // dataRef is the AntTreeNode from treeUtils.ts: { key, title, isLeaf, node }
  // where node is either { kind:'folder', folder } or { kind:'request', request }.
  if (dataRef.isLeaf && dataRef.node.kind === 'request') {
    const r = dataRef.node.request
    const method = (r.method || 'GET').toUpperCase()
    const color = methodColor(method)

    return h('span', { class: 'tree-row request-row' }, [
      h('span', { class: 'tree-method-tag', style: { color } }, method),
      h('span', { class: 'tree-row-label request-label', title: r.url || undefined }, r.name || t.value.unnamedRequest)
    ])
  }
  // Folder: dataRef.node.kind === 'folder', or anything else we treat as folder.
  const f = dataRef.node.folder
  return h('span', { class: 'tree-row folder-row' }, [
    h(FolderOutlined, { class: 'tree-icon folder-icon' }),
    h('span', { class: 'tree-row-label folder-label' }, f.name)
  ])
}

// Selecting a tree node:
//   - request → load that saved request into the editor
//   - folder  → just highlight it (visual selection). The user's currently
//     edited draft is preserved. To save the draft to that folder, the user
//     clicks Save (or "Save to...").
const onSelect = (keys: (string | number)[]) => {
  const key = keys[0] as string | undefined
  if (!key) return
  if (isRequestKey(key)) {
    const r = collStore.requestsById.get(requestIdFromKey(key))
    if (r) {
      reqStore.loadFromSaved(r)
    }
  }
  // folder selection intentionally does nothing here — see comment above.
}

//
// AntD Tree 4.x emits a "rightClick" event that gives us the node's key in the
// event object. We used to rely on reading data-* attrs off the rendered DOM,
// but those aren't reliably set by AntD 4.x, so the old approach silently
// fell back to the root menu for every right-click. The handler below
// receives keys directly from AntD, so it always knows which folder/request
// was clicked.

type ContextMenuState = {
  visible: boolean
  x: number
  y: number
  kind: 'folder' | 'request' | 'root'
  targetId: string | null
}

const ctx = ref<ContextMenuState>({ visible: false, x: 0, y: 0, kind: 'root', targetId: null })

function showFolderMenu(e: { event: MouseEvent; node: any }, folderId: string) {
  e.event.preventDefault()
  ctx.value = {
    visible: true,
    x: e.event.clientX,
    y: e.event.clientY,
    kind: 'folder',
    targetId: folderId
  }
}
function showRequestMenu(e: { event: MouseEvent; node: any }, requestId: string) {
  e.event.preventDefault()
  ctx.value = {
    visible: true,
    x: e.event.clientX,
    y: e.event.clientY,
    kind: 'request',
    targetId: requestId
  }
}
function showRootMenu(e: MouseEvent) {
  e.preventDefault()
  ctx.value = { visible: true, x: e.clientX, y: e.clientY, kind: 'root', targetId: null }
}
function closeMenu() {
  ctx.value = { visible: false, x: 0, y: 0, kind: 'root', targetId: null }
}

// AntD Tree's rightClick handler. Receives { event, node } where node has
// .key. We translate the "folder:xxx" / "request:xxx" key back into the
// underlying id and dispatch to the right menu.
function onTreeRightClick(info: { event: MouseEvent; node: any }) {
  const key = info.node?.key as string | undefined
  if (!key) return
  if (isFolderKey(key)) showFolderMenu(info, folderIdFromKey(key))
  else if (isRequestKey(key)) showRequestMenu(info, requestIdFromKey(key))
}

function onContainerContextMenu(e: MouseEvent) {
  // Only fall back to root menu when the right-click did NOT land on a
  // tree node (AntD's onRightClick has already handled that case).
  if ((e.target as HTMLElement).closest('.ant-tree-treenode')) return
  showRootMenu(e)
}


type PromptState = {
  visible: boolean
  title: string
  initialValue: string
  onOk: (value: string) => Promise<void> | void
  validate?: (v: string) => string | null
}

const prompt = ref<PromptState>({
  visible: false,
  title: '',
  initialValue: '',
  onOk: () => {}
})
const promptValue = ref('')

function openPrompt(state: Omit<PromptState, 'visible'>): Promise<string | null> {
  promptValue.value = state.initialValue
  return new Promise((resolve) => {
    let resolved = false
    prompt.value = {
      ...state,
      visible: true,
      onOk: async (v) => {
        await state.onOk(v)
        resolved = true
        resolve(v)
      }
    }
    const stop = watch(
      () => prompt.value.visible,
      (visible) => {
        if (!visible && !resolved) {
          resolve(null)
          stop()
        }
      }
    )
  })
}

async function submitPrompt() {
  const v = promptValue.value.trim()
  const err = prompt.value.validate ? prompt.value.validate(v) : null
  if (err) {
    message.warning(err)
    return
  }
  const cb = prompt.value.onOk
  closePrompt()
  await cb(v)
}
function closePrompt() {
  prompt.value.visible = false
}


async function askNewFolder(parentId: string | null) {
  if (!collStore.canAddChild(parentId)) {
    message.warning(fmt(t.value.maxFolderDepthReached, { n: MAX_DEPTH }))
    return
  }
  await openPrompt({
    title: t.value.newFolder,
    initialValue: t.value.newFolder,
    validate: (v) => {
      if (!v) return t.value.nameRequired
      const clash = collStore.folderList.some(f => f.parentId === parentId && f.name.trim() === v.trim())
      return clash ? t.value.folderNameExists : null
    },
    onOk: async (name) => {
      try {
        const f = await collStore.createFolder(parentId, name)
        expandAncestorsOf(f.id)
      } catch (e: any) {
        message.error(e?.message ?? t.value.couldNotCreateFolder)
        throw e
      }
    }
  })
}

async function askRenameFolder(folderId: string) {
  const f = collStore.foldersById.get(folderId)
  if (!f) return
  await openPrompt({
    title: t.value.renameFolderTitle,
    initialValue: f.name,
    validate: (v) => {
      if (!v) return t.value.nameRequired
      const clash = collStore.folderList.some(x => x.parentId === f.parentId && x.name.trim() === v.trim() && x.id !== folderId)
      return clash ? t.value.folderNameExists : null
    },
    onOk: async (name) => {
      try {
        await collStore.renameFolder(folderId, name)
      } catch (e: any) {
        message.error(e?.message ?? t.value.couldNotRenameFolder)
        throw e
      }
    }
  })
}

async function deleteFolderPrompt(folderId: string) {
  // Refuse to delete a folder that still has children (sub-folders OR
  // requests, at any depth). The user must delete or move them first.
  // Cascading deletes are too easy to trigger by accident and lose work.
  const allFolders = collStore.folderList
  const allRequests = collStore.requestList

  // Set of folder ids that should be considered "this subtree": the
  // folder itself + every descendant folder. We need the folder itself
  // in the set so we count requests that live directly under it.
  const subtreeFolderIds = new Set<string>([folderId])
  let added = true
  while (added) {
    added = false
    for (const f of allFolders) {
      if (f.parentId && subtreeFolderIds.has(f.parentId) && !subtreeFolderIds.has(f.id)) {
        subtreeFolderIds.add(f.id)
        added = true
      }
    }
  }

  const directChildFolders = allFolders.filter(f => f.parentId === folderId).length
  const descendantRequests = allRequests.filter(r => r.folderId !== null && subtreeFolderIds.has(r.folderId)).length
  // Descendant folder count excludes the folder itself.
  const descendantFolderCount = subtreeFolderIds.size - 1
  const childCount = descendantFolderCount + descendantRequests

  if (childCount > 0) {
    Modal.warning({
      title: t.value.cannotDeleteNonEmptyFolder,
      content: t.value.folderContainsContent
    })
    return
  }

  Modal.confirm({
    title: t.value.deleteFolder,
    content: t.value.deleteWarning,
    okText: t.value.delete,
    okType: 'danger',
    onOk: async () => {
      await collStore.deleteFolder(folderId)
      if (reqStore.draft.id) {
        const r = collStore.requestsById.get(reqStore.draft.id)
        if (!r) reqStore.newRequest(null)
      }
    }
  })
}

async function askNewRequest(folderId: string | null) {
  await openPrompt({
    title: t.value.newRequest,
    initialValue: t.value.newRequest,
    validate: (v) => {
      if (!v) return t.value.nameRequired
      const clash = collStore.requestList.some(r => r.folderId === folderId && r.name.trim() === v.trim())
      return clash ? t.value.requestNameExists : null
    },
    onOk: async (name) => {
      try {
        const r = await collStore.createRequest(folderId, { name })
        reqStore.loadFromSaved(r)
        if (folderId) expandAncestorsOf(folderId)
      } catch (e: any) {
        message.error(e?.message ?? t.value.couldNotCreateRequest)
        throw e
      }
    }
  })
}

async function askRenameRequest(requestId: string) {
  const r = collStore.requestsById.get(requestId)
  if (!r) return
  const folderId = r.folderId
  await openPrompt({
    title: t.value.renameRequestTitle,
    initialValue: r.name,
    validate: (v) => {
      if (!v) return t.value.nameRequired
      const clash = collStore.requestList.some(x => x.folderId === folderId && x.name.trim() === v.trim() && x.id !== requestId)
      return clash ? t.value.requestNameExists : null
    },
    onOk: async (name) => {
      try {
        r.name = name
        await collStore.updateRequest(r)
      } catch (e: any) {
        message.error(e?.message ?? t.value.couldNotRenameRequest)
        throw e
      }
    }
  })
}

async function deleteRequestPrompt(requestId: string) {
  Modal.confirm({
    title: t.value.deleteRequest,
    okText: t.value.delete,
    okType: 'danger',
    onOk: async () => {
      await collStore.deleteRequest(requestId)
      if (reqStore.draft.id === requestId) reqStore.newRequest(null)
    }
  })
}

async function duplicateRequest(requestId: string) {
  const r = collStore.requestsById.get(requestId)
  if (!r) return
  await collStore.createRequest(r.folderId, {
    name: r.name + ' Copy',
    method: r.method,
    url: r.url,
    headers: r.headers.map(h => ({ ...h })),
    params: r.params.map(p => ({ ...p })),
    body: deepClone(r.body)
  })
}

function menuNewSubfolder(parentId: string) { closeMenu(); void askNewFolder(parentId) }
function menuNewRequestInFolder(folderId: string) { closeMenu(); void askNewRequest(folderId) }
function menuRenameFolder(id: string) { closeMenu(); void askRenameFolder(id) }
function menuDeleteFolder(id: string) { closeMenu(); void deleteFolderPrompt(id) }
function menuRenameRequest(id: string) { closeMenu(); void askRenameRequest(id) }
function menuDeleteRequest(id: string) { closeMenu(); void deleteRequestPrompt(id) }
function menuDuplicateRequest(id: string) { closeMenu(); void duplicateRequest(id) }

// Quick single-request export: download the request as an OpenAPI 3.0
// document without going through the full ExportModal flow.
function menuExportOpenApi(id: string) {
  closeMenu()
  const saved = collStore.requestsById.get(id)
  if (!saved) {
    message.error(t.value.requestNotFound)
    return
  }
  const json = exportOpenApi({
    scope: 'single',
    title: saved.name,
    requestIds: [saved.id],
    requests: collStore.requestList,
    folders: collStore.folderList
  })
  const safeName = (saved.name || 'request').replace(/[^\w-]+/g, '-')
  downloadTextFile(`${safeName}.openapi.json`, json, 'application/json')
  message.success(t.value.exported)
}

async function menuCopyAsCurl(id: string) {
  closeMenu()
  const saved = collStore.requestsById.get(id)
  if (!saved) {
    message.error(t.value.requestNotFound)
    return
  }
  const cmd = savedToCurl(saved, envStore.activeVariables, envStore.globals.variables)
  try {
    await navigator.clipboard.writeText(cmd)
    message.success(t.value.copied)
  } catch {
    // Fallback for contexts without clipboard permission (older Chrome /
    // non-secure origins). Open a modal with the text so the user can copy
    // manually.
    Modal.info({
      title: t.value.copyAsCurl,
      width: 720,
      content: h('textarea', {
        value: cmd,
        readonly: true,
        style: 'width: 100%; min-height: 240px; font-family: monospace; font-size: 12px;'
      })
    })
  }
}
function menuNewRootFolder() { closeMenu(); void askNewFolder(null) }
function menuNewRootRequest() { closeMenu(); void askNewRequest(null) }

// Dispatch table for the TreeContextMenu component. The child emits a
// single 'action' event with a stable name; we route it to the matching
// menuXxx handler. Centralised here so adding a new menu item is a
// one-line change in the child + one-line case here.
function dispatchMenuAction(name: string, targetId: string | null) {
  if (!targetId) {
    if (name === 'new-root-folder') menuNewRootFolder()
    else if (name === 'new-root-request') menuNewRootRequest()
    return
  }
  switch (name) {
    case 'new-subfolder': menuNewSubfolder(targetId); break
    case 'new-request': menuNewRequestInFolder(targetId); break
    case 'rename-folder': menuRenameFolder(targetId); break
    case 'delete-folder': menuDeleteFolder(targetId); break
    case 'rename-request': menuRenameRequest(targetId); break
    case 'duplicate-request': menuDuplicateRequest(targetId); break
    case 'copy-curl': menuCopyAsCurl(targetId); break
    case 'export-openapi': menuExportOpenApi(targetId); break
    case 'delete-request': menuDeleteRequest(targetId); break
  }
}

//
// Antd Tree 4.x emits @drop with a single info object. We translate it
// into the same (targetParentId, beforeId, atEnd) shape our moveFolder /
// moveRequest store helpers already accept.
//
//   info.dropToGap = true  → drop between siblings of info.node
//   info.dropToGap = false → drop "inside" info.node (only valid for folders)
//   info.dropPosition     → -1: above, 1: below (gap mode)
//
// Allow-drop predicate. We always allow dropping INSIDE a folder
// (dropPosition === 0), even when the folder is empty — Antd's default
// sometimes refuses because there's nothing to gap-drop against. We
// also block dropping a folder into its own descendant (would create a
// cycle); the store layer double-checks, but blocking here gives nicer
// cursor feedback during the drag.
function allowDrop({ dragNode, dropNode, dropPosition }: { dragNode: any; dropNode: any; dropPosition: number }): boolean {
  const dragKey: string = dragNode?.key ?? ''
  const dropKey: string = dropNode?.key ?? ''
  if (!dragKey || !dropKey) return true
  // Folder-into-own-descendant check (only matters when both are folders
  // and we're dropping inside).
  if (isFolderKey(dragKey) && isFolderKey(dropKey) && dropPosition === 0) {
    const dragId = folderIdFromKey(dragKey)
    let cur: string | null | undefined = folderIdFromKey(dropKey)
    while (cur) {
      if (cur === dragId) return false
      const f = collStore.foldersById.get(cur)
      cur = f?.parentId ?? null
    }
  }
  return true
}

async function onAntdDrop(info: any) {
  const dragKey: string = info.dragNode?.key ?? info.dragNodesKeys?.[0] ?? ''
  const targetKey: string = info.node?.key ?? ''
  if (!dragKey || dragKey === targetKey) return
  const dropToGap: boolean = !!info.dropToGap
  const pos: number = Number(info.dropPosition ?? 0)

  const isDragFolder = isFolderKey(dragKey)
  const dragId = isDragFolder ? folderIdFromKey(dragKey) : requestIdFromKey(dragKey)
  if (!dragId) return

  let targetParentId: string | null
  let beforeId: string | null
  let atEnd: boolean

  // Special case: a request dropped onto a folder ALWAYS goes inside
  // the folder, regardless of what Antd thinks the drop edge was. Antd
  // reports dropToGap=true for empty folders (because there's no first
  // child to "drop above"), which would otherwise route us into the
  // sibling branch and leave the request next to the folder instead
  // of inside it.
  if (!isDragFolder && isFolderKey(targetKey)) {
    targetParentId = folderIdFromKey(targetKey)
    beforeId = null
    atEnd = true
  } else if (!dropToGap) {
    // Drop inside info.node. Folders hold children; if the target is a
    // request, fall back to that request's parent folder.
    if (isFolderKey(targetKey)) {
      targetParentId = folderIdFromKey(targetKey)
    } else {
      const r = collStore.requestsById.get(requestIdFromKey(targetKey))
      if (!r) return
      targetParentId = r.folderId
    }
    beforeId = null
    atEnd = true
  } else {
    // Gap mode: drop as sibling of info.node, before or after it.
    if (isFolderKey(targetKey)) {
      const target = collStore.foldersById.get(folderIdFromKey(targetKey))
      targetParentId = target?.parentId ?? null
    } else {
      const r = collStore.requestsById.get(requestIdFromKey(targetKey))
      if (!r) return
      targetParentId = r.folderId
    }
    if (pos < 0) {
      beforeId = isFolderKey(targetKey) ? folderIdFromKey(targetKey) : requestIdFromKey(targetKey)
      atEnd = false
    } else {
      beforeId = null
      atEnd = true
    }
  }

  try {
    if (isDragFolder) {
      const ok = await collStore.moveFolder(dragId, targetParentId, { beforeId, atEnd })
      if (!ok) message.warning(t.value.cannotMoveFolder)
    } else {
      await collStore.moveRequest(dragId, targetParentId, { beforeId, atEnd })
    }
  } catch (e: any) {
    message.error(e?.message ?? t.value.moveFailed)
  }
}

</script>

<template>
  <div class="collection-tree">
    <div class="tree-toolbar">
      <Button
        size="small"
        block
        @click="askNewFolder(null)"
      >
        <template #icon><FolderAddOutlined /></template>
        {{ t.newFolder }}
      </Button>
      <Button
        size="small"
        block
        @click="askNewRequest(null)"
      >
        <template #icon><FileAddOutlined /></template>
        {{ t.newRequest }}
      </Button>
    </div>

    <div class="tree-scroll" @contextmenu="onContainerContextMenu">
      <Tree
        v-if="treeData.length"
        :tree-data="treeData"
        block-node
        :selectable="true"
        :draggable="true"
        :allow-drop="allowDrop"
        :expanded-keys="expandedKeysArr"
        @expand="onExpand"
        @select="onSelect"
        @right-click="onTreeRightClick"
        @drop="onAntdDrop"
      >
        <template #title="slotProps">
          <component :is="titleRender(slotProps)" />
        </template>
      </Tree>
      <div v-else class="tree-empty">
        <div class="tree-empty-icon"><FolderOutlined /></div>
        <p class="tree-empty-title">{{ t.noFoldersYet }}</p>
        <p class="tree-empty-hint">{{ t.createFolderHint }}</p>
      </div>
    </div>

    <Modal
      v-model:open="prompt.visible"
      :title="prompt.title"
      ok-text="OK"
      :cancel-text="t.cancel"
      @ok="submitPrompt"
      @cancel="closePrompt"
      :destroy-on-close="true"
    >
      <Input
        v-model:value="promptValue"
        :placeholder="prompt.initialValue"
        autofocus
        @keydown.enter="submitPrompt"
      />
    </Modal>

    <TreeContextMenu
      :visible="ctx.visible"
      :x="ctx.x"
      :y="ctx.y"
      :kind="ctx.kind"
      :target-id="ctx.targetId"
      @action="dispatchMenuAction"
      @close="closeMenu"
    />
  </div>
</template>

<style scoped>
.collection-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.tree-toolbar {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-base);
  flex: 0 0 auto;
  display: flex;
  gap: var(--space-2);
}
.tree-scroll {
  flex: 1;
  overflow: auto;
  padding: var(--space-2) var(--space-4);
  min-height: 0;
}
.tree-empty {
  text-align: center;
  padding: var(--space-9) var(--space-5);
  color: var(--text-tertiary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  animation: fade-rise 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
.tree-empty-icon {
  font-size: 28px;
  color: var(--text-tertiary);
  opacity: 0.6;
  margin-bottom: var(--space-2);
}
.tree-empty-title {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--text-secondary);
}
.tree-empty-hint {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--text-tertiary);
  max-width: 200px;
  line-height: 1.4;
}
.collection-tree :deep(.ant-tree-node-content-wrapper) {
  width: calc(100% - 18px);
}
/* ----- Tree row visuals -----
   Each tree node is rendered as: [icon | label] for folders, or
   [METHOD tag | name | url preview] for request leaves. Pull these apart
   with flexbox so the method tag stays pinned to the left and the URL
   fades out to indicate it's metadata, not the primary label. */
.collection-tree :deep(.tree-row) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  line-height: 20px;
  padding: 2px 0;
}
.collection-tree :deep(.tree-icon) {
  font-size: 14px;
  flex: 0 0 auto;
}
.collection-tree :deep(.folder-icon) {
  color: var(--status-warning);
}
.collection-tree :deep(.tree-row-label) {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.collection-tree :deep(.folder-label) {
  font-weight: 600;
  color: var(--text-primary);
}
.collection-tree :deep(.request-label) {
  font-weight: 400;
  color: var(--text-primary);
}
.collection-tree :deep(.tree-method-tag) {
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 700;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  letter-spacing: 0.4px;
  padding: 1px 4px;
  border-radius: 3px;
  border: 1px solid currentColor;
  line-height: 14px;
  background: rgba(0, 0, 0, 0.02);
}
.collection-tree :deep(.tree-row-url) {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  margin-left: 4px;
}
.collection-tree :deep(.ant-tree-node-selected .folder-label) {
  color: var(--accent);
}

</style>

<style>
.ctx-menu {
  position: fixed;
  list-style: none;
  margin: 0;
  padding: 4px 0;
  background: var(--bg-base);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  min-width: 180px;
  font-size: 13px;
}
.ctx-menu li {
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ctx-menu li:hover { background: var(--bg-muted); }
.ctx-menu li.danger { color: var(--tag-danger-fg); }
.ctx-menu li.danger:hover { background: var(--status-danger-bg); }
.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}
</style>