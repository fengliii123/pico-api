<script setup lang="ts">
// Folder picker: an inline dropdown that pops out of the trigger button.
// Used by Save (when no folder is set) and "Save to..." (always re-prompts).
//
// We render the full folder tree in a flat menu (root + every folder in DFS
// order) so the user picks in one click — no modal, no second confirmation.
// Picking immediately emits `select` with the folder id (or null for root).
//
// Emits:
//   - `select` with the chosen folder id (or null for root)

import { computed, h, ref } from 'vue'
import { Popover, Empty, Input } from 'ant-design-vue'
import { FolderOutlined, FolderOpenOutlined, CheckOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { useCollectionStore } from '@/stores/collection'
import { buildTree } from './treeUtils'
import { useI18n } from '@/i18n/useI18n'
import type { VNode } from 'vue'

const { t } = useI18n()

const props = defineProps<{
  // When true, the dropdown is open.
  visible: boolean
  // The id of the folder currently in the draft, so we can show a check
  // next to the active row.
  currentFolderId: string | null
  // Anchor element to position the popover near. Usually the trigger button.
  // Not strictly required since Popover triggers off its child, but we
  // accept a separate trigger slot to keep the picker decoupled from the
  // button UI.
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'select', folderId: string | null): void
}>()

const collStore = useCollectionStore()
const filter = ref('')

const treeData = computed(() =>
  buildTree(collStore.folderList, collStore.requestList)
)

interface FlatItem {
  key: string
  folderId: string | null
  name: string
  depth: number
}

function flatten(nodes: ReturnType<typeof buildTree>, depth: number, out: FlatItem[]): void {
  for (const n of nodes) {
    // buildTree also includes 'request' nodes. We only care about folders
    // here — the request picker is handled by the tree component.
    if (n.node.kind !== 'folder') continue
    const f = n.node.folder
    out.push({ key: 'folder:' + f.id, folderId: f.id, name: f.name, depth })
    if (n.children) flatten(n.children, depth + 1, out)
  }
}

const flatFolders = computed<FlatItem[]>(() => {
  const list: FlatItem[] = [
    { key: 'folder:__root__', folderId: null, name: '— Unfiled (root) —', depth: 0 }
  ]
  flatten(treeData.value, 0, list)
  return list
})

const visibleItems = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return flatFolders.value
  return flatFolders.value.filter(f => f.name.toLowerCase().includes(q))
})

function pick(fid: string | null) {
  emit('select', fid)
  emit('update:visible', false)
  filter.value = ''
}

function onVisibleChange(v: boolean) {
  emit('update:visible', v)
  if (!v) filter.value = ''
}

const content = computed<VNode>(() => {
  return h('div', { class: 'fp-pop' }, [
    h('div', { class: 'fp-search' }, [
      h(SearchOutlined, { class: 'fp-search-icon' }),
      h(Input, {
        value: filter.value,
        placeholder: t.value.filterFolders,
        allowClear: true,
        size: 'small',
        bordered: false,
        'onUpdate:value': (v: string) => (filter.value = v)
      })
    ]),
    h('div', { class: 'fp-list' },
      visibleItems.value.length === 0
        ? [h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: t.value.noMatchingFolders })]
        : visibleItems.value.map(f =>
            h('div', {
              class: 'fp-item',
              style: { paddingLeft: (8 + f.depth * 14) + 'px' },
              onClick: () => pick(f.folderId)
            }, [
              f.folderId === null
                ? h(FolderOpenOutlined, { style: { color: '#8c8c8c', marginRight: '6px' } })
                : h(FolderOutlined, { style: { color: '#faad14', marginRight: '6px' } }),
              h('span', { class: 'fp-item-name' }, f.name),
              h('span', { class: 'fp-item-spacer' }),
              h(CheckOutlined, {
                class: 'fp-item-check',
                style: { opacity: props.currentFolderId === f.folderId ? 1 : 0 }
              })
            ])
          )
    )
  ])
})
</script>

<template>
  <Popover
    :open="props.visible"
    trigger="click"
    placement="bottomRight"
    :destroy-tooltip-on-hide="true"
    :arrow="false"
    :content="content"
    :overlay-inner-style="{ padding: 0 }"
    overlay-class-name="folder-picker-popover"
    @open-change="onVisibleChange"
  >
    <slot />
  </Popover>
</template>

<style scoped>
.fp-pop {
  width: 260px;
  max-height: 360px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 6px;
}
.fp-search {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid #f0f0f0;
  color: #8c8c8c;
}
.fp-search-icon { font-size: 13px; }
.fp-list { overflow-y: auto; max-height: 320px; }
.fp-item {
  display: flex;
  align-items: center;
  padding: 6px 12px 6px 8px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.fp-item:hover { background: #f0f5ff; }
.fp-item-name { overflow: hidden; text-overflow: ellipsis; }
.fp-item-spacer { flex: 1 1 auto; }
.fp-item-check { color: #1890ff; font-size: 12px; }
</style>

<style>
/* Override the default ant-popover-inner padding to 0 so the popover
   hugs the rounded list. Scoped styles can't reach the portal. */
.folder-picker-popover .ant-popover-inner { padding: 0 !important; }
</style>
