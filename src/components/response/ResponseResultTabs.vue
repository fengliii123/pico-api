<script setup lang="ts">
// Tabs for a completed response (body / headers / cookies / tests).
// Shared by the success and streaming-completed branches of ResponsePanel
// so the two renderings can never drift apart.
import { Tabs } from 'ant-design-vue'
import StatusTag from '@/components/common/StatusTag.vue'
import ResponseBodyRenderer from './ResponseBodyRenderer.vue'
import ResponseTestResults from './ResponseTestResults.vue'
import { formatBytes, formatTime } from '@/utils/format'
import { useI18n } from '@/i18n/useI18n'
import type { ResponseResult } from '@/core/types'
import type { ParsedCookie } from '@/core/cookies'
import type { ScriptTestResult, ScriptLogs } from '@/stores/response'

const { t } = useI18n()

defineProps<{
  result: ResponseResult
  cookies?: ParsedCookie[]
  testResults?: ScriptTestResult[]
  scriptLogs?: ScriptLogs
  // 4xx/5xx — tints the status/time meta the same way the error banner does.
  httpError?: boolean
}>()

const activeKey = defineModel<string>('activeKey')
</script>

<template>
  <Tabs v-model:active-key="activeKey" class="body-tabs" :class="{ 'is-http-error': httpError }">
    <template #tabBarExtraContent>
      <span class="tabs-extra">
        <StatusTag :status="result.status" />
        <span class="tabs-extra-meta">
          {{ formatTime(result.time) }} · {{ formatBytes(result.body.size) }}
        </span>
      </span>
    </template>
    <Tabs.TabPane key="body" :tab="t.response">
      <ResponseBodyRenderer :result="result" />
    </Tabs.TabPane>

    <Tabs.TabPane key="headers" :tab="t.headers">
      <div class="headers-table">
        <div class="headers-header">
          <span class="h-col-name">{{ t.headerName }}</span>
          <span class="h-col-value">{{ t.value }}</span>
        </div>
        <div
          v-for="[k, v] in result.headers"
          :key="k"
          class="headers-row"
        >
          <div class="h-col-name headers-key">{{ k }}</div>
          <textarea
            class="h-col-value headers-value-textarea"
            :value="v"
            rows="1"
            readonly
            spellcheck="false"
            @click="($event.target as HTMLTextAreaElement).select()"
          />
        </div>
      </div>
    </Tabs.TabPane>

    <Tabs.TabPane v-if="(cookies ?? []).length > 0" key="cookies">
      <template #tab>
        <span class="tab-label">{{ t.cookies }}
          <span class="tab-badge">{{ cookies!.length }}</span>
        </span>
      </template>
      <div class="cookies-table">
        <div class="cookies-header">
          <span class="c-col-name">{{ t.cookieName }}</span>
          <span class="c-col-value">{{ t.cookieValue }}</span>
          <span class="c-col-domain">{{ t.cookieDomain }}</span>
          <span class="c-col-path">{{ t.cookiePath }}</span>
          <span class="c-col-flags">{{ t.cookieFlags }}</span>
        </div>
        <div
          v-for="(c, idx) in cookies"
          :key="idx"
          class="cookies-row"
        >
          <span class="c-col-name cookies-key">{{ c.name }}</span>
          <span class="c-col-value cookies-value">{{ c.value }}</span>
          <span class="c-col-domain">{{ c.domain || '—' }}</span>
          <span class="c-col-path">{{ c.path || '—' }}</span>
          <span class="c-col-flags cookies-flags">
            <span v-if="c.httpOnly" class="cookie-flag cookie-flag-httponly">{{ t.cookieHttpOnly }}</span>
            <span v-if="c.secure" class="cookie-flag cookie-flag-secure">{{ t.cookieSecure }}</span>
            <span v-if="c.sameSite" class="cookie-flag">{{ c.sameSite }}</span>
          </span>
        </div>
      </div>
    </Tabs.TabPane>

    <Tabs.TabPane
      v-if="(testResults ?? []).length > 0 || (scriptLogs?.preRequest?.length ?? 0) > 0 || (scriptLogs?.postResponse?.length ?? 0) > 0"
      key="tests"
    >
      <template #tab>
        <span class="tab-label">{{ t.responseTestsTab }}
          <span v-if="testResults!.filter(r => !r.passed).length > 0" class="tab-badge tab-badge-fail">
            {{ testResults!.filter(r => !r.passed).length }}
          </span>
          <span v-else-if="(testResults ?? []).length > 0" class="tab-badge tab-badge-pass">
            {{ testResults!.length }}
          </span>
        </span>
      </template>
      <ResponseTestResults :test-results="testResults ?? []" :logs="scriptLogs" />
    </Tabs.TabPane>
  </Tabs>
