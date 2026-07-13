<script setup lang="ts">
// Filter bar above the capture list. Search box + method chips + status
// chips. State is owned by the parent (v-model'd back up); this component
// is pure view.

import { Input, Tag, Button } from 'ant-design-vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()

defineProps<{
  searchQuery: string
  methodOptions: readonly string[]
  methodFilters: Set<string>
  statusOptions: ReadonlyArray<{ value: string; label: string }>
  statusFilters: Set<string>
  hasResponse: boolean
  hasActiveFilters: boolean
  filteredCount: number
  totalCount: number
}>()

defineEmits<{
  (e: 'update:search-query', v: string): void
  (e: 'toggle-method', m: string): void
  (e: 'toggle-status', s: string): void
  (e: 'clear-filters'): void
}>()
</script>

<template>
  <div class="cap-filters">
    <Input
      :value="searchQuery"
      placeholder="Search URL, method..."
      size="small"
      allow-clear
      class="cap-search"
      @update:value="(v: string) => $emit('update:search-query', v)"
    >
      <template #prefix>
        <SearchOutlined style="color: var(--text-secondary); font-size: 12px" />
      </template>
    </Input>
    <div class="cap-filter-row">
      <div class="cap-filter-group">
        <span class="cap-filter-label">{{ t.methodFilter }}</span>
        <div class="cap-filter-tags">
          <Tag
            v-for="m in methodOptions"
            :key="m"
            :color="methodFilters.has(m) ? 'blue' : 'default'"
            class="cap-filter-tag"
            @click="$emit('toggle-method', m)"
          >
            {{ m }}
          </Tag>
        </div>
      </div>
      <div v-if="hasResponse" class="cap-filter-group">
        <span class="cap-filter-label">{{ t.statusFilter }}</span>
        <div class="cap-filter-tags">
          <Tag
            v-for="s in statusOptions"
            :key="s.value"
            :color="statusFilters.has(s.value) ? 'green' : 'default'"
            class="cap-filter-tag"
            @click="$emit('toggle-status', s.value)"
          >
            {{ s.label }}
          </Tag>
        </div>
      </div>
    </div>
    <div v-if="hasActiveFilters" class="cap-filter-clear">
      <Button size="small" type="link" @click="$emit('clear-filters')">
        {{ t.clearFilters }}
      </Button>
      <span class="cap-filter-count">{{ filteredCount }} / {{ totalCount }} requests</span>
    </div>
  </div>
</template>