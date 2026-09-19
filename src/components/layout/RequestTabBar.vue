<script setup lang="ts">
// Request tab bar: one tab per open request (admin-system / Postman style).
// The request store owns the bookkeeping (tabs list, activation, per-tab
// dirty via draftCache); this component is a thin render + dispatch layer.
// The bar only appears once a second tab exists — with a single request
// open it would just duplicate the editor's name input.
import { computed } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { useRequestStore, NEW_REQUEST_KEY } from '@/stores/request'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()
const reqStore = useRequestStore()

const activeKey = computed(() => reqStore.draft.id ?? NEW_REQUEST_KEY)

const tabItems = computed(() =>
  reqStore.tabs.map(key => ({
    key,
    label: reqStore.tabLabel(key),
    dirty: reqStore.isTabDirty(key)
  }))
)

function onAuxClick(e: MouseEvent, key: string) {
  // Middle-click closes; preventDefault suppresses the browser's
  // autoscroll panning that normally follows.
  if (e.button === 1) {
    e.preventDefault()
    reqStore.closeTab(key)
  }
}
</script>

<template>
  <div v-if="tabItems.length > 1" class="request-tabbar" role="tablist">
    <div
      v-for="item in tabItems"
      :key="item.key"
      class="req-tab"
      :class="{ active: item.key === activeKey }"
      role="tab"
      :aria-selected="item.key === activeKey"
      :title="item.label"
      @click="reqStore.activateTab(item.key)"
      @auxclick="(e: MouseEvent) => onAuxClick(e, item.key)"
    >
      <span class="req-tab-name">{{ item.label }}</span>
      <span v-if="item.dirty" class="req-tab-dirty" />
      <button
        class="req-tab-close"
        :title="t.closeTab"
        @click.stop="reqStore.closeTab(item.key)"
      >
        <CloseOutlined />
      </button>
    </div>
  </div>
</template>

<style scoped>
.request-tabbar {
  display: flex;
  align-items: stretch;
  gap: 2px;
  flex: 0 0 auto;
  overflow-x: auto;
  padding: var(--space-3) var(--space-6) 0;
  background: var(--bg-base);
  scrollbar-width: thin;
}
.req-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px 5px 12px;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  max-width: 220px;
  user-select: none;
  flex: 0 0 auto;
}
.req-tab:hover {
  color: var(--text-primary);
}
.req-tab.active {
  background: var(--bg-muted);
  color: var(--text-primary);
  font-weight: var(--fw-medium);
  /* Accent underline ties the active tab to the editor's tab strip below. */
  box-shadow: inset 0 -2px 0 var(--accent);
}
.req-tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.req-tab-dirty {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--status-warning);
  flex: 0 0 auto;
}
.req-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  border-radius: var(--radius-base);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 11px;
  cursor: pointer;
  flex: 0 0 auto;
}
.req-tab-close:hover {
  color: var(--tag-danger-fg);
  background: var(--tag-danger-bg);
}
</style>
