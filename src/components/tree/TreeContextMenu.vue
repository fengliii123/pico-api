<script setup lang="ts">
// Right-click context menu for the collection tree. Renders different
// items based on `kind` (folder / request / root). Emits a single
// `action` event with the action name; the parent dispatches to its own
// business logic (create/rename/delete/duplicate/etc).

import {
  FolderAddOutlined,
  FileAddOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  SnippetsOutlined,
  ExportOutlined
} from '@ant-design/icons-vue'
import { useI18n } from '@/i18n/useI18n'

defineProps<{
  visible: boolean
  x: number
  y: number
  kind: 'folder' | 'request' | 'root'
  targetId: string | null
}>()

const emit = defineEmits<{
  (e: 'action', name: string, targetId: string | null): void
  (e: 'close'): void
}>()

const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <ul
      v-if="visible"
      class="ctx-menu"
      :style="{ left: x + 'px', top: y + 'px' }"
      @click.stop
    >
      <template v-if="kind === 'folder' && targetId">
        <li @click="emit('action', 'new-subfolder', targetId)">
          <FolderAddOutlined /> {{ t.newFolder }}
        </li>
        <li @click="emit('action', 'new-request', targetId)">
          <FileAddOutlined /> {{ t.newRequest }}
        </li>
        <li @click="emit('action', 'rename-folder', targetId)">
          <EditOutlined /> {{ t.rename }}
        </li>
        <li class="danger" @click="emit('action', 'delete-folder', targetId)">
          <DeleteOutlined /> {{ t.delete }}
        </li>
      </template>
      <template v-else-if="kind === 'request' && targetId">
        <li @click="emit('action', 'rename-request', targetId)">
          <EditOutlined /> {{ t.rename }}
        </li>
        <li @click="emit('action', 'duplicate-request', targetId)">
          <CopyOutlined /> {{ t.duplicate }}
        </li>
        <li @click="emit('action', 'copy-curl', targetId)">
          <SnippetsOutlined /> {{ t.copyAsCurl }}
        </li>
        <li @click="emit('action', 'export-openapi', targetId)">
          <ExportOutlined /> {{ t.exportOpenApi }}
        </li>
        <li class="danger" @click="emit('action', 'delete-request', targetId)">
          <DeleteOutlined /> {{ t.delete }}
        </li>
      </template>
      <template v-else>
        <li @click="emit('action', 'new-root-folder', null)">
          <FolderAddOutlined /> {{ t.newFolder }}
        </li>
        <li @click="emit('action', 'new-root-request', null)">
          <FileAddOutlined /> {{ t.newRequest }}
        </li>
      </template>
    </ul>
    <div
      v-if="visible"
      class="ctx-backdrop"
      @click="emit('close')"
      @contextmenu.prevent
    />
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 1000;
  background: var(--bg-base);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2) 0;
  margin: 0;
  list-style: none;
  min-width: 180px;
  font-size: var(--fs-sm);
}
.ctx-menu li {
  padding: var(--space-3) var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  color: var(--text-primary);
}
.ctx-menu li:hover {
  background: var(--bg-muted);
}
.ctx-menu li.danger {
  color: var(--status-danger);
}
.ctx-menu li.danger:hover {
  background: var(--status-danger-bg);
}
.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
}
</style>
