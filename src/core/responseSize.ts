// Cap an oversized response body so the renderer stays responsive on an
// accidental huge download. Shared by the direct-fetch path (http.ts) and
// the service-worker fetch (background) so both truncate identically —
// previously this logic was copy-pasted and could drift.
//
// `maxResponseSizeMB` is the user setting in megabytes; 0 / undefined means
// "no cap". The original size stays available on the passed-in blob so the
// UI can still report how much was cut.
export function capResponseBlob(
  blob: Blob,
  maxResponseSizeMB: number | undefined
): { finalBlob: Blob; truncated: boolean } {
  const maxBytes = maxResponseBytes(maxResponseSizeMB)
  const truncated = maxBytes > 0 && blob.size > maxBytes
  const finalBlob = truncated ? blob.slice(0, maxBytes, blob.type) : blob
  return { finalBlob, truncated }
}

// Byte cap for a maxResponseSizeMB setting; 0 / undefined mean "no cap".
export function maxResponseBytes(maxResponseSizeMB: number | undefined): number {
  return (maxResponseSizeMB ?? 0) * 1024 * 1024
}

// The suffix appended to a truncated response's text so the user can see it
// was cut and by how much.
export function truncationNotice(maxResponseSizeMB: number | undefined, originalSize: number): string {
  return `\n\n…[truncated at ${maxResponseSizeMB} MB — original ${(originalSize / 1024 / 1024).toFixed(1)} MB]`
}

// Variant for the streaming path: reading is cancelled at the cap, so the
// true original size is unknown and must not be claimed.
export function streamTruncationNotice(maxResponseSizeMB: number | undefined): string {
  return `\n\n…[truncated at ${maxResponseSizeMB} MB]`
}
