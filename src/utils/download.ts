// Trigger a browser "Save file" download for a Blob by clicking a
// temporary <a download>. Centralizes the createObjectURL → anchor →
// revokeObjectURL dance that was duplicated across every export feature.
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Convenience for text payloads: wrap the string in a Blob of the given
// MIME type and download it.
export function downloadTextFile(filename: string, content: string, mime: string): void {
  downloadBlob(filename, new Blob([content], { type: mime }))
}
