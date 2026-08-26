// Request execution pipeline: validation → pre-request script →
// normalize → fetch → post-response script → result/error/historise.
//
// Lifted out of RequestEditor.vue so the editor component is just
// view-binding, and so the send() flow can be unit-tested without
// mounting the whole component tree.

import { message } from 'ant-design-vue'
import { useRequestStore } from '@/stores/request'
import { useResponseStore } from '@/stores/response'
import { useSettingsStore } from '@/stores/settings'
import { useEnvironmentStore } from '@/stores/environment'
import { normalize, execute, executeStreaming, type NormalizedRequest, type StreamChunkHandler } from '@/core/http'
import { findUnresolvedVariables } from '@/core/variables'
import { runScript, type TestResult, type VariableChange, type PmApi } from '@/core/scripts/vm'
import { history as historyDb } from '@/db'
import { uid } from '@/utils/id'
import type { EnvironmentVariable, HistoryEntry, ResponseResult } from '@/core/types'
import { useI18n } from '@/i18n/useI18n'
import { fmt } from '@/i18n'

// Shared across composable instances so Cancel from the toolbar always
// reaches the one in-flight HTTP request.
let inflightAbort: AbortController | null = null

// Replay in-sandbox variable writes onto the persisted variables array.
// We rebuild from scratch each time so the store ends up with a single
// coherent array (no duplicate keys from re-adding, no stale entries).
function nextVariablesArray(
  current: EnvironmentVariable[],
  changes: VariableChange[]
): EnvironmentVariable[] {
  const next = current.map(v => ({ ...v }))
  for (const c of changes) {
    const idx = next.findIndex(v => v.key === c.key)
    if (c.op === 'set') {
      const value = c.value ?? ''
      if (idx >= 0) {
        // Preserve the existing `enabled` flag — users who disabled a
        // variable in the panel shouldn't get it re-enabled by a script.
        next[idx] = { ...next[idx]!, key: c.key, value }
      } else {
        // Newly created by the script: default to enabled so the next
        // request can reference it. Postman behaves the same way.
        next.push({ key: c.key, value, enabled: true })
      }
    } else {
      // op === 'unset'
      if (idx >= 0) next.splice(idx, 1)
    }
  }
  return next
}

// Overlay request-scoped local variables (pm.variables.set from the
// pre-request script) onto the active environment variables. Local values
// must resolve in the request URL/headers/body but are never persisted.
function withLocalVars(
  base: EnvironmentVariable[],
  changes: VariableChange[]
): EnvironmentVariable[] {
  const local = changes.filter(c => c.scope === 'local')
  if (local.length === 0) return base
  return nextVariablesArray(base, local)
}

function requestPatchFromScriptResult(
  after: PmApi['request'],
  before: NormalizedRequest
): Partial<NormalizedRequest> | null {
  const patch: Partial<NormalizedRequest> = {}
  if (after.url !== before.url) patch.url = after.url
  if (after.method.toUpperCase() !== before.method) {
    patch.method = after.method.toUpperCase()
  }
  if (JSON.stringify(after.headers) !== JSON.stringify(before.headers)) {
    patch.headers = { ...after.headers }
  }
  const scriptBody = after.body
  let bodyChanged = false
  if (typeof before.body === 'string') {
    bodyChanged = scriptBody !== before.body
  } else if (before.body == null) {
    bodyChanged = scriptBody !== undefined && scriptBody !== ''
  } else {
    bodyChanged = scriptBody !== undefined
  }
  if (bodyChanged) patch.body = scriptBody
  return Object.keys(patch).length > 0 ? patch : null
}

