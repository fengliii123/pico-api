// Runtime-environment detection shared by core modules that can execute
// both inside the extension (privileged chrome.runtime available) and in
// plain web contexts (vitest, vite dev/preview).

declare const chrome: { runtime?: { id?: string } } | undefined

/** True when running as an installed extension (chrome.runtime.id set). */
export function hasExtensionRuntime(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome?.runtime?.id
  } catch {
    return false
  }
}
