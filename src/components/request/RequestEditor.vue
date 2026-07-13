<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Button, Input, Tabs, Drawer, Segmented, message } from 'ant-design-vue'
import { CloudUploadOutlined, SendOutlined, PlusOutlined, FolderOpenOutlined, UndoOutlined, RedoOutlined, CopyOutlined, MoreOutlined } from '@ant-design/icons-vue'
import MethodDropdown from './MethodDropdown.vue'
import KeyValueTable from './KeyValueTable.vue'
import BodyEditor from './BodyEditor.vue'
import AuthEditor from './AuthEditor.vue'
import ScriptEditor from './ScriptEditor.vue'
import SettingsEditor from './SettingsEditor.vue'
import FolderPicker from '@/components/tree/FolderPicker.vue'
import { useRequestStore } from '@/stores/request'
import { useCollectionStore } from '@/stores/collection'
import { useEnvironmentStore } from '@/stores/environment'
import { useUndoRedoStore } from '@/stores/undoRedo'
import { useResponseStore } from '@/stores/response'
import { processHeaders } from '@/core/headers'
import { deepClone } from '@/utils/clone'
import { useRequestExecution } from '@/composables/useRequestExecution'
import type { KeyValueRow, FormDataRow, RequestBody, HttpMethod, SavedRequest, AuthConfig, RequestScripts, RequestSettings } from '@/core/types'
import { useI18n } from '@/i18n/useI18n'
import { fmt } from '@/i18n'

const { t } = useI18n()
const reqStore = useRequestStore()
const collStore = useCollectionStore()
const envStore = useEnvironmentStore()
const undoRedoStore = useUndoRedoStore()
const resStore = useResponseStore()
const { send, cancel } = useRequestExecution()

const isSending = computed(() => resStore.state.kind === 'loading')

const draft = computed(() => reqStore.draft)

const paramsRows = computed({
  get: () => draft.value.params,
  set: (v: KeyValueRow[]) => reqStore.setParams(v)
})

const headerRows = computed<KeyValueRow[]>(() => {
  const userKeys = new Set(
    draft.value.headers
      .map(r => r.key.trim().toLowerCase())
      .filter(Boolean)
  )
  const synth = headerAutoInjections.value
    .filter(a => !userKeys.has(a.key.toLowerCase()))
    .map(a => ({ key: a.key, value: a.value, enabled: true }))
  // Auto-injected rows go on top so the Content-Type line the body
  // editor just decided for the user is the first thing they see.
  return [...synth, ...draft.value.headers]
})

const body = computed({
  get: () => draft.value.body,
  set: (v: RequestBody) => reqStore.setBody(v)
})

const auth = computed({
  get: () => draft.value.auth,
  set: (v: AuthConfig) => reqStore.setAuth(v)
})

const scripts = computed({
  get: () => draft.value.scripts,
  set: (v: RequestScripts) => reqStore.setScripts(v)
})

const settings = computed({
  get: () => draft.value.settings,
  set: (v: RequestSettings) => reqStore.setSettings(v)
})

// GET/HEAD/OPTIONS don't carry a body. The Body tab is locked but still
// shows the disabled radios + hint so the user understands why.
const isBodylessMethod = computed(() => {
  const m = draft.value.method.toUpperCase()
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS'
})

// Native <input> can't color sub-string ranges, so we paint the URL
// twice: a transparent <input> on top (for editing + caret) and a
// pointer-events:none overlay div below it that renders the same text
// with {{var}} tokens wrapped in a styled span. AntD's input borders
// and focus ring keep working because the input is still there.
const URL_VAR_RE = /\{\{([^{}]+)\}\}/g
const urlHighlightHtml = computed(() => {
  const raw = draft.value.url || ''
  // Empty input → render a non-breaking space so the overlay keeps its
  // height; otherwise it collapses and the input's transparent caret
  // has nothing behind it.
  if (!raw) return '&nbsp;'
  // Escape HTML first so user-typed <, >, & don't break the overlay.
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Then wrap {{var}} occurrences. Whitespace inside {{ }} is allowed
  // (matches the resolver in core/variables).
  return escaped.replace(URL_VAR_RE, (_, name: string) =>
    `<span class="url-var">{{${name}}}</span>`)
})

