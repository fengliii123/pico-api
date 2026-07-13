<script setup lang="ts">
import { Tag, Tooltip, Button } from 'ant-design-vue'
import { SaveOutlined } from '@ant-design/icons-vue'
import StatusTag from '@/components/common/StatusTag.vue'
import { useI18n } from '@/i18n/useI18n'
import type { CapturedRequest } from '@/core/types'

const { t } = useI18n()

defineProps<{
  req: CapturedRequest
  expanded: boolean
  methodTagColor: (method: string) => string
  shortenUrl: (url: string) => string
  formatTime: (ts: number) => string
}>()

defineEmits<{
  (e: 'toggle-expand', id: string): void
  (e: 'load-to-editor', req: CapturedRequest): void
  (e: 'begin-save', req: CapturedRequest): void
}>()
</script>

<template>
  <div
    class="cap-row"
    :class="{ 'cap-row-open': expanded }"
    @dblclick="$emit('load-to-editor', req)"
  >
    <div class="cap-row-main" @click="$emit('toggle-expand', req.cdpRequestId)">
      <Tag :color="methodTagColor(req.method)" class="cap-method">{{ req.method }}</Tag>
      <span class="cap-url" :title="req.url">{{ shortenUrl(req.url) }}</span>
      <StatusTag v-if="req.response" :status="req.response.status" class="cap-status" />
      <span class="cap-time">{{ formatTime(req.timestamp) }}</span>
    </div>
    <div class="cap-row-actions">
      <Tooltip :title="t.saveToCollection">
        <Button size="small" type="text" @click.stop="$emit('begin-save', req)">
          <template #icon><SaveOutlined /></template>
        </Button>
      </Tooltip>
    </div>
    <div v-if="expanded" class="cap-row-detail">
      <div class="cap-detail-section">
        <div class="cap-detail-label">{{ t.capDetailUrl }}</div>
        <textarea
          class="cap-detail-textarea cap-mono"
          :value="req.url"
          rows="1"
          readonly
          spellcheck="false"
          @click="($event.target as HTMLTextAreaElement).select()"
        />
      </div>
      <div v-if="req.headers.length > 0" class="cap-detail-section">
        <div class="cap-detail-label">{{ t.capDetailRequestHeaders }}</div>
        <div class="cap-detail-rows">
          <div v-for="[k, v] in req.headers" :key="k" class="cap-detail-row">
            <span class="cap-detail-key cap-mono">{{ k }}:</span>
            <textarea
              class="cap-detail-textarea cap-mono"
              :value="v"
              rows="1"
              readonly
              spellcheck="false"
              @click="($event.target as HTMLTextAreaElement).select()"
            />
          </div>
        </div>
      </div>
      <div v-if="req.postData" class="cap-detail-section">
        <div class="cap-detail-label">{{ t.capDetailRequestBody }}</div>
        <textarea
          class="cap-detail-textarea cap-detail-body cap-mono"
          :value="req.postData"
          rows="3"
          readonly
          spellcheck="false"
          @click="($event.target as HTMLTextAreaElement).select()"
        />
      </div>
      <div v-if="req.response" class="cap-detail-section">
        <div class="cap-detail-label">{{ t.capDetailResponse }}</div>
        <div class="cap-detail-value">
          <StatusTag :status="req.response.status" />
          <span class="cap-mime">{{ req.response.mimeType }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
