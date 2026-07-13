// Shared response-body read path for direct fetch (http.ts) and the SW
// bridge (background/index.ts) so capping + text decoding stay in sync.

import { bytesToBase64 } from './binaryTransport'
import { capResponseBlob, truncationNotice } from './responseSize'

export async function readCappedResponseBody(
  blob: Blob,
  maxResponseSizeMB: number | undefined
): Promise<{ finalBlob: Blob; text: string }> {
  const { finalBlob, truncated } = capResponseBlob(blob, maxResponseSizeMB)
  let text = ''
  try {
    text = await finalBlob.text()
    if (truncated) {
      text += truncationNotice(maxResponseSizeMB, blob.size)
    }
  } catch {
    // Binary blobs may fail text().
  }
  return { finalBlob, text }
}

/** SW bridge: capped body + base64 bytes for chrome.runtime.sendMessage. */
export async function readCappedResponseBodyForBridge(
  blob: Blob,
  maxResponseSizeMB: number | undefined
): Promise<{ finalBlob: Blob; text: string; bodyBase64: string }> {
  const { finalBlob, text } = await readCappedResponseBody(blob, maxResponseSizeMB)
  const buf = await finalBlob.arrayBuffer()
  const bodyBase64 = bytesToBase64(new Uint8Array(buf))
  return { finalBlob, text, bodyBase64 }
}