//
// processHeaders() returns a "dropped" list that includes things the
// framework auto-injects (Content-Type for body modes) and things it
// drops (banned-by-browser headers). For the editor:
//   - auto-injected: append a real editable row the user can override
//     (replaces the previous "AUTO" virtual badge which was confusing).
//   - banned/dropped: still surfaced as virtual rows so the user sees
//     why their header is being stripped, but only when there's
//     something to explain.
// Run the header pipeline once; both the auto-injected and the
// banned/dropped derivations read from this single cached result so
// processHeaders isn't recomputed twice per draft change.
const processedHeaders = computed(() => processHeaders(draft.value.headers, draft.value.body))
const headerAutoInjections = computed(() =>
  processedHeaders.value.dropped
    .filter(d => d.reason.startsWith('auto-injected'))
    .map(d => ({ key: d.key, value: d.value }))
)
const headerVirtualRows = computed(() =>
  processedHeaders.value.dropped
    .filter(d => !d.reason.startsWith('auto-injected'))
    .map(d => ({ key: d.key, value: d.value, reason: d.reason }))
)


// Show the count of enabled rows in each tab so the user can see at a glance
// "I have 3 params, 5 headers, body is JSON".
const enabledCount = (rows: KeyValueRow[]) => rows.filter(r => r.enabled && r.key.trim() !== '').length
const enabledFormdataCount = (rows: FormDataRow[]) => rows.filter(r => r.enabled && r.key.trim() !== '').length

const paramsCount = computed(() => enabledCount(draft.value.params))
const headersCount = computed(() => enabledCount(headerRows.value))

const bodyModeLabel = computed(() => {
  const b = draft.value.body
  if (b.mode === 'none') return 'none'
  if (b.mode === 'urlencoded') return 'urlencoded'
  if (b.mode === 'formdata') {
    const n = enabledFormdataCount(b.formdata ?? [])
    return n > 0 ? `form-data · ${n}` : 'form-data'
  }
  if (b.mode === 'raw') return `raw · ${b.rawType ?? 'json'}`
  return ''
})

// user rows from auto-injected ones and persist only the user rows into
// draft.headers. Auto-injected rows reappear whenever the user clears
// or removes their own row with the same key.
//
// Exception: if the user has *edited* an auto-injected row's value (e.g.
// overriding the form-data Content-Type placeholder), we keep that row as
// a real user row so the override actually takes effect on send.
function onHeaderRowsUpdate(rows: KeyValueRow[]) {
  const defaultValueByKey = new Map(
    headerAutoInjections.value.map(a => [a.key.toLowerCase(), a.value])
  )
  const userRows = rows.filter(r => {
    const k = r.key.trim().toLowerCase()
    // Keep empty-key rows: the user just hit "Add row" and hasn't typed
    // a name yet. Dropping them here would make the new row vanish
    // instantly (and the empty-state hint would come back, which is what
    // the user was seeing).
    if (!k) return true
    // Skip rows whose value still matches an auto-injected default —
    // otherwise we'd persist a duplicate of what the framework already
    // sends. The user can override by editing the value, which makes
    // this filter pass and the row gets persisted.
    const def = defaultValueByKey.get(k)
    if (def === undefined) return true
    return r.value !== def
  })
  reqStore.setHeaders(userRows)
}
async function saveRequest() {
  // For brand-new requests, we always prompt for a destination folder on
  // the first Save — UNLESS the user already picked one via the inline
  // picker (onFolderPicked sets draft.folderId and re-calls us). We
  // can't simply check `!draft.value.folderId`, because saving to the
  // root (folderId === null) is a valid choice and would otherwise
  // re-trigger the picker forever.
  if (reqStore.isNew && !folderChoiceConfirmed) {
    folderPickerOpen.value = true
    return
  }
  folderChoiceConfirmed = false

  try {
    if (reqStore.isNew) {
      const saved = reqStore.toSaved()
      const now = Date.now()
      const full: SavedRequest = {
        ...saved,
        order: 0,
        createdAt: now,
        updatedAt: now
      }
      const created = await collStore.createRequest(full.folderId, full)
      reqStore.markSaved(created.id)
      message.success(t.value.saved)
      return
    }

    // Existing request — just persist edits.
    const saved = reqStore.toSaved()
    const now = Date.now()
    const full: SavedRequest = {
      ...saved,
      order: 0,
      createdAt: now,
      updatedAt: now
    }
    await collStore.updateRequest(full)
    reqStore.markSaved(full.id)
    message.success(t.value.saved)
  } catch (e: any) {
    const msg = e?.message ?? ''
    if (msg.startsWith('requestNameConflict:')) {
      const name = msg.replace('requestNameConflict:', '')
      message.error(fmt(t.value.nameAlreadyExists, { name }))
    } else if (msg.startsWith('folderNameConflict:')) {
      const name = msg.replace('folderNameConflict:', '')
      message.error(fmt(t.value.nameAlreadyExists, { name }))
    } else {
      message.error(msg || t.value.error)
    }
  }
}

