<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Button as AButton } from 'ant-design-vue'
import {
  WarningFilled,
  GlobalOutlined,
  ApiOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons-vue'
import type { ResponseState } from '@/stores/response'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()
const props = defineProps<{
  state: Extract<ResponseState, { kind: 'error' }>
  currentUrl: string
}>()

const errorIcon = computed(() => {
  switch (props.state.errorKind) {
    case 'cors': return GlobalOutlined
    case 'dns': return ApiOutlined
    case 'connect': return ApiOutlined
    case 'tls': return SafetyCertificateOutlined
    case 'timeout': return ClockCircleOutlined
    case 'aborted': return MinusCircleOutlined
    default: return QuestionCircleOutlined
  }
})
</script>

<template>
  <div class="response-error">
    <Alert type="error" show-icon :message="state.message">
      <template #icon>
        <component :is="errorIcon" />
      </template>
    </Alert>
    <div class="error-hints">
      <div v-if="state.errorKind === 'cors'" class="error-hint">
        <strong>{{ t.whyThisHappens }}</strong> {{ t.corsHintDetail }}
        See the
        <a
          href="https://www.w3.org/TR/XMLHttpRequest/#the-status-attribute"
          target="_blank"
          rel="noreferrer noopener"
        >W3C XMLHttpRequest spec</a>
        for details.
        <div class="error-actions">
          <AButton
            v-if="currentUrl"
            size="small"
            type="primary"
            ghost
            :href="currentUrl"
            target="_blank"
            rel="noreferrer noopener"
          >
            {{ t.openUrlNewTab }}
          </AButton>
        </div>
      </div>
      <div v-else-if="state.errorKind === 'dns'" class="error-hint">
        <strong>{{ t.whyThisHappens }}</strong> {{ t.dnsHintDetail }}
      </div>
      <div v-else-if="state.errorKind === 'connect'" class="error-hint">
        <strong>{{ t.whyThisHappens }}</strong> {{ t.connectHintDetail }}
      </div>
      <div v-else-if="state.errorKind === 'tls'" class="error-hint">
        <strong>{{ t.whyThisHappens }}</strong> {{ t.tlsHintDetail }}
      </div>
      <div v-else-if="state.errorKind === 'timeout'" class="error-hint">
        <strong>{{ t.whyThisHappens }}</strong> {{ t.timeoutHintDetail }}
      </div>
      <div v-else-if="state.errorKind === 'aborted'" class="error-hint">
        {{ t.requestCancelled }}
      </div>
      <details v-if="state.originalMessage" class="error-detail">
        <summary>{{ t.originalError }}</summary>
        <code>{{ state.originalMessage }}</code>
      </details>
    </div>
  </div>
</template>

<style scoped>
.response-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  flex-direction: column;
  gap: 12px;
}
.error-hints {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.error-hint {
  font-size: var(--fs-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}
.error-hint code {
  background: var(--bg-muted);
  padding: 1px 6px;
  border-radius: var(--radius-base);
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: var(--fs-xs);
}
.error-actions {
  margin-top: var(--space-3);
}
.error-detail {
  margin-top: var(--space-4);
  font-size: var(--fs-xs);
  color: var(--text-tertiary);
}
.error-detail summary {
  cursor: pointer;
  user-select: none;
}
.error-detail code {
  display: block;
  margin-top: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-muted);
  border-radius: var(--radius-base);
  font-family: 'SF Mono', 'Menlo', monospace;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
