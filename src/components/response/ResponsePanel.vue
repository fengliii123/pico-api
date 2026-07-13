<script setup lang="ts">
// Response panel: idle / loading / success / error.
// On success: shows status, time, size, and Content-Type-aware body view
// (body / headers / cookies tabs).

import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Spin, Tabs } from 'ant-design-vue'
import { WarningFilled } from '@ant-design/icons-vue'
import { useResponseStore } from '@/stores/response'
import { useRequestStore } from '@/stores/request'
import StatusTag from '@/components/common/StatusTag.vue'
import ResponseErrorBanner from './ResponseErrorBanner.vue'
import ResponseBodyRenderer from './ResponseBodyRenderer.vue'
import ResponseTestResults from './ResponseTestResults.vue'
import { formatBytes, formatTime } from '@/utils/format'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()
const resStore = useResponseStore()
const reqStore = useRequestStore()
// `storeToRefs(state)` gives us a real Ref<ResponseState> rather than a
// computed getter. TS can then narrow the discriminated union through
// `state.kind === 'success'` checks inside template expressions.
const { state } = storeToRefs(resStore)
// vue-tsc doesn't narrow state.value.result inside template sub-expressions,
// so we expose a single concrete (or null) result once. Template reads use
// `result!.foo` which TS accepts.
const result = computed(() =>
  state.value.kind === 'success' ? state.value.result : null
)

// Set-Cookie values returned by the background bridge. Empty when the
// response had no Set-Cookie headers, or when we're running in dev mode
// (foreground fetch hides Set-Cookie under CORS).
const cookies = computed(() => result.value?.setCookies ?? [])

// Script outputs: pre-request / post-response console logs + test
// assertions. Surfaced via the "Tests" tab so the user can see what
// their scripts actually did.
const testResults = computed(() => {
  if (state.value.kind !== 'success' && state.value.kind !== 'error') return []
  return state.value.testResults ?? []
})
const scriptLogs = computed(() => state.value.kind === 'success' || state.value.kind === 'error'
  ? state.value.scriptLogs
  : undefined)
const hasScriptOutput = computed(() =>
  testResults.value.length > 0 ||
  (scriptLogs.value?.preRequest?.length ?? 0) > 0 ||
  (scriptLogs.value?.postResponse?.length ?? 0) > 0
)
const failedTests = computed(() => testResults.value.filter(r => !r.passed).length)

// Current draft URL — used by the CORS / network-error hints to give the
// user a "Open URL in browser" escape hatch. The browser can fetch it
// without CORS, so when the extension gets blocked the user can at least
// eyeball the response themselves.
const currentUrl = computed(() => reqStore.draft.url)

const activeTab = ref('body')

const isHttpError = computed(() => {
  return state.value.kind === 'success' && state.value.result.status >= 400
})

const httpErrorSummary = computed(() => {
  if (!isHttpError.value) return ''
  const s = state.value.kind === 'success' ? state.value.result.status : 0
  if (s >= 500) return t.value.serverError
  if (s === 404) return t.value.notFound
  if (s === 401) return t.value.unauthorized
  if (s === 403) return t.value.forbidden
  if (s >= 400) return t.value.clientError
  return ''
})

// On state change, scroll the panel back to the top so the user sees
// status / meta immediately rather than a stale scroll position from a
// previous response.
watch(state, async () => {
  await nextTick()
  const root = document.querySelector('.response-panel')
  if (root) (root as HTMLElement).scrollTop = 0
})
</script>

<template>
  <div class="response-panel">
    <div v-if="state.kind === 'idle'" class="response-empty">
      <div class="response-empty-hint">{{ t.sendRequest }}</div>
    </div>

    <div v-else-if="state.kind === 'loading'" class="response-loading">
      <Spin :tip="t.sending" />
    </div>

    <ResponseErrorBanner
      v-else-if="state.kind === 'error'"
      :state="state"
      :current-url="currentUrl"
    />

    <div
      v-else-if="state.kind === 'success'"
      class="response-success"
      :class="{ 'is-http-error': isHttpError }"
    >
      <!-- 4xx/5xx banner: makes the "this is an error response" signal obvious. -->
      <div v-if="isHttpError" class="http-error-banner">
        <WarningFilled class="http-error-icon" />
        <span><strong>{{ result!.status }} {{ result!.statusText }}</strong> — {{ httpErrorSummary }}</span>
      </div>
      <Tabs v-model:active-key="activeTab" class="body-tabs">
        <template #tabBarExtraContent>
          <span class="tabs-extra">
            <StatusTag :status="result!.status" />
            <span class="tabs-extra-meta">
              {{ formatTime(result!.time) }} · {{ formatBytes(result!.body.size) }}
            </span>
          </span>
        </template>
        <Tabs.TabPane key="body" :tab="t.response">
          <ResponseBodyRenderer :result="result!" />
        </Tabs.TabPane>

        <Tabs.TabPane key="headers" :tab="t.headers">
          <div class="headers-table">
            <div class="headers-header">
              <span class="h-col-name">{{ t.headerName }}</span>
              <span class="h-col-value">{{ t.value }}</span>
            </div>
            <div
              v-for="[k, v] in result!.headers"
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

        <Tabs.TabPane v-if="cookies.length > 0" key="cookies">
          <template #tab>
            <span class="tab-label">{{ t.cookies }}
              <span class="tab-badge">{{ cookies.length }}</span>
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

        <Tabs.TabPane v-if="hasScriptOutput" key="tests">
          <template #tab>
            <span class="tab-label">{{ t.responseTestsTab }}
              <span v-if="failedTests > 0" class="tab-badge tab-badge-fail">{{ failedTests }}</span>
              <span v-else-if="testResults.length > 0" class="tab-badge tab-badge-pass">{{ testResults.length }}</span>
            </span>
          </template>
          <ResponseTestResults :test-results="testResults" :logs="scriptLogs" />
        </Tabs.TabPane>
      </Tabs>
    </div>
  </div>
