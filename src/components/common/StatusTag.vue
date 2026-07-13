<script setup lang="ts">
import { computed } from 'vue'
import { Tag } from 'ant-design-vue'
import { statusColor } from '@/utils/format'

const props = defineProps<{ status: number }>()
const text = computed(() => `${props.status}`)
const color = computed(() => statusColor(props.status))
</script>

<template>
  <Tag :color="color">{{ text }}</Tag>
</template>