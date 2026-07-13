<script setup lang="ts">
// Method dropdown — fixed list of common HTTP methods.
import { Select } from 'ant-design-vue'
import type { HttpMethod } from '@/core/types'
import { methodColor } from '@/utils/methodColors'

defineProps<{
  modelValue: HttpMethod
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: HttpMethod): void
}>()

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

// AntD Vue's Select @change callback passes SelectValue (string | number | ...)
// but we know our options are HttpMethod strings. Assert at the boundary.
function handleChange(v: unknown) {
  emit('update:modelValue', v as HttpMethod)
}
</script>

<template>
  <Select
    :value="modelValue"
    :options="METHODS.map(m => ({ value: m, label: m }))"
    style="width: 110px"
    @change="handleChange"
  >
    <template #option="{ value }">
      <span :style="{ color: methodColor(value as HttpMethod), fontWeight: 600 }">
        {{ value }}
      </span>
    </template>
  </Select>
</template>