</template>

<style scoped>
/* Antd's Tabs content area also needs to be a proper flex child so the
   headers/cookies tables can scroll instead of getting clipped to 0. */
.body-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.body-tabs :deep(.ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.body-tabs :deep(.ant-tabs-nav) { margin-bottom: 8px; }

.tabs-extra {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #1f2937;
}
.tabs-extra-meta {
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 11px;
  color: var(--text-secondary);
}
/* 4xx / 5xx response — tint the meta like the error banner. */
.body-tabs.is-http-error .tabs-extra-meta { color: var(--tag-danger-fg); }

.tab-label { display: inline-flex; align-items: center; gap: 6px; }
.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  background: var(--accent);
  color: var(--bg-base);
  font-family: 'SF Mono', 'Menlo', monospace;
  line-height: 1;
}
.tab-badge-pass {
  background: var(--status-success);
}
.tab-badge-fail {
  background: var(--status-danger);
}

/* ----- Headers tab ----- */
.headers-table {
  background: var(--bg-base);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  overflow: hidden;
}
.headers-header {
  display: grid;
  grid-template-columns: 0.8fr 1.6fr;
  gap: 12px;
  padding: 6px 12px;
  background: var(--bg-muted);
  border-bottom: 1px solid var(--border-strong);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.headers-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 8px;
  padding: 4px 12px;
  border-bottom: 1px solid var(--border-base);
  font-size: 12.5px;
  align-items: start;
}
.headers-row:nth-child(even) { background: var(--bg-muted); }
.headers-row:last-of-type { border-bottom: none; }
.headers-key {
  font-family: 'SF Mono', 'Menlo', monospace;
  color: var(--code-key);
  font-weight: 500;
  word-break: break-all;
  padding-top: 2px;
}
.headers-value-textarea {
  width: 100%;
  min-height: 24px;
  /* auto-grow: textarea with field-sizing: content (Chrome 123+) wraps
     and shows every line without manual resize. Browsers without it
     fall back to a 1-row input the user can scroll. */
  field-sizing: content;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 12.5px;
  color: var(--text-primary);
  background: transparent;
  border: 1px solid var(--border-base);
  border-radius: 3px;
  padding: 2px 6px;
  resize: vertical;
  outline: none;
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.4;
}
.headers-value-textarea:focus {
  border-color: var(--accent);
  background: var(--bg-base);
}

/* ----- Cookies tab ----- */
.cookies-table {
  background: var(--bg-base);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  overflow: hidden;
}
.cookies-header {
  display: grid;
  grid-template-columns: 0.8fr 1.4fr 0.7fr 0.4fr 0.5fr;
  gap: 10px;
  padding: 6px 12px;
  background: var(--bg-muted);
  border-bottom: 1px solid var(--border-strong);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.cookies-row {
  display: grid;
  grid-template-columns: 0.8fr 1.4fr 0.7fr 0.4fr 0.5fr;
  gap: 10px;
  padding: 4px 12px;
  border-bottom: 1px solid var(--border-base);
  font-size: 12.5px;
  align-items: center;
}
.cookies-row:nth-child(even) { background: var(--bg-muted); }
.cookies-row:last-of-type { border-bottom: none; }
.cookies-key {
  font-family: 'SF Mono', 'Menlo', monospace;
  color: var(--code-key);
  font-weight: 500;
  word-break: break-word;
}
.cookies-value {
  font-family: 'SF Mono', 'Menlo', monospace;
  color: var(--text-primary);
  word-break: break-all;
}
.cookies-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.cookie-flag {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 9px;
  font-weight: 600;
  background: var(--border-base);
  color: var(--text-secondary);
  white-space: nowrap;
}
.cookie-flag-httponly { background: var(--cookie-httponly-bg); color: var(--tag-warning-fg); }
.cookie-flag-secure { background: var(--cookie-secure-bg); color: var(--cookie-secure-fg); }
</style>
