// Wrapper around chrome.permissions for optional permissions.
//
// Note: `debugger` is NOT supported as an optional permission in MV3 —
// Chrome silently accepts it in `optional_permissions` in the manifest, but
// `chrome.permissions.request({ permissions: ['debugger'] })` always fails
// with `runtime.lastError` at runtime, with no lastError message containing
// "user gesture". The fix is to declare `debugger` as a required permission
// in the manifest, not request it at runtime.
//
// `hasDebugger` is used by the capture flow to confirm the manifest's
// `debugger` permission is present. `requestDebugger` / `requestPermission`
// are complete but currently dormant — `debugger` can't be requested at
// runtime in MV3 (see below), so nothing calls them today. They're retained
// for a future permission that CAN be optional and to keep the has/request
// pair symmetric.
//
// References:
//   https://developer.chrome.com/docs/extensions/reference/api/permissions
//     → "Permissions that can not be specified as optional" includes
//     `"debugger"`, `"declarativeNetRequest"`, `"devtools"`, etc.
//   https://developer.chrome.com/docs/extensions/reference/api/debugger
//     → "You must declare the `\"debugger\"` permission in your extension's
//     manifest to use this API."

declare const chrome: any | undefined

// `debugger` is the only optional permission this extension actually
// considers (it's what the capture flow uses). `OptionalPermission` is
// declared as `'debugger'` so we get type-narrow checking at the call
// site — if a future feature wants to use a different permission, widen
// this union (and update the NON_REQUESTABLE check below).
export type OptionalPermission = 'debugger'

// Rich result for permission requests. Callers usually only need `granted`,
// but knowing WHY a request failed (denied vs. gesture-lost vs. API missing)
// is the difference between a useful toast and a confusing one.
//
// In practice this type is rarely used by the capture flow: `debugger`
// can't be requested at runtime. The shape is preserved for tests and for
// any future permission that *can* be optional.
export type PermissionResult =
  | { granted: true }
  | { granted: false; reason: PermissionFailureReason; message?: string }

export type PermissionFailureReason =
  | 'denied'           // user dismissed / blocked the prompt
  | 'unavailable'      // chrome.permissions API missing (e.g. older Chrome)
  | 'gesture-lost'     // chrome rejected because no live user gesture
  | 'error'            // lastError set for some other reason
  | 'unsupported'      // permission can't be requested at runtime (e.g. `debugger`)
  | 'unknown'

export function hasPermission(permission: OptionalPermission): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.permissions?.contains) {
      resolve(false)
      return
    }
    try {
      // Manifest V3 lets chrome.permissions.contains return a Promise.
      // Support both shapes so the file works in test harnesses that
      // hand-roll a callback-style mock.
      const maybe = (chrome.permissions as any).contains({ permissions: [permission] })
      if (maybe && typeof maybe.then === 'function') {
        maybe.then(
          (g: boolean) => resolve(Boolean(g)),
          () => resolve(false)
        )
        return
      }
    } catch {
      // The sync call returned undefined / threw — fall through to callback.
    }
    try {
      chrome.permissions.contains(
        { permissions: [permission] },
        (granted: boolean) => {
          if (chrome.runtime?.lastError) {
            resolve(false)
            return
          }
          resolve(Boolean(granted))
        }
      )
    } catch {
      resolve(false)
    }
  })
}

// Request the given optional permission. Resolves to a `PermissionResult`
// so callers can distinguish a real user-denial from a silent
// gesture-rejection.
//
// IMPORTANT: Chrome disallows runtime requests for several permissions,
// including `debugger`. Calling `requestPermission('debugger')` from a
// release build will always resolve as `{ granted: false, reason:
// 'unsupported' }`. The capture flow no longer calls this; it's retained
// for completeness and for testing other permissions in the future.
//
// Implementation notes:
//   1. The request callback can fire with `granted = false` AND
//      `chrome.runtime.lastError` set when Chrome rejects the request.
//   2. The callback may not fire at all when the API itself is missing.
//      A setTimeout safety net resolves as 'error' so the UI never hangs.
//   3. We do NOT use the Promise form of chrome.permissions.request —
//      calling it without a callback throws synchronously.
export function requestPermission(permission: OptionalPermission): Promise<PermissionResult> {
  // Short-circuit the permissions that Chrome refuses to grant at runtime.
  // Doing this BEFORE we hand the click off to chrome.permissions avoids
  // confusing the user with a request that Chrome will reject.
  if (!isRuntimeRequestable(permission)) {
    return Promise.resolve({
      granted: false,
      reason: 'unsupported',
      message: `Permission "${permission}" cannot be requested at runtime in MV3; declare it in the manifest.`
    })
  }

  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.permissions?.request) {
      resolve({ granted: false, reason: 'unavailable', message: 'chrome.permissions API is not available' })
      return
    }
    let settled = false
    const fallback = setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ granted: false, reason: 'error', message: 'Permission request timed out' })
    }, 1500)

    try {
      chrome.permissions.request(
        { permissions: [permission] },
        (granted: boolean) => {
          if (settled) return
          settled = true
          clearTimeout(fallback)

          const lastError = chrome.runtime?.lastError
          if (lastError) {
            const msg = String(lastError.message ?? '')
            const reason: PermissionFailureReason = /user gesture/i.test(msg)
              ? 'gesture-lost'
              : 'error'
            resolve({ granted: false, reason, message: msg })
            return
          }
          if (granted) {
            resolve({ granted: true })
          } else {
            resolve({ granted: false, reason: 'denied' })
          }
        }
      )
    } catch (e: any) {
      if (settled) return
      settled = true
      clearTimeout(fallback)
      const msg = String(e?.message ?? e ?? 'request() threw')
      const reason: PermissionFailureReason = /user gesture/i.test(msg)
        ? 'gesture-lost'
        : 'error'
      resolve({ granted: false, reason, message: msg })
    }
  })
}

// Convenience aliases — most callers care about debugger specifically.
export const hasDebugger = (): Promise<boolean> => hasPermission('debugger')
export const requestDebugger = (): Promise<PermissionResult> => requestPermission('debugger')

// True for permissions Chrome will grant on a runtime request. The list
// mirrors the "Permissions that can not be specified as optional" table
// at https://developer.chrome.com/docs/extensions/reference/api/permissions
// (debugger, declarativeNetRequest, devtools, geolocation, mdns, proxy, tts,
// ttsEngine, wallpaper). Future Chrome additions go here.
const NON_REQUESTABLE: ReadonlySet<OptionalPermission> = new Set(['debugger'])

export function isRuntimeRequestable(permission: OptionalPermission): boolean {
  return !NON_REQUESTABLE.has(permission)
}