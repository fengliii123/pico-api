<script setup lang="ts">
import { Empty } from 'ant-design-vue'
import { useI18n } from '@/i18n/useI18n'

defineProps<{
  description?: string
}>()

const { t } = useI18n()
</script>

<template>
  <div class="empty-state">
    <Empty :description="description ?? t.nothingHereYet">
      <slot name="action" />
    </Empty>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 32px;
}
</style>
