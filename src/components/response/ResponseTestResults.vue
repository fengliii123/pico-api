<script setup lang="ts">
// Test results + script logs panel. Shown as a tab in ResponsePanel
// whenever the user wrote a pre-request or post-response script that
// produced any output (test assertions OR console.log lines).

import { computed } from 'vue'
import { CheckCircleFilled, CloseCircleFilled, CodeOutlined } from '@ant-design/icons-vue'
import type { ScriptTestResult, ScriptLogs } from '@/stores/response'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()
const props = defineProps<{
  testResults?: ScriptTestResult[]
  logs?: ScriptLogs
}>()

const tests = computed(() => props.testResults ?? [])
const passed = computed(() => tests.value.filter(r => r.passed).length)
const failed = computed(() => tests.value.filter(r => !r.passed).length)

const preLogs = computed(() => props.logs?.preRequest ?? [])
const postLogs = computed(() => props.logs?.postResponse ?? [])
</script>

<template>
  <div class="test-results">
    <!-- Summary line -->
    <div class="tests-summary">
      <span v-if="failed > 0" class="summary-pill summary-fail">
        <CloseCircleFilled /> {{ failed }} failed
      </span>
      <span v-if="passed > 0" class="summary-pill summary-pass">
        <CheckCircleFilled /> {{ passed }} passed
      </span>
      <span v-if="tests.length === 0" class="summary-empty">
        No test assertions.
      </span>
    </div>

    <!-- Test results list -->
    <div v-if="tests.length > 0" class="tests-section">
      <div
        v-for="(tr, idx) in tests"
        :key="idx"
        class="test-row"
        :class="{ 'test-failed': !tr.passed }"
      >
        <CheckCircleFilled v-if="tr.passed" class="test-icon test-icon-pass" />
        <CloseCircleFilled v-else class="test-icon test-icon-fail" />
        <span class="test-name">{{ tr.name }}</span>
        <span v-if="tr.error" class="test-error">{{ tr.error }}</span>
      </div>
    </div>

    <!-- Pre-request logs -->
    <div v-if="preLogs.length > 0" class="logs-section">
      <div class="logs-title">
        <CodeOutlined /> Pre-request script output
      </div>
      <pre class="logs-block logs-pre">{{ preLogs.join('\n') }}</pre>
    </div>

    <!-- Post-response logs -->
    <div v-if="postLogs.length > 0" class="logs-section">
      <div class="logs-title">
        <CodeOutlined /> Post-response script output
      </div>
      <pre class="logs-block logs-post">{{ postLogs.join('\n') }}</pre>
    </div>

    <div v-if="tests.length === 0 && preLogs.length === 0 && postLogs.length === 0" class="tests-empty">
      {{ t.scripts }} produced no output.
    </div>
  </div>
</template>

<style scoped>
.test-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5) 0;
}
.tests-summary {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.summary-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 2px var(--space-4);
  border-radius: var(--radius-full);
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
}
.summary-pass {
  background: var(--status-success-bg);
  color: var(--status-success);
}
.summary-fail {
  background: var(--status-danger-bg);
  color: var(--status-danger);
}
.summary-empty {
  font-size: var(--fs-sm);
  color: var(--text-tertiary);
}

.tests-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.test-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-base);
  border-radius: var(--radius-base);
  border: 1px solid var(--border-base);
  font-size: var(--fs-sm);
}
.test-row.test-failed {
  background: var(--status-danger-bg);
  border-color: var(--status-danger);
}
.test-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  font-size: 14px;
}
.test-icon-pass { color: var(--status-success); }
.test-icon-fail { color: var(--status-danger); }
.test-name {
  flex: 0 0 auto;
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  word-break: break-word;
}
.test-error {
  flex: 1;
  color: var(--status-danger);
  font-family: 'SF Mono', 'Menlo', ui-monospace, monospace;
  font-size: var(--fs-xs);
  word-break: break-word;
}

.logs-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.logs-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}
.logs-block {
  margin: 0;
  padding: var(--space-4);
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  font-family: 'SF Mono', 'Menlo', ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow: auto;
}

.tests-empty {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
}
</style>