export function useRequestExecution() {
  const { t } = useI18n()
  const reqStore = useRequestStore()
  const resStore = useResponseStore()
  const envStore = useEnvironmentStore()
  const settingsStore = useSettingsStore()

  function assertHttpUrl(url: string, label: string): string | null {
    try {
      const u = new URL(url)
      if (!/^https?:$/.test(u.protocol)) {
        return fmt(t.value.errUnsupportedProtocol, { label, protocol: u.protocol })
      }
      if (!u.hostname) return fmt(t.value.errEmptyHostname, { label })
      return null
    } catch (e: any) {
      return fmt(t.value.errUrlParse, { label, message: e?.message ?? t.value.errCouldNotParseUrl })
    }
  }

  // Persist script-driven variable writes back to the env / globals
  // stores. This is what makes "post-response script sets the token,
  // next request reads it" work — without it the in-sandbox writes
  // would only live for the duration of the script run.
  async function persistVarChanges(changes: VariableChange[]): Promise<void> {
    if (changes.length === 0) return

    const envChanges = changes.filter(c => c.scope === 'environment')
    const globalsChanges = changes.filter(c => c.scope === 'globals')

    if (envChanges.length && envStore.activeEnvironmentId) {
      const envId = envStore.activeEnvironmentId
      const current = envStore.activeEnvironment?.variables ?? []
      const next = nextVariablesArray(current, envChanges)
      await envStore.updateEnvironmentVariables(envId, next)
    }

    if (globalsChanges.length) {
      const current = envStore.globals.variables
      const next = nextVariablesArray(current, globalsChanges)
      await envStore.updateGlobals(next)
    }
  }

  // Run the pre-request script. Returns the captured logs and a flag
  // indicating whether the script wrote any variables (caller must
  // re-normalize + re-validate the URL when this is true).
  async function runPreRequest(
    script: string,
    normalized: NormalizedRequest
  ): Promise<{ logs: string[]; renormalize: boolean; requestPatch: Partial<NormalizedRequest> | null; varChanges: VariableChange[] }> {
    if (!script) return { logs: [], renormalize: false, requestPatch: null, varChanges: [] }
    const result = await runScript(
      script,
      {
        requestUrl: normalized.url,
        requestMethod: normalized.method,
        requestHeaders: normalized.headers,
        requestBody: normalized.body as string | undefined,
        response: null,
        envVars: envStore.activeVariables,
        globals: envStore.globals.variables
      },
      (msg) => { /* logs collected in result */ void msg }
    )
    await persistVarChanges(result.varChanges)
    return {
      logs: result.logs,
      renormalize: result.varChanges.length > 0,
      requestPatch: requestPatchFromScriptResult(result.request, normalized),
      varChanges: result.varChanges
    }
  }

  // Run the post-response script. Caller passes the response (or null
  // when running on the error path — Postman runs post-response even
  // on failures so users can record error metadata).
  async function runPostResponse(
    script: string,
    normalized: NormalizedRequest,
    response: ResponseResult | null
  ): Promise<{ logs: string[]; testResults: TestResult[] }> {
    if (!script) return { logs: [], testResults: [] }
    const result = await runScript(
      script,
      {
        requestUrl: normalized.url,
        requestMethod: normalized.method,
        requestHeaders: normalized.headers,
        requestBody: normalized.body as string | undefined,
        response,
        envVars: envStore.activeVariables,
        globals: envStore.globals.variables
      }
    )
    return { logs: result.logs, testResults: result.tests }
  }

  async function recordHistory(status: number, time: number, size: number) {
    if (!settingsStore.autoSaveHistory) return
    const d = reqStore.draft
    const entry: HistoryEntry = {
      id: uid(),
      requestId: d.id,
      folderId: d.folderId,
      name: d.name || '(unnamed)',
      method: d.method,
      url: d.url,
      status,
      time,
      size,
      sentAt: Date.now()
    }
    await historyDb.add(entry)
  }

  async function send() {
    const draft = reqStore.draft
    if (!draft.url) {
      message.warning(t.value.enterUrl)
      return
    }

    // A new Send cancels any previous in-flight request.
    inflightAbort?.abort()
    inflightAbort = new AbortController()
    const { signal } = inflightAbort

    // Pre-validate URL before scripts run (so scripts don't modify an
    // invalid URL). Variables are NOT fully checked yet — the pre-request
    // script may define variables the URL references (e.g. a timestamp),
    // so the unresolved-variable gate runs after the script below.
    let normalized: NormalizedRequest
    try {
      normalized = normalize(draft, envStore.activeVariables, envStore.globals.variables)
    } catch (e: any) {
      resStore.setError({
        message: fmt(t.value.errInvalidRequest, { message: e?.message ?? t.value.errCouldNotNormalize }),
        errorKind: 'connect'
      })
      return
    }

    try {
      const u = new URL(normalized.url)
      if (!/^https?:$/.test(u.protocol)) {
        resStore.setError({
          message: fmt(t.value.errUnsupportedProtocol, { label: 'URL', protocol: u.protocol }),
          errorKind: 'connect'
        })
        return
      }
      if (!u.hostname) {
        resStore.setError({
          message: t.value.errInvalidUrlHostname,
          errorKind: 'connect'
        })
        return
      }
    } catch (e: any) {
      resStore.setError({
        message: fmt(t.value.errInvalidUrl, { message: e?.message ?? t.value.errCouldNotParse }),
        errorKind: 'connect'
      })
      return
    }

    const validateNormalizedUrl = (label: string): boolean => {
      const err = assertHttpUrl(normalized.url, label)
      if (err) {
        resStore.setError({ message: err, errorKind: 'connect' })
        return false
      }
      return true
    }

    try {
      const preRequest = await runPreRequest(draft.scripts?.preRequest ?? '', normalized)
      const activeWithLocal = withLocalVars(envStore.activeVariables, preRequest.varChanges)
      if (preRequest.renormalize) {
        normalized = normalize(draft, activeWithLocal, envStore.globals.variables)
        if (!validateNormalizedUrl('Pre-request script produced an invalid URL')) return
      }
      if (preRequest.requestPatch) {
        normalized = { ...normalized, ...preRequest.requestPatch }
        if (preRequest.requestPatch.url && !validateNormalizedUrl('Pre-request script produced an invalid URL')) {
          return
        }
      }

      // Catch unresolved {{var}} placeholders BEFORE we hit the network —
      // after the pre-request script so variables it defines (environment
      // OR local pm.variables.set) are accepted. Without this check, the
      // request would silently go out with `{{baseUrl}}` in the URL.
      const unresolved = findUnresolvedVariables(
        draft,
        activeWithLocal,
        envStore.globals.variables
      )
      if (unresolved.length > 0) {
        const names = unresolved.map(n => `{{${n}}}`).join(', ')
        const envName = envStore.activeEnvironment?.name ?? t.value.errNoEnvironment
        resStore.setError({
          message: fmt(t.value.errUnresolvedVariables, { names, envName }),
          errorKind: 'connect'
        })
        return
      }

      resStore.setStreaming(normalized.headers?.['accept'] ?? '')

      const onChunk: StreamChunkHandler = (text) => {
        resStore.appendStreamChunk(text)
      }

      const result = await executeStreaming(normalized, {
        sendBrowserCookies: settingsStore.sendBrowserCookies,
        signal,
        onChunk
      })

      const post = await runPostResponse(draft.scripts?.postResponse ?? '', normalized, result)

      // Use server-reported streaming flag
      if (result.isStreaming) {
        resStore.finishStreaming(result, post.testResults, { preRequest: preRequest.logs, postResponse: post.logs })
      } else {
        resStore.setResult(result, post.testResults, { preRequest: preRequest.logs, postResponse: post.logs })
      }
      await recordHistory(result.status, result.time, result.body.size)
    } catch (e: any) {
      if (e?.errorKind === 'aborted' || signal.aborted) {
        resStore.setError({ message: t.value.requestCancelled, errorKind: 'aborted' })
        return
      }
      // Run post-response scripts even on error (they might check for
      // error conditions). Failures here are swallowed so they don't
      // mask the original request error.
      let postLogs: string[] = []
      let testResults: any[] = []
      if (draft.scripts?.postResponse) {
        try {
          const post = await runPostResponse(draft.scripts.postResponse, normalized, null)
          postLogs = post.logs
          testResults = post.testResults
        } catch {
          // ignore script errors during error handling
        }
      }

      // Forward whatever shape we got so the panel can render the
      // right hint. Timeouts carry a raw English message from the fetch
      // layer — localize it here.
      if (e?.errorKind) {
        const err = e.errorKind === 'timeout' ? { ...e, message: t.value.errTimeout } : e
        resStore.setError(err, testResults, { preRequest: [], postResponse: postLogs })
      } else {
        resStore.setError({ message: e?.message ?? t.value.errRequestFailed }, testResults, { preRequest: [], postResponse: postLogs })
      }
    } finally {
      if (inflightAbort?.signal === signal) inflightAbort = null
    }
  }

  function cancel() {
    inflightAbort?.abort()
  }

  return { send, cancel, runPreRequest, runPostResponse, persistVarChanges }
}
