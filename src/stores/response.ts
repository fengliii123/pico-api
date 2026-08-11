// Response store: holds results of sent requests, keyed by request id.
//
// Before this change the store held a single global `state`. Switching
// requests called resStore.reset(), which cleared it — so re-selecting
// a previously-sent request showed a blank response panel.
//
// We now cache every response by the request's id (a string key).
// `activeId` tracks which request is currently shown in the editor.
// `state` is a derived view of the cache entry for `activeId`.
//
// New (unsaved) requests have id=null; we use the special sentinel key
// '__new__' so they can still show a response while editing.
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { ResponseResult, ResponseError } from '@/core/types'

// Test results collected from test scripts
export interface ScriptTestResult {
  name: string
  passed: boolean
  error?: string
}

export interface StreamChunk {
  text: string
  timestamp: number
}

export interface ScriptLogs {
  preRequest: string[]
  postResponse: string[]
}

export type ResponseState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'streaming'; chunks: StreamChunk[]; mime: string; completed?: boolean; result?: ResponseResult; testResults?: ScriptTestResult[]; scriptLogs?: ScriptLogs }
  | { kind: 'success'; result: ResponseResult; testResults?: ScriptTestResult[]; scriptLogs?: ScriptLogs }
  // On error we keep the same 'kind' discriminant (the response-state
  // machine) AND inherit ResponseError fields. ResponseError uses
  // `errorKind` for the classified cause, so the names don't collide.
  | { kind: 'error' } & ResponseError & { testResults?: ScriptTestResult[]; scriptLogs?: ScriptLogs }

const NEW_REQUEST_KEY = '__new__'

export const useResponseStore = defineStore('response', () => {
  // Map<requestId, ResponseState>
  const cache = shallowRef(new Map<string, ResponseState>())
  // id of the request currently shown in the editor (null = blank/new state)
  const activeId = ref<string | null>(null)

  // Derived: what to show in the panel right now.
  const state = computed<ResponseState>(() => {
    // The sentinel key covers the unsaved-draft case: draft.id === null
    // but the user may still send and expect a response to render.
    const key = activeId.value ?? NEW_REQUEST_KEY
    return cache.value.get(key) ?? { kind: 'idle' }
  })

  // Call this whenever the editor loads a new request (saved or new).
  // Sets the activeId so subsequent state setters affect the right slot.
  function setActive(id: string | null) {
    activeId.value = id
  }

  function setResult(result: ResponseResult, testResults?: ScriptTestResult[], scriptLogs?: ScriptLogs) {
    const key = activeId.value ?? NEW_REQUEST_KEY
    const newCache = new Map(cache.value)
    newCache.set(key, { kind: 'success', result, testResults, scriptLogs })
    cache.value = newCache
  }

  function setError(err: ResponseError | string, testResults?: ScriptTestResult[], scriptLogs?: ScriptLogs) {
    const key = activeId.value ?? NEW_REQUEST_KEY
    const s: ResponseState =
      typeof err === 'string'
        ? { kind: 'error', message: err, errorKind: 'unknown', testResults, scriptLogs }
        : { kind: 'error', ...err, testResults, scriptLogs }
    const newCache = new Map(cache.value)
    newCache.set(key, s)
    cache.value = newCache
  }

  // Streaming state management
  function setStreaming(mime: string) {
    const key = activeId.value ?? NEW_REQUEST_KEY
    const newCache = new Map(cache.value)
    newCache.set(key, { kind: 'streaming', chunks: [], mime })
    cache.value = newCache
  }

  function appendStreamChunk(text: string) {
    const key = activeId.value ?? NEW_REQUEST_KEY
    const current = cache.value.get(key)
    if (current?.kind === 'streaming') {
      const newCache = new Map(cache.value)
      newCache.set(key, {
        ...current,
        chunks: [...current.chunks, { text, timestamp: Date.now() }]
      })
      cache.value = newCache
    }
  }

  function finishStreaming(result: ResponseResult & { isStreaming: boolean }, testResults?: ScriptTestResult[], scriptLogs?: ScriptLogs) {
    const key = activeId.value ?? NEW_REQUEST_KEY
    const current = cache.value.get(key)
    const newCache = new Map(cache.value)
    
    if (current?.kind === 'streaming' && result.isStreaming) {
      newCache.set(key, {
        kind: 'streaming',
        chunks: current.chunks,
        mime: current.mime,
        completed: true,
        result,
        testResults,
        scriptLogs
      })
    } else {
      newCache.set(key, { kind: 'success', result, testResults, scriptLogs })
    }
    cache.value = newCache
  }

  // Clear only the *current* slot (called when the user edits the draft
  // without having sent it — we want to drop a stale 'loading' indicator).
  // Use clearAll() to wipe everything (e.g. on extension reload).
  function reset() {
    const key = activeId.value ?? NEW_REQUEST_KEY
    cache.value.delete(key)
  }

  function clearAll() {
    cache.value = new Map()
    activeId.value = null
  }

  return {
    state,
    activeId,
    setActive,
    setResult,
    setError,
    setStreaming,
    appendStreamChunk,
    finishStreaming,
    reset,
    clearAll
  }
})
