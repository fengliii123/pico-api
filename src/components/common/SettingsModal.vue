<script setup lang="ts">
import { computed, ref } from 'vue'
import { Modal, Segmented, Checkbox, Switch, message } from 'ant-design-vue'
import { SettingOutlined, GlobalOutlined, ThunderboltOutlined, KeyOutlined, InfoCircleOutlined, DownloadOutlined, UploadOutlined, GithubOutlined } from '@ant-design/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { useEnvironmentStore } from '@/stores/environment'
import type { Theme, CaptureFilterMode } from '@/stores/settings'
import { LOCALES, type Locale } from '@/i18n'
import { downloadTextFile } from '@/utils/download'
import { useI18n } from '@/i18n/useI18n'
import {
  exportAll,
  serializeBackup,
  parseBackup,
  importAll,
  defaultBackupFilename,
  BackupParseError
} from '@/core/backup'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const settingsStore = useSettingsStore()
const envStore = useEnvironmentStore()
const { locale, setLocale } = useI18n()

// Reading from chrome.runtime.getManifest lets the About panel show the
// same version the user sees on the Chrome Web Store listing. Outside
// extension context (e.g. unit tests in happy-dom) it falls back to a
// literal so the panel doesn't crash.
const appVersion = computed(() => {
  try {
    const c = (globalThis as any).chrome
    if (c?.runtime?.getManifest) return c.runtime.getManifest().version
  } catch { /* not in extension context */ }
  return '0.1.0'
})

// TODO: replace with the real support URL once the listing goes live.
// Surfacing it here satisfies the Chrome Web Store "visible feedback channel"
// expectation. For now this points at the Chrome Web Store listing detail
// page pattern so it resolves to *something* even before the URL is known.
const feedbackUrl = 'https://chromewebstore.google.com/detail/pico-api/reviews'

function changeLocale(l: Locale) {
  if (l === locale.value) return
  setLocale(l)
  message.success(t.value.languageChanged)
  setTimeout(() => window.location.reload(), 500)
}

// Full export dumps every store (folders, requests, environments, globals,
// history) into a single JSON file the user can re-import later. Import
// clears current data first; we confirm explicitly because it's destructive.

async function onExportAll() {
  try {
    const file = await exportAll()
    const text = serializeBackup(file)
    downloadTextFile(defaultBackupFilename(), text, 'application/json')
    message.success(t.value.exported)
  } catch (e: any) {
    message.error(String(e?.message ?? e))
  }
}

// Hidden file input lets us render a styled Antd button as the trigger
// while keeping the native picker behavior.
const importInput = ref<HTMLInputElement | null>(null)

function onImportClick() {
  importInput.value?.click()
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset value so the same file can be picked twice in a row.
  input.value = ''
  if (!file) return

  let text: string
  try {
    text = await file.text()
  } catch (e: any) {
    message.error(t.value.importFailed + ': ' + String(e?.message ?? e))
    return
  }

  let parsed
  try {
    parsed = parseBackup(text)
  } catch (e: any) {
    const msg = e instanceof BackupParseError ? e.message : (e?.message ?? String(e))
    message.error(t.value.invalidBackupFile + ': ' + msg)
    return
  }

  Modal.confirm({
    title: t.value.importConfirmTitle,
    content: t.value.importConfirmContent,
    okText: t.value.import,
    okType: 'danger',
    onOk: async () => {
      try {
        await importAll(parsed)
        message.success(t.value.importSuccess)
        // Reload so every Pinia store re-reads the freshly imported data.
        // Doing it per-store (load() on each) is fragile — new stores get
        // forgotten; reload is one-line and always correct.
        setTimeout(() => window.location.reload(), 600)
      } catch (e: any) {
        message.error(t.value.importFailed + ': ' + String(e?.message ?? e))
      }
    }
  })
}

