<script setup lang="ts">
import { computed } from 'vue'
import { theme as antdTheme, ConfigProvider } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUS from 'ant-design-vue/es/locale/en_US'
import AppLayout from '@/components/layout/AppLayout.vue'
import OnboardingModal from '@/components/common/OnboardingModal.vue'
import { useSettingsStore } from '@/stores/settings'
import { useI18n } from '@/i18n/useI18n'

const settings = useSettingsStore()
const { locale } = useI18n()

// Sync Ant Design components with our data-theme. antd-vue 4.x takes the
// algorithm via the `theme.algorithm` field on ConfigProvider. 'eye' uses
// the light algorithm but our CSS variables paint it green.
const isDark = computed(() => settings.theme === 'dark')

// Drive Ant Design's built-in copy (Modal OK/Cancel, Empty, Pagination…)
// from the same locale ref our own i18n uses, so the whole UI stays in
// one language instead of mixed English/Chinese.
const antdLocale = computed(() => (locale.value === 'zh-CN' ? zhCN : enUS))

// Pull the brand primary out of the active theme's CSS variable so AntD
// tokens follow the same palette the rest of the UI paints from. Reading
// at call-time (rather than caching) means a future theme switch — once
// applyTheme writes new --pico-brand values — propagates without a remount.
function readBrandColor(): string {
  if (typeof window === 'undefined') return '#00C9A7'
  const v = getComputedStyle(document.documentElement).getPropertyValue('--pico-brand').trim()
  return v || '#00C9A7'
}

const themeConfig = computed(() => ({
  algorithm: isDark.value ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: readBrandColor(),
    borderRadius: 6
  }
}))
</script>

<template>
  <ConfigProvider :theme="themeConfig" :locale="antdLocale">
    <AppLayout />
    <OnboardingModal />
  </ConfigProvider>
</template>

<style>
html, body, #app {
  margin: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
/* The base body background tracks our data-theme tokens so the area
   outside any antd component matches the chosen palette. */
html { background: var(--bg-base); color: var(--text-primary); }
</style>
