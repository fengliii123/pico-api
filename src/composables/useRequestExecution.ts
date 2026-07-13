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
import { normalize, execute, type NormalizedRequest } from '@/core/http'
import { findUnresolvedVariables } from '@/core/variables'
import { runScript, type TestResult, type VariableChange, type PmApi } from '@/core/scripts/vm'
import { history as historyDb } from '@/db'
import { uid } from '@/utils/id'
import type { EnvironmentVariable, HistoryEntry, ResponseResult } from '@/core/types'
import { useI18n } from '@/i18n/useI18n'

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

function assertHttpUrl(url: string, label: string): string | null {
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol)) {
      return `${label}: unsupported protocol ${u.protocol} — only http and https are allowed.`
    }
    if (!u.hostname) return `${label}: hostname is empty.`
    return null
  } catch (e: any) {
    return `${label}: ${e?.message ?? 'could not parse URL'}`
  }
}

export function useRequestExecution() {
  const { t } = useI18n()
  const reqStore = useRequestStore()
  const resStore = useResponseStore()
  const envStore = useEnvironmentStore()
  const settingsStore = useSettingsStore()

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
  ): Promise<{ logs: string[]; renormalize: boolean; requestPatch: Partial<NormalizedRequest> | null }> {
    if (!script) return { logs: [], renormalize: false, requestPatch: null }
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
      requestPatch: requestPatchFromScriptResult(result.request, normalized)
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

    // Pre-flight: catch unresolved {{var}} placeholders BEFORE we hit
    // the network. Without this check, the request would silently go
    // out with `{{baseUrl}}` in the URL.
    const unresolved = findUnresolvedVariables(
      draft,
      envStore.activeVariables,
      envStore.globals.variables
    )
    if (unresolved.length > 0) {
      const names = unresolved.map(n => `{{${n}}}`).join(', ')
      const envName = envStore.activeEnvironment?.name ?? 'No Environment'
      resStore.setError({
        message:
          `Unresolved variable${unresolved.length > 1 ? 's' : ''}: ${names}. ` +
          `Activate an environment that defines ${names}, or add ${names} to your active environment's variables. ` +
          `(Active: ${envName}.)`,
        errorKind: 'connect'
      })
      return
    }

    resStore.setLoading()

    // Pre-validate URL before scripts run (so scripts don't modify an
    // invalid URL).
    let normalized: NormalizedRequest
    try {
      normalized = normalize(draft, envStore.activeVariables, envStore.globals.variables)
    } catch (e: any) {
      resStore.setError({
        message: `Invalid request: ${e?.message ?? 'could not normalize'}`,
        errorKind: 'connect'
      })
      return
    }

    try {
      const u = new URL(normalized.url)
      if (!/^https?:$/.test(u.protocol)) {
        resStore.setError({
          message: `Unsupported protocol: ${u.protocol} — only http and https are allowed.`,
          errorKind: 'connect'
        })
        return
      }
      if (!u.hostname) {
        resStore.setError({
          message: 'Invalid URL — hostname is empty.',
          errorKind: 'connect'
        })
        return
      }
    } catch (e: any) {
      resStore.setError({
        message: `Invalid URL: ${e?.message ?? 'could not parse'}`,
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
      if (preRequest.renormalize) {
        normalized = normalize(draft, envStore.activeVariables, envStore.globals.variables)
        if (!validateNormalizedUrl('Pre-request script produced an invalid URL')) return
      }
      if (preRequest.requestPatch) {
        normalized = { ...normalized, ...preRequest.requestPatch }
        if (preRequest.requestPatch.url && !validateNormalizedUrl('Pre-request script produced an invalid URL')) {
          return
        }
      }

      const result = await execute(normalized, {
        sendBrowserCookies: settingsStore.sendBrowserCookies,
        signal
      })

      const post = await runPostResponse(draft.scripts?.postResponse ?? '', normalized, result)

      resStore.setResult(result, post.testResults, { preRequest: preRequest.logs, postResponse: post.logs })
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
      // right hint.
      if (e?.errorKind) {
        resStore.setError(e, testResults, { preRequest: [], postResponse: postLogs })
      } else {
        resStore.setError({ message: e?.message ?? 'Request failed' }, testResults, { preRequest: [], postResponse: postLogs })
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
