<script setup lang="ts">
import { computed, ref } from 'vue'
import { Dropdown, Button, Menu } from 'ant-design-vue'
import { GlobalOutlined, DownOutlined } from '@ant-design/icons-vue'
import { useEnvironmentStore } from '@/stores/environment'
import EnvironmentModal from './EnvironmentModal.vue'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()
const envStore = useEnvironmentStore()
const modalOpen = ref(false)

defineExpose({ openModal: () => (modalOpen.value = true) })

const currentLabel = computed(() => {
  if (envStore.activeEnvironment) return envStore.activeEnvironment.name
  return t.value.noEnvironment
})

function onMenuClick({ key }: { key: string | number }) {
  const k = String(key)
  if (k === '__none__') {
    envStore.setActive(null)
  } else if (k === '__manage__') {
    modalOpen.value = true
  } else {
    envStore.setActive(k)
  }
}

// The Menu items prop is a flat array. We render through the #overlay slot
// with a real <Menu> so click handling is robust (the `menu` prop form
// had a portal/visibility bug in our setup).
const menuItems = computed(() => {
  const list: any[] = [{ key: '__none__', label: t.value.noEnvironment }]
  if (envStore.environments.length > 0) list.push({ type: 'divider' })
  for (const e of envStore.environments) {
    list.push({ key: e.id, label: e.name })
  }
  list.push({ type: 'divider' })
  list.push({ key: '__manage__', label: t.value.manageEnvironments + '…' })
  return list
})
</script>

<template>
  <div class="env-selector">
    <Dropdown trigger="click" placement="bottomLeft">
      <Button size="small" class="env-trigger">
        <GlobalOutlined />
        <span class="env-label">{{ currentLabel }}</span>
        <DownOutlined class="env-caret" />
      </Button>
      <template #overlay>
        <Menu :items="menuItems" @click="onMenuClick" />
      </template>
    </Dropdown>
    <EnvironmentModal v-model:open="modalOpen" />
  </div>
</template>

<style scoped>
.env-selector {
  display: flex;
  padding: 0 12px 8px;
}
.env-trigger {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
  justify-content: flex-start;
  color: #374151;
  font-size: 12px;
  overflow: hidden;
}
.env-trigger :deep(.anticon-global) {
  color: #6b7280;
  font-size: 12px;
}
.env-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.env-caret {
  font-size: 10px;
  color: #9ca3af;
}
</style>
