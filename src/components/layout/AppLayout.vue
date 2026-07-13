<script setup lang="ts">
// Top-level layout: left sidebar (tree + footer settings) + main area
// (request editor + response panel).
// On mount, loads collection data from IndexedDB and seeds an empty draft.

import { computed, onMounted, ref } from 'vue'
import { Button, Segmented } from 'ant-design-vue'
import { ImportOutlined, ExportOutlined, MenuOutlined, FullscreenOutlined, ApiOutlined, AimOutlined, HistoryOutlined, ThunderboltOutlined, SettingOutlined } from '@ant-design/icons-vue'
import CollectionTree from '@/components/tree/CollectionTree.vue'
import CapturePanel from '@/components/capture/CapturePanel.vue'
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

const { t } = useI18n()

const collStore = useCollectionStore()
const reqStore = useRequestStore()
const envStore = useEnvironmentStore()

// Setup keyboard shortcuts
const { isCommandPaletteOpen, isQuickSwitchOpen, closeCommandPalette } = useKeyboardShortcuts()

onMounted(async () => {
  await Promise.all([collStore.load(), envStore.load()])
  reqStore.newRequest(null)

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

const importOpen = ref(false)
const exportOpen = ref(false)
const historyOpen = ref(false)
const environmentQuickSwitchOpen = ref(false)
const templateOpen = ref(false)
const settingsOpen = ref(false)

// Sidebar mode: which "pane" shows under the environment selector.
// `requests` is the normal collection tree; `capture` is the live
// network-capture list. Defaulting to requests keeps the UX exactly the
// same as before for users who don't care about capture.
type SidebarMode = 'requests' | 'capture'
const sidebarMode = ref<SidebarMode>('requests')
const modeOptions = computed(() => [
  { value: 'requests', label: t.value.sidebarModeRequests, icon: ApiOutlined },
  { value: 'capture', label: t.value.sidebarModeCapture, icon: AimOutlined }
])
function onModeChange(v: string | number | boolean) {
  sidebarMode.value = String(v) as SidebarMode
}

const isSidePanel = computed(() => {
  if (typeof location === 'undefined') return false
  return /\/sidepanel\b/.test(location.pathname)
})

const sidebarOpen = ref(false)
function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }

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

function openOptionsPage() {
  const c = (globalThis as any).chrome
  c?.runtime?.openOptionsPage?.()
  // Side Panel has no API to close itself, but `window.close()` inside a
  // side panel context dismisses it. We do this AFTER opening options so
  // the user isn't left staring at an empty panel while the new tab loads.
  if (isSidePanel.value) {
    try { window.close() } catch { /* ignore — not in side panel context */ }
  }
}
</script>

<template>
  <div class="app-layout" :class="{ 'app-layout-side-panel': isSidePanel }">
    <div v-if="isSidePanel" class="topbar-narrow">
      <Button size="small" type="text" @click="toggleSidebar" title="Toggle sidebar">
        <template #icon><MenuOutlined /></template>
      </Button>
      <img :src="logoSrc" alt="Pico API" class="narrow-logo" />
      <span class="narrow-title">{{ t.appName }}</span>
      <Button size="small" type="text" @click="openOptionsPage" title="Open full page">
        <template #icon><FullscreenOutlined /></template>
      </Button>
    </div>
    <aside class="sidebar" :class="{ 'sidebar-open': isSidePanel && sidebarOpen }">
      <div v-if="!isSidePanel" class="sidebar-header">
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
      <div class="sidebar-mode">
        <Segmented
          block
          size="small"
          :value="sidebarMode"
          :options="modeOptions"
          @change="onModeChange"
        />
      </div>
      <EnvironmentSelector v-show="sidebarMode === 'requests'" />
      <div class="sidebar-body">
        <template v-if="sidebarMode === 'requests'">
          <CollectionTree />
        </template>
        <CapturePanel v-else />
      </div>
      <div class="sidebar-footer">
        <Button size="small" block @click="settingsOpen = true" class="settings-btn">
          <template #icon><SettingOutlined /></template>
          {{ t.settings }}
        </Button>
      </div>
    </aside>
    <div
      v-if="isSidePanel"
      class="sidebar-backdrop"
      :class="{ 'sidebar-backdrop-visible': sidebarOpen }"
      @click="sidebarOpen = false"
    />
    <main class="main">
      <RequestEditor ref="requestEditor" />
      <ResponsePanel @resend="onResend" />
    </main>
    <ApiImportModal v-model:open="importOpen" />
    <ExportModal v-model:open="exportOpen" />
    <HistoryPanel v-model:open="historyOpen" />
    <TemplateModal v-model:open="templateOpen" />
    <SettingsModal v-model:open="settingsOpen" />
    <CommandPalette
      :open="isCommandPaletteOpen"
      @update:open="(v) => isCommandPaletteOpen = v"
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
.sidebar-mode {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-base);
  flex: 0 0 auto;
  background: var(--bg-base);
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

/* ----- Side Panel narrow layout -----
 * In side-panel context the sidebar hides off-screen by default and
 * slides in over the content via the .sidebar-open toggle. A scrim
 * behind it dismisses on click. The .topbar-narrow above the main
 * area shows the hamburger + title + "open full page" button.
 */
.topbar-narrow {
  display: none; /* only in side-panel mode (below) */
}
.app-layout-side-panel {
  flex-direction: column;
}
.app-layout-side-panel .sidebar {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 50;
  transform: translateX(-100%);
  transition: transform 0.2s ease;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
}
.app-layout-side-panel .sidebar-open {
  transform: translateX(0);
}
.app-layout-side-panel .topbar-narrow {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  background: var(--bg-base);
  border-bottom: 1px solid var(--border-base);
  flex: 0 0 auto;
  height: var(--header-height);
  box-sizing: border-box;
}
.app-layout-side-panel .main {
  flex: 1;
  /* Stack under topbar-narrow. AppLayout uses flex column in side-panel
     mode (set above), so this just lets main fill remaining space. */
}
.narrow-title {
  flex: 1;
  font-size: var(--fs-base);
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
  letter-spacing: -0.01em;
}
.narrow-logo {
  width: 22px;
  height: 22px;
  display: block;
  flex: 0 0 auto;
  border-radius: 5px;
}
.sidebar-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 40;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.sidebar-backdrop-visible {
  opacity: 1;
  pointer-events: auto;
}
</style>