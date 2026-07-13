<script setup lang="ts">
import { Empty } from 'ant-design-vue'

defineProps<{
  description?: string
}>()
</script>

<template>
  <div class="empty-state">
    <Empty :description="description ?? 'Nothing here yet'" />
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