</template>

<style scoped>
.response-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border-base);
  background: var(--bg-subtle);
  overflow: hidden;
}
.response-empty, .response-loading, .response-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}
.response-empty-hint {
  font-size: 13px;
  color: var(--text-tertiary);
}
.response-success {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
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


/* 4xx / 5xx response — make the success panel look like an error. */
.response-success.is-http-error .tabs-extra-meta { color: var(--tag-danger-fg); }

.http-error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--status-danger-bg);
  border: 1px solid var(--status-danger);
  border-radius: 6px;
  color: var(--tag-danger-fg);
  font-size: 13px;
}
.http-error-icon { font-size: 16px; color: var(--tag-danger-fg); }

/* Network-error hints */
.response-error {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.error-hints { display: flex; flex-direction: column; gap: 8px; }
.error-hint {
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-subtle);
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid var(--tag-danger-fg);
}
.error-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}
.error-hint code {
  background: var(--bg-base);
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  padding: 1px 5px;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 12px;
}
.error-detail {
  font-size: 12px;
  color: var(--text-secondary);
}
.error-detail summary {
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
}
.error-detail code {
  display: block;
  background: var(--bg-base);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  padding: 8px;
  font-family: 'SF Mono', 'Menlo', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: 4px;
}

/* ----- Body tabs ----- */
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

/* ----- Code block -----
 * Dedicated --code-* tokens give the response body its own visual identity:
 * a recessed, slightly "terminal-like" panel that's clearly distinct from
 * the page surface. One full step darker than the muted-bg family so
 * users immediately recognize "this is code, not prose". */
.code-wrap {
  border: 1px solid var(--code-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--code-bg);
  box-shadow: var(--shadow-xs);
}
.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  background: var(--code-toolbar-bg);
  border-bottom: 1px solid var(--code-border);
  color: var(--text-secondary);
  font-size: var(--fs-sm);
}
.code-toolbar-info { display: flex; align-items: center; gap: var(--space-2); }
.code-mime {
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: var(--fs-xs);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--bg-base);
  color: var(--text-secondary);
  border: 1px solid var(--code-border);
}
.code-size-warn {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 9px;
  background: var(--status-warning-bg);
  color: var(--status-warning-fg);
  font-weight: 500;
}
.code-toolbar-actions { display: flex; align-items: center; gap: var(--space-2); }
.copy-btn {
  color: var(--text-secondary) !important;
  border-color: var(--border-strong) !important;
  background: var(--bg-base) !important;
}
.copy-btn:hover {
  color: var(--text-primary) !important;
  border-color: var(--accent) !important;
  background: var(--accent-soft-bg) !important;
}

/* Pretty / Raw segmented control */
.seg {
  display: inline-flex;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-base);
  overflow: hidden;
  background: var(--bg-base);
}
.seg-btn {
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  padding: 2px 10px;
  cursor: pointer;
  transition: background-color 0.1s, color 0.1s;
}
.seg-btn:hover { color: var(--text-secondary); }
.seg-btn.active {
  background: var(--accent-soft-bg);
  color: var(--accent-soft-fg);
  font-weight: var(--fw-medium);
}

.code-block {
  margin: 0;
  padding: var(--space-5) var(--space-5);
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
  max-height: 60vh;
  overflow: auto;
}

/* JSON syntax tokens (deep: select so target pre's children match) */
.code-json :deep(.tk-key)  { color: var(--accent-soft-fg); }   /* blue for keys */
.code-json :deep(.tk-str)  { color: var(--status-success); }   /* green for strings */
.code-json :deep(.tk-num)  { color: var(--tag-warning-fg); }   /* orange for numbers */
.code-json :deep(.tk-kw)   { color: var(--tag-danger-fg); }   /* pink for true/false/null */
.code-json :deep(.tk-punc) { color: var(--text-tertiary); }   /* muted gray for {}[]," */

/* ----- Image / binary placeholders ----- */
.image-container {
  text-align: center;
  background: var(--bg-base);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.image-container img { max-width: 100%; }
.image-actions {
  display: flex;
  justify-content: center;
}

.pdf-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pdf-iframe {
  width: 100%;
  height: 500px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: white;
}
.pdf-placeholder {
  background: var(--bg-base);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  padding: 32px;
  text-align: center;
  color: var(--text-secondary);
}
.binary-placeholder {
  background: var(--bg-base);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 13px;
}
.binary-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.binary-actions {
  display: flex;
  justify-content: center;
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
</style>