const themeOptions = computed(() => [
  { value: 'light', label: t.value.light },
  { value: 'dark', label: t.value.dark },
  { value: 'eye', label: t.value.eye }
])

function onThemeChange(v: string | number | boolean) {
  settingsStore.theme = String(v) as Theme
}

const captureFilterOptions = computed(() => [
  { value: 'api-only', label: t.value.captureFilterApiOnly },
  { value: 'all', label: t.value.captureFilterAll }
])

function onCaptureFilterChange(v: string | number | boolean) {
  settingsStore.captureFilterMode = String(v) as CaptureFilterMode
}

// Keyboard shortcuts reference
const shortcuts = computed(() => [
  { key: '⌘/Ctrl + K', action: t.value.shortcutCommandPalette },
  { key: '⌘/Ctrl + P', action: t.value.shortcutQuickSwitchRequest },
  { key: '⌘/Ctrl + S', action: t.value.shortcutSaveRequest },
  { key: '⌘/Ctrl + Enter', action: t.value.shortcutSendRequest },
  { key: '⌘/Ctrl + D', action: t.value.shortcutDuplicateRequest },
  { key: '⌘/Ctrl + Z', action: t.value.shortcutUndo },
  { key: '⌘/Ctrl + ⇧ + Z', action: t.value.shortcutRedo },
  { key: '⌘/Ctrl + ⇧ + H', action: t.value.shortcutOpenHistory },
  { key: '⌘/Ctrl + ⇧ + K', action: t.value.shortcutSwitchEnvironment },
  { key: 'Esc', action: t.value.shortcutCloseModal }
])

function close() {
  emit('update:open', false)
}
</script>

