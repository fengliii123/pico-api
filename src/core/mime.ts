export type BodyKind = 'json' | 'html' | 'xml' | 'image' | 'pdf' | 'text' | 'binary'

// Heuristic: scan the first ~512 bytes of decoded text. If every byte is
// printable ASCII or common whitespace, treat as text (overriding the mime).
function looksLikeText(s: string | undefined): boolean {
  if (!s) return false
  const sample = s.slice(0, 512)
  if (!sample) return false
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i)
    // printable ASCII + tab/newline/CR
    if (c === 9 || c === 10 || c === 13) continue
    if (c < 32 || c === 127) return false
    // non-ASCII: latin-1 supplements are OK, anything above U+00FF is suspect
    if (c > 0x00ff) return false
  }
  return true
}

export function classify(
  mime: string | null | undefined,
  bodyText?: string
): BodyKind {
  if (!mime) {
    return looksLikeText(bodyText) ? 'text' : 'binary'
  }
  const m = mime.toLowerCase()

  if (m.includes('json') || m.includes('javascript')) return 'json'
  if (m.includes('html')) return 'html'
  if (m.includes('xml')) return 'xml'
  if (m.startsWith('image/')) return 'image'
  if (m.includes('pdf')) return 'pdf'
  if (m.startsWith('text/')) return 'text'
  // Generic binary types: fall back to sniffing the body.
  if (m === 'application/octet-stream') {
    return looksLikeText(bodyText) ? 'text' : 'binary'
  }

  return 'binary'
}