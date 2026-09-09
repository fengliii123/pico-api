<script setup lang="ts">
// Response panel: idle / loading / success / error.
// On success: shows status, time, size, and Content-Type-aware body view
// (body / headers / cookies tabs).

import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Spin, Button } from 'ant-design-vue'
import { WarningFilled } from '@ant-design/icons-vue'
import { useResponseStore } from '@/stores/response'
import { useRequestStore } from '@/stores/request'
import ResponseErrorBanner from './ResponseErrorBanner.vue'
import ResponseResultTabs from './ResponseResultTabs.vue'
import { useI18n } from '@/i18n/useI18n'

const { t } = useI18n()
const resStore = useResponseStore()
const reqStore = useRequestStore()

// 'resend' fires the current draft's send() (wired in AppLayout); used by
// the idle-state Send button and available for retry affordances.
const emit = defineEmits<{
  (e: 'resend'): void
}>()
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

// Streaming state: exposes chunks for live rendering
const streamingChunks = computed(() =>
  state.value.kind === 'streaming' ? state.value.chunks : []
)
const streamingMime = computed(() =>
  state.value.kind === 'streaming' ? state.value.mime : ''
)
const isStreaming = computed(() => state.value.kind === 'streaming')
const isStreamingCompleted = computed(() =>
  state.value.kind === 'streaming' && state.value.completed === true
)
const streamingResult = computed(() =>
  state.value.kind === 'streaming' ? state.value.result : null
)
const streamingTestResults = computed(() =>
  state.value.kind === 'streaming' ? (state.value.testResults ?? []) : []
)
const streamingScriptLogs = computed(() =>
  state.value.kind === 'streaming' ? state.value.scriptLogs : undefined
)

// Auto-scroll: tracks if user has scrolled away from bottom
const streamingBodyRef = ref<HTMLElement | null>(null)
const userScrolledAway = ref(false)

function handleScroll() {
  const el = streamingBodyRef.value
  if (!el) return
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  userScrolledAway.value = distanceFromBottom > 50
}

function scrollToBottom() {
  const el = streamingBodyRef.value
  if (!el || userScrolledAway.value) return
  el.scrollTop = el.scrollHeight
}

// Watch chunk count for auto-scroll (chunks are pushed in place, so watch
// the length — not the array reference).
watch(() => streamingChunks.value.length, async () => {
  await nextTick()
  scrollToBottom()
})

// Reset scroll state when streaming starts
watch(isStreaming, (streaming) => {
  if (streaming) {
    userScrolledAway.value = false
  }
})

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

// Current draft URL — used by the CORS / network-error hints to give the
// user a "Open URL in browser" escape hatch. The browser can fetch it
// without CORS, so when the extension gets blocked the user can at least
// eyeball the response themselves.
const currentUrl = computed(() => reqStore.draft.url)

const activeTab = ref('body')

// The tests / cookies tab panes are v-if'd away when a request without
// them loads (e.g. switching from a request with tests to one without).
// Without this fallback the active key would dangle on a removed pane —
// no tab selected, blank content — until the user clicks a tab manually.
const paneVisible = (key: string): boolean => {
  if (key === 'body' || key === 'headers') return true
  if (key === 'cookies') return state.value.kind === 'success' && cookies.value.length > 0
  if (key === 'tests') {
    return state.value.kind === 'streaming'
      ? streamingTestResults.value.length > 0
      : hasScriptOutput.value
  }
  return false
}
watch(
  () => [state.value.kind, streamingTestResults.value.length, hasScriptOutput.value, cookies.value.length],
  () => {
    if (!paneVisible(activeTab.value)) activeTab.value = 'body'
  }
)

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
      <Button size="small" type="primary" @click="emit('resend')">{{ t.send }}</Button>
    </div>

    <div v-else-if="state.kind === 'loading'" class="response-loading">
      <Spin :tip="t.sending" />
    </div>

    <div v-else-if="state.kind === 'streaming' && !isStreamingCompleted" class="response-streaming">
      <div class="streaming-header">
        <span class="streaming-badge">{{ t.receiving }}</span>
        <span class="streaming-indicator"></span>
      </div>
      <div class="streaming-body" ref="streamingBodyRef" @scroll="handleScroll">
        <pre class="streaming-content">{{ streamingChunks.map(c => c.text).join('') }}</pre>
      </div>
    </div>

    <!-- Streaming completed: show full response UI with tabs -->
    <div v-else-if="isStreamingCompleted" class="response-success">
      <ResponseResultTabs
        v-model:active-key="activeTab"
        :result="streamingResult!"
        :cookies="streamingResult?.setCookies ?? []"
        :test-results="streamingTestResults"
        :script-logs="streamingScriptLogs"
      />
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
      <ResponseResultTabs
        v-model:active-key="activeTab"
        :result="result!"
        :cookies="cookies"
        :test-results="testResults"
        :script-logs="scriptLogs"
        :http-error="isHttpError"
      />
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
.response-empty {
  flex-direction: column;
  gap: 12px;
}
.response-empty-hint {
  font-size: 13px;
  color: var(--text-tertiary);
}

/* Streaming response */
.response-streaming {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  gap: 8px;
  overflow: hidden;
}
.streaming-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.streaming-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9px;
  background: var(--accent);
  color: var(--text-on-accent);
  font-family: 'SF Mono', 'Menlo', monospace;
}
.streaming-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-success);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}
.streaming-body {
  flex: 1;
  overflow: auto;
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  border-radius: 6px;
}
.streaming-content {
  margin: 0;
  padding: 12px;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
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

</style>