const folderPickerOpen = ref(false)
// Flag: the user has just confirmed a destination in the inline picker
// and we should bypass the picker prompt on the next saveRequest() call.
// Reset to false after each save attempt.
let folderChoiceConfirmed = false

// Debounce helper for undo tracking
let undoTimer: ReturnType<typeof setTimeout> | null = null
const TRACK_DELAY = 1000 // Track changes after 1 second of inactivity

// Suppress flag: when we're applying an undo/redo, the draft watch fires
// (we just reassigned reqStore.draft) and would, after TRACK_DELAY, push
// the *current* draft back onto `past` — which has the side effect of
// clearing `future`, breaking redo. We flip this flag for the duration of
// the undo/redo call so trackChange() is a no-op while it's set.
let suppressTracking = 0

function trackChange(description: string) {
  if (suppressTracking > 0) return
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(() => {
    if (suppressTracking > 0) return
    undoRedoStore.push(reqStore.draft, description)
  }, TRACK_DELAY)
}

// Watch for draft edits and track for undo — editGeneration bumps on every
// store setter so we avoid deep-walking the entire draft on each keystroke.
watch(
  () => reqStore.editGeneration,
  () => {
    if (reqStore.dirty) {
      trackChange('Edit request')
    }
  }
)

// When the user loads a different saved request (or hits "New"), reset
// the undo baseline so the first edit on the new draft can be undone.
// Without this, undo would jump across requests (very confusing).
watch(
  () => reqStore.draft.id,
  () => {
    undoRedoStore.reset(reqStore.draft)
  }
)

function undo() {
  const snapshot = undoRedoStore.undo(reqStore.draft)
  if (snapshot) {
    suppressTracking++
    reqStore.draft = { ...snapshot }
    reqStore.dirty = true
    // Cancel any pending trackChange from prior edits — it would push a
    // stale snapshot on top of the just-restored state.
    if (undoTimer) {
      clearTimeout(undoTimer)
      undoTimer = null
    }
    suppressTracking--
    message.success(t.value.undo)
  }
}

function redo() {
  const snapshot = undoRedoStore.redo(reqStore.draft)
  if (snapshot) {
    suppressTracking++
    reqStore.draft = { ...snapshot }
    reqStore.dirty = true
    if (undoTimer) {
      clearTimeout(undoTimer)
      undoTimer = null
    }
    suppressTracking--
    message.success(t.value.redo)
  }
}

async function onFolderPicked(folderId: string | null) {
  // We bypass setFolder (which would toggle dirty) because the user is
  // picking a folder *in order to save* — they don't want a dirty dot.
  reqStore.draft.folderId = folderId
  // Tell saveRequest() the user has chosen, so it doesn't re-prompt
  // (especially important when they chose root, i.e. folderId === null).
  folderChoiceConfirmed = true
  await saveRequest()
}

