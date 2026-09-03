<script setup lang="ts">
// Top-level layout: left sidebar (tree + footer settings) + main area
// (request editor + response panel).
// On mount, loads collection data from IndexedDB and seeds an empty draft.

import { computed, nextTick, onMounted, ref } from 'vue'
import { Button } from 'ant-design-vue'
import { ImportOutlined, ExportOutlined, HistoryOutlined, ThunderboltOutlined, SettingOutlined } from '@ant-design/icons-vue'
import CollectionTree from '@/components/tree/CollectionTree.vue'
import RequestEditor from '@/components/request/RequestEditor.vue'
import ResponsePanel from '@/components/response/ResponsePanel.vue'
import EnvironmentSelector from '@/components/environment/EnvironmentSelector.vue'
import ApiImportModal from '@/components/import/ApiImportModal.vue'
import ExportModal from '@/components/export/ExportModal.vue'
import CommandPalette from '@/components/common/CommandPalette.vue'
import HistoryPanel from '@/components/common/HistoryPanel.vue'
import TemplateModal from '@/components/common/TemplateModal.vue'
import SettingsModal from '@/components/common/SettingsModal.vue'
import { useCollectionStore } from '@/stores/collection'
import { useRequestStore } from '@/stores/request'
import { useEnvironmentStore } from '@/stores/environment'
import { useKeyboardShortcuts, registerShortcut } from '@/composables/useKeyboardShortcuts'
import { useI18n } from '@/i18n/useI18n'
import { getTranslation, type Locale } from '@/i18n'
import { computeSeedRename, type SeedNames } from '@/core/seed'

const { t, locale } = useI18n()

const collStore = useCollectionStore()
const reqStore = useRequestStore()
const envStore = useEnvironmentStore()

// Setup keyboard shortcuts
const { isCommandPaletteOpen, isQuickSwitchOpen, closeCommandPalette } = useKeyboardShortcuts()

onMounted(async () => {
  await Promise.all([collStore.load(), envStore.load()])
  reqStore.newRequest(null)
  void seedExamplesIfFirstRun()
  void syncSeedLocale()

  // Register global shortcuts
  registerShortcut({
    id: 'open-history',
    combo: 'meta+shift+h',
    key: '⌘⇧H',
    description: t.value.openHistoryDesc,
    category: 'general',
    action: () => { historyOpen.value = true }
  })

  registerShortcut({
    id: 'switch-environment',
    combo: 'meta+shift+k',
    key: '⌘⇧K',
    description: t.value.quickSwitchEnvDesc,
    category: 'environment',
    action: () => { environmentQuickSwitchOpen.value = true }
  })
})

const requestEditor = ref<InstanceType<typeof RequestEditor> | null>(null)
function onResend() {
  requestEditor.value?.send?.()
}

// History "Re-run": runEntry() has already loaded the entry into the
// draft; give the editor a tick to bind, then fire it.
function onHistoryRun() {
  nextTick(() => requestEditor.value?.send?.())
}

// First-run seed: a small Examples folder so a brand-new user opens the
// app to something sendable instead of an empty tree. One-shot via
// localStorage, and never fires when the user already has data (e.g. a
// restored backup on a machine with cleared localStorage).
async function seedExamplesIfFirstRun() {
  try {
    if (localStorage.getItem('mp2:seededExamples') === '1') return
  } catch { return }
  if (collStore.folderList.length > 0 || collStore.requestList.length > 0) {
    try { localStorage.setItem('mp2:seededExamples', '1') } catch { /* ignore */ }
    return
  }
  try {
    const folder = await collStore.createFolder(null, t.value.examplesFolderName)
    await collStore.createRequest(folder.id, {
      name: t.value.exampleGetUser,
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/users/1',
      headers: [],
      params: [],
      body: { mode: 'none' }
    })
    await collStore.createRequest(folder.id, {
      name: t.value.examplePostEcho,
      method: 'POST',
      url: 'https://postman-echo.com/post',
      headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      params: [],
      body: { mode: 'raw', rawType: 'json', rawText: '{\n  "hello": "pico"\n}' }
    })
    try {
      localStorage.setItem('mp2:seededExamples', '1')
      localStorage.setItem('mp2:seededLocale', locale.value)
    } catch { /* ignore */ }
  } catch {
    // Seeding is best-effort — a failure must never block app usage.
  }
}

function seedNamesFor(l: string): SeedNames {
  const tr = getTranslation(l === 'zh-CN' ? 'zh-CN' : 'en')
  return { folder: tr.examplesFolderName, get: tr.exampleGetUser, post: tr.examplePostEcho }
}

// The seed is created in the UI locale at first run. If the user switches
// the app language later and never touched the seed, rename it to follow
// the new locale; anything user-modified is left exactly as-is.
async function syncSeedLocale() {
  let seededLocale: string | null = null
  try { seededLocale = localStorage.getItem('mp2:seededLocale') } catch { return }
  if (!seededLocale || seededLocale === locale.value) return

  const plan = computeSeedRename(
    collStore.folderList,
    collStore.requestList,
    seedNamesFor(seededLocale),
    seedNamesFor(locale.value)
  )
  if (plan) {
    try {
      await collStore.renameFolder(plan.folderId, plan.folderName)
      for (const rename of plan.requestRenames) {
        const saved = collStore.requestsById.get(rename.id)
        if (saved) {
          saved.name = rename.name
          await collStore.updateRequest(saved)
        }
      }
    } catch {
      // Best-effort — a failed rename never blocks the app.
    }
  }
  try { localStorage.setItem('mp2:seededLocale', locale.value) } catch { /* ignore */ }
}