<template>
  <Modal
    :open="open"
    :title="t.settings"
    width="600px"
    :footer="null"
    @cancel="close"
  >
    <div class="settings-panel">
      <!-- Appearance -->
      <section class="settings-section">
        <h3 class="section-title">
          <span class="section-icon">🎨</span>
          {{ t.appearance }}
        </h3>
        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">{{ t.theme }}</span>
            <span class="setting-description">{{ t.themeDescription }}</span>
          </div>
          <Segmented
            :value="settingsStore.theme"
            :options="themeOptions"
            @change="onThemeChange"
          />
        </div>
      </section>

      <!-- Behavior -->
      <section class="settings-section">
        <h3 class="section-title">
          <span class="section-icon">⚙️</span>
          {{ t.behavior }}
        </h3>
        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">{{ t.autoSaveHistory }}</span>
            <span class="setting-description">{{ t.autoSaveDescription }}</span>
          </div>
          <Switch v-model:checked="settingsStore.autoSaveHistory" />
        </div>
        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">{{ t.sendBrowserCookies }}</span>
            <span class="setting-description">{{ t.sendCookiesDescription }}</span>
          </div>
          <Switch v-model:checked="settingsStore.sendBrowserCookies" />
        </div>
        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">{{ t.captureFilterMode }}</span>
            <span class="setting-description">{{ t.captureFilterDescription }}</span>
          </div>
          <Segmented
            :value="settingsStore.captureFilterMode"
            :options="captureFilterOptions"
            @change="onCaptureFilterChange"
          />
        </div>
      </section>

      <!-- Language -->
      <section class="settings-section">
        <h3 class="section-title">
          <span class="section-icon">🌐</span>
          {{ t.language }}
        </h3>
        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">{{ t.interfaceLanguage }}</span>
            <span class="setting-description">{{ t.selectLanguageHint }}</span>
          </div>
          <div class="locale-buttons">
            <button
              v-for="(config, key) in LOCALES"
              :key="key"
              class="locale-btn"
              :class="{ active: locale === key }"
              @click="changeLocale(key as Locale)"
            >
              {{ config.flag }} {{ config.name }}
            </button>
          </div>
        </div>
      </section>

      <!-- Data Management -->
      <section class="settings-section">
        <h3 class="section-title">
          <span class="section-icon">💾</span>
          {{ t.dataManagement }}
        </h3>
        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">{{ t.exportAllData }}</span>
            <span class="setting-description">{{ t.exportAllDataHint }}</span>
          </div>
          <button class="data-btn" @click="onExportAll">
            <DownloadOutlined /> {{ t.export }}
          </button>
        </div>
        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">{{ t.importAllData }}</span>
            <span class="setting-description">{{ t.importAllDataHint }}</span>
          </div>
          <button class="data-btn" @click="onImportClick">
            <UploadOutlined /> {{ t.import }}
          </button>
          <input
            ref="importInput"
            type="file"
            accept="application/json,.json"
            style="display: none"
            @change="onImportFile"
          />
        </div>
      </section>

      <!-- Environments -->
      <section class="settings-section">
        <h3 class="section-title">
          <span class="section-icon"><GlobalOutlined /></span>
          {{ t.environments }}
        </h3>
        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">{{ t.activeEnvironment }}</span>
            <span class="setting-description">{{ envStore.activeEnvironment?.name || t.noEnvironmentSelected }}</span>
          </div>
          <span class="setting-badge">
            {{ envStore.environments.length }} environment(s)
          </span>
        </div>
      </section>

      <!-- Keyboard Shortcuts -->
      <section class="settings-section">
        <h3 class="section-title">
          <span class="section-icon"><KeyOutlined /></span>
          {{ t.keyboardShortcuts }}
        </h3>
        <div class="shortcuts-table">
          <div
            v-for="shortcut in shortcuts"
            :key="shortcut.key"
            class="shortcut-row"
          >
            <kbd class="shortcut-key">{{ shortcut.key }}</kbd>
            <span class="shortcut-action">{{ shortcut.action }}</span>
          </div>
        </div>
      </section>

      <!-- About -->
      <section class="settings-section">
        <h3 class="section-title">
          <span class="section-icon"><InfoCircleOutlined /></span>
          {{ t.about }}
        </h3>
        <div class="about-info">
          <div class="about-row">
            <span class="about-label">{{ t.version }}</span>
            <span class="about-value">{{ appVersion }}</span>
          </div>
          <div class="about-row">
            <span class="about-label">{{ t.feedback }}</span>
            <a
              class="about-link"
              :href="feedbackUrl"
              target="_blank"
              rel="noopener noreferrer"
              :title="t.feedbackHint"
            >
              <GithubOutlined /> {{ t.githubIssues }}
            </a>
          </div>
        </div>
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 8px 0;
}

.settings-section {
  border-bottom: 1px solid var(--border-base);
  padding-bottom: 20px;
}

.settings-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.section-icon {
  font-size: 14px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  gap: 16px;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-description {
  font-size: 12px;
  color: var(--text-secondary);
}

.setting-badge {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-muted);
  padding: 4px 8px;
  border-radius: 4px;
}

/* Locale selector */
.locale-buttons {
  display: flex;
  gap: 8px;
}

.locale-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background: var(--bg-base);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.locale-btn:hover {
  border-color: var(--accent);
}

.locale-btn.active {
  background: var(--accent-soft-bg);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 500;
}

/* Shortcuts table */
.shortcuts-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}

.shortcut-key {
  min-width: 140px;
  padding: 4px 8px;
  background: var(--bg-muted);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 11px;
  color: var(--text-primary);
  text-align: center;
}

.shortcut-action {
  font-size: 12px;
  color: var(--text-secondary);
}

/* About */
.about-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.about-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  align-items: center;
}

.about-label {
  color: var(--text-secondary);
}

.about-value {
  color: var(--text-primary);
  font-weight: 500;
}

.about-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  font-size: 12px;
  text-decoration: none;
}

.about-link:hover {
  text-decoration: underline;
}

/* Data management buttons */
.data-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background: var(--bg-base);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
  color: var(--text-primary);
  flex-shrink: 0;
}

.data-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