// "Save to..." — explicitly re-prompts for the destination folder even if
// the draft already has one (useful for moving a saved request).
function folderDisplay(folderId: string | null): string {
  if (!folderId) return '— Unfiled —'
  const f = collStore.foldersById.get(folderId)
  return f ? f.name : '— Unknown —'
}

async function saveToOtherFolder() {
  // Inline picker: just open it. The picker now picks-and-saves in one go.
  folderPickerOpen.value = true
}

function newRequest() {
  reqStore.newRequest(draft.value.folderId)
  // Seed the undo baseline so the first edit on the new request can be
  // undone back to its just-created state.
  undoRedoStore.reset(reqStore.draft)
}

// AntD Tabs default-active-key is uncontrolled — sync tab when request/body mode changes.
const activeTab = ref<'params' | 'headers' | 'body'>('params')
function pickInitialTab(): 'params' | 'headers' | 'body' {
  if (reqStore.draft.body.mode !== 'none') return 'body'
  return 'params'
}

// "More" drawer holds auth / scripts / settings — these are configured
// once per request and then mostly left alone, so they don't deserve a
// slot in the always-visible tab strip (especially in side-panel mode
// where ~400px of width can't fit six tabs without scrolling).
const moreOpen = ref(false)
type MoreTab = 'auth' | 'scripts' | 'settings'
const moreTab = ref<MoreTab>('auth')
const moreOptions = computed(() => [
  { value: 'auth', label: t.value.auth },
  { value: 'scripts', label: t.value.scripts },
  { value: 'settings', label: t.value.requestSettings }
])
watch(() => reqStore.draft.id, () => {
  activeTab.value = pickInitialTab()
})
watch(() => reqStore.draft.body.mode, () => {
  activeTab.value = pickInitialTab()
})

async function duplicateCurrentRequest() {
  const current = draft.value
  if (!current.url && !current.name) {
    message.warning(t.value.nothingToDuplicate)
    return
  }
  reqStore.newRequest(current.folderId)
  reqStore.setName((current.name || 'Untitled') + ' (Copy)')
  reqStore.setMethod(current.method)
  reqStore.setUrl(current.url)
  reqStore.setHeaders(current.headers.map(h => ({ ...h })))
  reqStore.setParams(current.params.map(p => ({ ...p })))
  reqStore.setBody(deepClone(current.body))
  // Carry auth/scripts/settings over — without this the duplicate would
  // silently lose credentials, pre/post scripts, and timeout/redirect
  // config, which is exactly the kind of "looks the same but isn't"
  // bug that bites users later.
  reqStore.setAuth(deepClone(current.auth))
  reqStore.setScripts({
    preRequest: current.scripts.preRequest,
    postResponse: current.scripts.postResponse
  })
  reqStore.setSettings({ ...current.settings })
  message.success(t.value.requestDuplicated)
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    void saveRequest()
    return
  }
  // Cmd/Ctrl+Enter — send. Most useful when the user is typing in the
  // URL or body textarea and wants to fire without mousing up to Send.
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    void send()
    return
  }
  // Cmd/Ctrl+Z — undo
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    if (undoRedoStore.canUndo) undo()
    return
  }
  // Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y — redo
  if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
    e.preventDefault()
    if (undoRedoStore.canRedo) redo()
    return
  }
  // Cmd/Ctrl+D — duplicate current request
  if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault()
    duplicateCurrentRequest()
    return
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))

// Expose `send` to the parent (AppLayout) so the ResponsePanel's "Resend"
// button can re-run the same code path.
defineExpose({ send })
</script>

