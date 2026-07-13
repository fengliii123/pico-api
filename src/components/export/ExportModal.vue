<script setup lang="ts">
// Export modal — three scopes:
//   - 'single'    → just the currently-edited request
//   - 'folder'    → all requests under a picked folder (one level)
//   - 'collection'→ every saved request
//
// Output is OpenAPI 3.0 JSON. The preview pane re-renders live as the
// user edits the title / picks a folder, so they can eyeball the
// document before copying or downloading.
//
// We don't add YApi / Apifox format options yet — they share 95% of the
// same code path (OpenAPI is the lingua franca).

import { computed, ref, watch } from 'vue'
import { Modal, Input, Button, Segmented, message } from 'ant-design-vue'
import { DownloadOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { useCollectionStore } from '@/stores/collection'
import { useRequestStore } from '@/stores/request'
import { exportOpenApi } from '@/core/openapi/export'
import { downloadTextFile } from '@/utils/download'
import FolderPicker from '@/components/tree/FolderPicker.vue'
import { useI18n } from '@/i18n/useI18n'

type Scope = 'single' | 'folder' | 'collection'

const { t } = useI18n()
const open = defineModel<boolean>('open', { default: false })

const collStore = useCollectionStore()
const reqStore = useRequestStore()

const scope = ref<Scope>('collection')
const title = ref('')
const description = ref('')
const folderId = ref<string | null>(null)
const folderPickerOpen = ref(false)

watch(open, v => {
  if (v) {
    // Default to collection scope; title falls back to the request /
    // folder / collection name in export.ts if left blank.
    scope.value = 'collection'
    title.value = ''
    description.value = ''
    folderId.value = null
  }
})

const scopeOptions = computed(() => [
  { value: 'collection', label: t.value.exportScopeCollection },
  { value: 'folder', label: t.value.exportScopeFolder },
  { value: 'single', label: t.value.exportScopeSingle }
])

const folderLabel = computed(() => {
  if (!folderId.value) return '— Unfiled —'
  const f = collStore.foldersById.get(folderId.value)
  return f ? f.name : '— Unknown —'
})

const exportedJson = computed(() => {
  if (scope.value === 'single' && !reqStore.draft.id) return ''
  try {
    const opts = scope.value === 'single'
      ? {
          scope: 'single' as const,
          title: title.value,
          description: description.value,
          requestIds: reqStore.draft.id ? [reqStore.draft.id] : [],
          requests: collStore.requestList,
          folders: collStore.folderList
        }
      : scope.value === 'folder'
        ? {
            scope: 'folder' as const,
            title: title.value,
            description: description.value,
            folderIds: folderId.value ? [folderId.value] : [],
            requests: collStore.requestList,
            folders: collStore.folderList
          }
        : {
            scope: 'collection' as const,
            title: title.value,
            description: description.value,
            requests: collStore.requestList,
            folders: collStore.folderList
          }
    return exportOpenApi(opts)
  } catch (e: any) {
    return `// Error: ${e?.message ?? e}`
  }
})

const willExportCount = computed(() => {
  if (scope.value === 'collection') return collStore.requestList.length
  if (scope.value === 'single') return reqStore.draft.id ? 1 : 0
  // folder
  if (!folderId.value) return 0
  return collStore.requestList.filter(r => r.folderId === folderId.value).length
})

async function copyToClipboard() {
  if (!exportedJson.value) return
  try {
    await navigator.clipboard.writeText(exportedJson.value)
    message.success(t.value.copied)
  } catch {
    message.error(t.value.clipboardWriteFailed)
  }
}

function download() {
  if (!exportedJson.value) return
  const safeTitle = (title.value.trim() || 'pico-api-export').replace(/[^\w-]+/g, '-')
  downloadTextFile(`${safeTitle}.openapi.json`, exportedJson.value, 'application/json')
}
</script>

<template>
  <Modal
    :open="open"
    :title="t.exportAsOpenapi"
    width="780px"
    :footer="null"
    @cancel="open = false"
  >
    <div class="export-row">
      <label class="export-label">{{ t.scope }}</label>
      <Segmented v-model:value="scope" :options="scopeOptions" />
    </div>

    <div v-if="scope === 'folder'" class="export-row">
      <label class="export-label">{{ t.folder }}</label>
      <FolderPicker
        v-model:visible="folderPickerOpen"
        :current-folder-id="folderId"
        @select="(id: string | null) => (folderId = id)"
      >
        <Button>{{ folderLabel }}</Button>
      </FolderPicker>
    </div>

    <div class="export-row">
      <label class="export-label">{{ t.title }}</label>
      <Input
        v-model:value="title"
        :placeholder="scope === 'single' ? 'My API request' : 'My API'"
      />
    </div>

    <div class="export-row">
      <label class="export-label">{{ t.description }}</label>
      <Input.TextArea
        v-model:value="description"
        :rows="2"
        :placeholder="t.descriptionOptional"
      />
    </div>

    <div class="export-preview-hint">
      Preview ({{ willExportCount }} request{{ willExportCount === 1 ? '' : 's' }})
    </div>
    <Input.TextArea
      :value="exportedJson"
      :rows="12"
      readonly
      class="export-preview"
      :spellcheck="false"
    />

    <div class="export-actions">
      <Button @click="open = false">{{ t.close }}</Button>
      <Button :disabled="willExportCount === 0" @click="copyToClipboard">
        <template #icon><CopyOutlined /></template>
        {{ t.copy }}
      </Button>
      <Button type="primary" :disabled="willExportCount === 0" @click="download">
        <template #icon><DownloadOutlined /></template>
        {{ t.download }}
      </Button>
    </div>
  </Modal>
</template>

<style scoped>
.export-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.export-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.export-preview-hint {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  margin: 4px 0 6px;
  font-weight: 600;
}
.export-preview :deep(textarea) {
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
}
.export-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
