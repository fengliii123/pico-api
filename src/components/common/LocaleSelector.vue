<script setup lang="ts">
// Language selector dropdown for i18n

import { computed } from 'vue'
import { Dropdown, Menu } from 'ant-design-vue'
import { GlobalOutlined } from '@ant-design/icons-vue'
import { useI18n, type Locale } from '@/i18n/useI18n'
import { LOCALES } from '@/i18n'

const { locale, setLocale } = useI18n()

const currentLocale = computed(() => LOCALES[locale.value])

function selectLocale(l: Locale) {
  setLocale(l)
  // The locale ref is shared across components (see useI18n.ts), so
  // changing it re-renders every component that uses `t`. No reload
  // needed.
}
</script>

<template>
  <Dropdown trigger="click" placement="bottomRight">
    <Button size="small" type="text" title="Change language">
      <template #icon><GlobalOutlined /></template>
      <span class="locale-label">{{ currentLocale.flag }}</span>
    </Button>
    <template #overlay>
      <Menu>
        <Menu.Item
          v-for="(config, key) in LOCALES"
          :key="key"
          @click="selectLocale(key as Locale)"
        >
          <span :class="{ 'locale-active': locale === key }">
            {{ config.flag }} {{ config.name }}
          </span>
        </Menu.Item>
      </Menu>
    </template>
  </Dropdown>
</template>

<style scoped>
.locale-label {
  margin-left: 4px;
  font-size: 14px;
}
.locale-active {
  font-weight: 600;
}
</style>