<template>
  <div class="request-editor">
    <div class="topbar">
      <Input
        :value="draft.name"
        :placeholder="t.requestName"
        class="name-input"
        @update:value="(v: string) => reqStore.setName(v)"
      />
      <span v-if="reqStore.dirty" class="dirty-dot" :title="t.unsavedChanges" />
      <div class="topbar-group">
        <Button @click="newRequest" title="New (clears draft)">
          <template #icon><PlusOutlined /></template>
          {{ t.new }}
        </Button>
        <Button @click="undo" :disabled="!undoRedoStore.canUndo" title="Undo (⌘Z)" class="icon-btn">
          <template #icon><UndoOutlined /></template>
        </Button>
        <Button @click="redo" :disabled="!undoRedoStore.canRedo" title="Redo (⌘⇧Z)" class="icon-btn">
          <template #icon><RedoOutlined /></template>
        </Button>
        <Button @click="duplicateCurrentRequest" title="Duplicate (⌘D)" class="icon-btn">
          <template #icon><CopyOutlined /></template>
        </Button>
      </div>
      <div class="topbar-group">
        <Button @click="saveRequest" class="save-btn">
          <template #icon><CloudUploadOutlined /></template>
          {{ t.save }}
        </Button>
        <FolderPicker
          v-model:visible="folderPickerOpen"
          :current-folder-id="draft.folderId"
          @select="onFolderPicked"
        >
          <Button @click="saveToOtherFolder" title="Save to a different folder">
            <template #icon><FolderOpenOutlined /></template>
            {{ folderDisplay(draft.folderId) }}
          </Button>
        </FolderPicker>
      </div>
      <Button @click="moreOpen = true" class="more-btn" :title="t.more">
        <template #icon><MoreOutlined /></template>
        {{ t.more }}
      </Button>
    </div>

    <div class="url-row">
      <MethodDropdown
        :model-value="draft.method"
        @update:model-value="(v: HttpMethod) => reqStore.setMethod(v)"
      />
      <div class="url-input-wrap">
        <div class="url-input-overlay" v-html="urlHighlightHtml" />
        <Input
          :value="draft.url"
          placeholder="https://api.example.com/path"
          class="url-input"
          @update:value="(v: string) => reqStore.setUrl(v)"
          @press-enter="send"
        />
      </div>
      <Button
        v-if="isSending"
        danger
        class="url-send url-cancel"
        @click="cancel"
      >
        {{ t.cancel }}
      </Button>
      <Button v-else type="primary" class="url-send" @click="send">
        <template #icon><SendOutlined /></template>
        {{ t.send }}
      </Button>
    </div>

    <Tabs :active-key="activeTab" class="req-tabs" @update:active-key="(k: any) => activeTab = k">
      <Tabs.TabPane key="params">
        <template #tab>
          <span class="tab-label">{{ t.params }}
            <span v-if="paramsCount > 0" class="tab-badge">{{ paramsCount }}</span>
          </span>
        </template>
        <KeyValueTable
          :rows="paramsRows"
          row-kind="param"
          key-placeholder="Parameter name"
          value-placeholder="Value"
          :empty-hint="t.noParametersHint"
          @update="(rows) => paramsRows = rows"
        />
      </Tabs.TabPane>
      <Tabs.TabPane key="headers">
        <template #tab>
          <span class="tab-label">{{ t.headers }}
            <span v-if="headersCount > 0" class="tab-badge">{{ headersCount }}</span>
            <span v-else-if="headerVirtualRows.length > 0" class="tab-badge tab-badge-virtual">{{ headerVirtualRows.length }} auto</span>
          </span>
        </template>
        <KeyValueTable
          :rows="headerRows"
          :virtual-rows="headerVirtualRows"
          row-kind="header"
          key-placeholder="Header"
          value-placeholder="Value"
          :empty-hint="t.noHeadersHint"
          @update="onHeaderRowsUpdate"
        />
      </Tabs.TabPane>
      <Tabs.TabPane key="body">
        <template #tab>
          <span class="tab-label">{{ t.body }}
            <span v-if="bodyModeLabel !== 'none'" class="tab-badge tab-badge-mode">{{ bodyModeLabel }}</span>
          </span>
        </template>
        <BodyEditor
          :model-value="body"
          :disabled="isBodylessMethod"
          :method-label="draft.method"
          @update:model-value="(v: RequestBody) => body = v"
        />
      </Tabs.TabPane>
    </Tabs>

    <Drawer
      v-model:open="moreOpen"
      :title="t.more"
      placement="right"
      :width="480"
      class="more-drawer"
    >
      <Segmented
        v-model:value="moreTab"
        :options="moreOptions"
        block
        :style="{ marginBottom: '16px' }"
      />
      <div :style="{ paddingTop: '8px' }">
        <AuthEditor
          v-show="moreTab === 'auth'"
          :model-value="auth"
          @update:model-value="(v: AuthConfig) => auth = v"
        />
        <ScriptEditor
          v-show="moreTab === 'scripts'"
          :model-value="scripts"
          @update:model-value="(v: RequestScripts) => scripts = v"
        />
        <SettingsEditor
          v-show="moreTab === 'settings'"
          :model-value="settings"
          @update:model-value="(v: RequestSettings) => settings = v"
        />
      </div>
    </Drawer>
  </div>