const importOpen = ref(false)
const exportOpen = ref(false)
const historyOpen = ref(false)
const environmentQuickSwitchOpen = ref(false)
const templateOpen = ref(false)
const settingsOpen = ref(false)

// Logo asset — 32px is a good match for the sidebar header (~56px tall);
// it scales up crisply via the browser's natural image smoothing for the
// sidebar's 28px display size. Vite copies /public/* to the bundle root,
// so this resolves at runtime via chrome.runtime.getURL('icons/32.png').
// In dev (vite) it just resolves as a relative URL.
const logoSrc = computed(() => {
  const c = (globalThis as any).chrome
  if (c?.runtime?.getURL) return c.runtime.getURL('icons/32.png')
  return '/icons/32.png'
})
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title-wrap">
          <img :src="logoSrc" alt="Pico API" class="sidebar-logo" />
          <span class="sidebar-title">{{ t.appName }}</span>
        </div>
        <div class="header-actions">
          <Button size="small" type="text" class="header-btn" @click="historyOpen = true" title="History (⌘⇧H)">
            <template #icon><HistoryOutlined /></template>
          </Button>
          <span class="header-divider" />
          <Button size="small" type="text" class="header-btn" @click="templateOpen = true" title="Request Templates">
            <template #icon><ThunderboltOutlined /></template>
          </Button>
          <span class="header-divider" />
          <Button size="small" type="text" class="header-btn" @click="importOpen = true" title="Import from cURL">
            <template #icon><ImportOutlined /></template>
          </Button>
          <span class="header-divider" />
          <Button size="small" type="text" class="header-btn" @click="exportOpen = true" title="Export as OpenAPI">
            <template #icon><ExportOutlined /></template>
          </Button>
        </div>
      </div>
      <EnvironmentSelector />
      <div class="sidebar-body">
        <CollectionTree />
      </div>
      <div class="sidebar-footer">
        <Button size="small" block @click="settingsOpen = true" class="settings-btn">
          <template #icon><SettingOutlined /></template>
          {{ t.settings }}
        </Button>
      </div>
    </aside>
    <main class="main">
      <RequestEditor ref="requestEditor" />
      <ResponsePanel @resend="onResend" />
    </main>
    <ApiImportModal v-model:open="importOpen" />
    <ExportModal v-model:open="exportOpen" />
    <HistoryPanel v-model:open="historyOpen" @run="onHistoryRun" />
    <TemplateModal v-model:open="templateOpen" />
    <SettingsModal v-model:open="settingsOpen" />
    <CommandPalette
      :open="isCommandPaletteOpen"
      @close="closeCommandPalette"
      @import="importOpen = true"
      @export="exportOpen = true"
    />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
.sidebar {
  width: var(--sidebar-width);
  flex: 0 0 var(--sidebar-width);
  border-right: 1px solid var(--border-base);
  display: flex;
  flex-direction: column;
  background: var(--bg-subtle);
}
/* Narrow windows (side-panel-like widths): shrink the sidebar so the
 * request editor keeps usable space instead of being crushed to a sliver. */
@media (max-width: 640px) {
  .sidebar {
    width: 180px;
    flex-basis: 180px;
  }
}
.sidebar-header {
  padding: var(--space-4) var(--space-5);
  font-weight: var(--fw-semibold);
  font-size: var(--fs-md);
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-base);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  height: var(--header-height);
  box-sizing: border-box;
}
.sidebar-title {
  color: var(--text-primary);
  letter-spacing: -0.015em;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  white-space: nowrap;
}
.sidebar-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 0 0 auto;
  min-width: 0;
}
/* The logo is the brand asset at 32px native. Sized to 28px to align
 * visually with the title baseline + a subtle brand-tinted halo so it
 * reads as the visual anchor of the sidebar rather than a flat tile. */
.sidebar-logo {
  width: 28px;
  height: 28px;
  display: block;
  flex: 0 0 auto;
  border-radius: 7px;
  background: var(--bg-base);
  box-shadow: var(--shadow-xs), 0 0 0 1px var(--pico-brand-glow);
}
.header-actions {
  display: flex;
  align-items: center;
  /* No flex gap — dividers carry their own margin-inline so the spacing
     between any two buttons is determined solely by the divider layout.
     Keeps the rhythm consistent regardless of how many dividers sit
     between buttons. */
  gap: 0;
  flex: 0 0 auto;
}
/* Header buttons — 28px squares match the logo size so the whole row
   reads as a single visual rhythm. type="text" gives them no border;
   soft hover bg makes them read as a cluster. */
.header-actions :deep(.header-btn.ant-btn-text) {
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
}
.header-actions :deep(.header-btn.ant-btn-text:hover) {
  background: var(--bg-muted);
  color: var(--text-primary);
}
.header-actions :deep(.header-btn.ant-btn-text .anticon) {
  font-size: 15px;
}
.header-divider {
  width: 1px;
  height: 16px;
  background: var(--border-strong);
  margin-inline: 4px;
  flex: 0 0 auto;
  opacity: 0.7;
}
.sidebar-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.sidebar-footer {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-base);
  background: var(--bg-base);
  flex: 0 0 auto;
}
.settings-btn {
  justify-content: flex-start;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--bg-base);
}
</style>