</template>

<style scoped>
.request-editor {
  display: flex;
  flex-direction: column;
  padding: var(--space-5) var(--space-6);
  gap: var(--space-4);
  overflow: auto;
  /* Cap the editor at ~50% of the column so the response panel keeps a
     usable slice even when the request body has many rows. Within the
     cap, content scrolls — body editors (textarea) used to push the
     response panel down to a sliver. */
  flex: 0 1 auto;
  max-height: 50%;
  min-height: 0;
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-base);
}
.topbar {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}
/* More button sits at the end of the topbar to host low-frequency
   configuration (auth / scripts / settings). Outlined-style — same
   weight as Save, doesn't compete with the Send CTA. */
.more-btn.ant-btn {
  border-color: var(--border-strong);
  color: var(--text-secondary);
  flex: 0 0 auto;
}
.more-btn.ant-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}
/* name input is the flexible primary control — it eats remaining space
   so the toolbar groups to its right stay tight. */
.name-input {
  flex: 1;
  min-width: 0;
}
.name-input :deep(input) {
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
}
.name-input :deep(.ant-input):focus,
.name-input :deep(.ant-input-focused) {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--pico-brand-glow);
}
/* Topbar button groups — visually cluster related actions. Each group
   is a tight 4px cluster; groups themselves are separated by 12px. */
.topbar-group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex: 0 0 auto;
}
/* Icon-only buttons (undo/redo/duplicate) lose their text label so they
   shrink to a square — visually consistent with the segmented control
   pattern, less crowded than labelled buttons. */
.topbar-group .icon-btn.ant-btn {
  width: 32px;
  padding-inline: 0;
}
/* Save button gets brand-tinted border + soft bg so it reads as the
   "primary action" of the editor group, leaving Send as the *only*
   solid-filled button (which keeps Send as the unmistakable CTA). */
.save-btn.ant-btn {
  border-color: var(--accent);
  color: var(--accent-soft-fg);
  background: var(--accent-soft-bg);
  font-weight: var(--fw-medium);
}
.save-btn.ant-btn:hover {
  background: var(--accent);
  color: var(--text-on-accent);
  border-color: var(--accent);
}
.url-row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}
/* url-input-wrap carries the flex sizing for the URL field; the Input
 * inside fills it. The overlay sits absolutely on top of the input
 * (lower z-index) and paints the same text with {{var}} colored — the
 * input itself is transparent so user typing still works through it. */
.url-input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}
.url-input {
  width: 100%;
  font-family: 'SF Mono', 'Menlo', ui-monospace, monospace;
  font-size: 14px;
  /* Text is transparent — the overlay shows the colored version. Caret
   * stays visible so the user can still see / move the cursor. Background
   * must also be transparent so the overlay's colored text shows through;
   * AntD's default white input bg would otherwise sit on top of it. */
  color: transparent !important;
  background: transparent !important;
  caret-color: var(--text-primary);
}
.url-input::placeholder {
  /* Placeholder must remain visible (otherwise empty input looks broken). */
  color: var(--text-tertiary);
}
.url-input:focus,
.url-input-focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--pico-brand-glow);
}
.url-input-overlay {
  position: absolute;
  inset: 0;
  padding: 4px 11px;
  border: 1px solid transparent;
  font-family: 'SF Mono', 'Menlo', ui-monospace, monospace;
  font-size: 14px;
  line-height: 22px;
  color: var(--text-primary);
  white-space: pre;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  /* sits behind the input; input is transparent so this shows through */
  z-index: 0;
}
/* Keep URL input, Method dropdown, and Send button at the same height
   so the URL row reads as a single aligned toolbar. AntD's default input
   height (32px) drives this — Send button matches it. */
.url-input-overlay :deep(.url-var) {
  /* Amber token — deliberately NOT the brand teal, because the global
   * ::selection highlight is teal (--accent-soft-bg). Using a different hue
   * keeps a {{var}} pill visually distinct from a double-click text
   * selection that lands on the same characters. */
  color: var(--tag-warning-fg);
  background: var(--tag-warning-bg);
  border-radius: var(--radius-sm);
  /* No horizontal padding/margin: the overlay must stay character-aligned
   * with the transparent <input> underneath, so the token box can't be
   * wider than the raw {{var}} text (extra width would push every following
   * character out of sync with the caret). Vertical padding is cancelled by
   * a matching negative margin so the tint doesn't change line height. */
  padding: 1px 0;
  margin: -1px 0;
  font-weight: var(--fw-medium);
}
/* Lift the input above the overlay so caret & selection (which would
 * otherwise be hidden under the overlay's text) stay interactive. */
.url-input-wrap .url-input {
  position: relative;
  z-index: 1;
}
/* Send is the only solid-fill button in the whole toolbar — keeps it
   the unmistakable primary CTA. Slight shadow lift + brand-glow on
   hover makes it feel "energetic" without being garish. */
.url-send.ant-btn-primary {
  background: var(--pico-brand);
  border-color: var(--pico-brand);
  box-shadow: 0 2px 6px var(--pico-brand-glow);
  font-weight: var(--fw-semibold);
  height: 32px;
  padding-inline: var(--space-6);
}
.url-send.ant-btn-primary:hover {
  background: var(--pico-brand-hover) !important;
  border-color: var(--pico-brand-hover) !important;
  box-shadow: 0 4px 12px var(--pico-brand-glow);
}
.url-send.ant-btn-primary:active {
  background: var(--pico-brand-active) !important;
  border-color: var(--pico-brand-active) !important;
  transform: translateY(0.5px);
}
.req-tabs { flex: 0 0 auto; }
.req-tabs :deep(.ant-tabs-nav) {
  margin-bottom: var(--space-3);
}
.req-tabs :deep(.ant-tabs-tab) {
  padding: var(--space-3) var(--space-4);
  font-size: var(--fs-base);
}
.req-tabs :deep(.ant-tabs-tab-active .tab-label),
.req-tabs :deep(.ant-tabs-tab-active) {
  color: var(--accent-soft-fg) !important;
  font-weight: var(--fw-semibold);
}
.req-tabs :deep(.ant-tabs-ink-bar) {
  background: var(--accent);
  height: 2px;
  border-radius: var(--radius-full);
}
.tab-label { display: inline-flex; align-items: center; gap: 6px; }
.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  background: var(--accent);
  color: var(--text-on-accent);
  font-family: 'SF Mono', 'Menlo', monospace;
  line-height: 1;
}
.tab-badge-virtual {
  background: var(--accent-soft-bg);
  color: var(--accent-soft-fg);
}
.tab-badge-mode {
  background: var(--bg-muted);
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: lowercase;
  font-family: inherit;
}

.dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-warning);
  flex: 0 0 auto;
  box-shadow: 0 0 0 2px var(--bg-base);
}
</style>