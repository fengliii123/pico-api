// Set-Cookie header parser.
//
// fetch()'s Headers API exposes only the LAST Set-Cookie value (they're
// collapsed into one header line), but our background service worker reads
// res.headers.getSetCookie() — which returns each Set-Cookie as a separate
// string. We parse those into a structured shape for display.

export interface ParsedCookie {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: string
  maxAge?: number
}

// Parse a single Set-Cookie value into its parts. Tolerant of malformed
// input — we'd rather show a partial parse than nothing.
//
// Examples we handle well:
//   "sessionId=abc123; Path=/; HttpOnly; Secure; SameSite=Lax"
//   "token=xyz; Domain=example.com; Max-Age=3600"
//   "plain=value"
export function parseSetCookie(raw: string): ParsedCookie {
  const parts = raw.split(';').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) return { name: '', value: '' }

  // First part is always name=value.
  const first = parts[0]
  const eqIdx = first.indexOf('=')
  const name = eqIdx >= 0 ? first.slice(0, eqIdx) : first
  const value = eqIdx >= 0 ? first.slice(eqIdx + 1) : ''

  const cookie: ParsedCookie = { name, value }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const idx = part.indexOf('=')
    const attrName = (idx >= 0 ? part.slice(0, idx) : part).toLowerCase()
    const attrValue = idx >= 0 ? part.slice(idx + 1) : ''

    switch (attrName) {
      case 'domain': cookie.domain = attrValue; break
      case 'path': cookie.path = attrValue; break
      case 'expires': cookie.expires = attrValue; break
      case 'max-age': {
        const n = Number(attrValue)
        if (!Number.isNaN(n)) cookie.maxAge = n
        break
      }
      case 'httponly': cookie.httpOnly = true; break
      case 'secure': cookie.secure = true; break
      case 'samesite':
        // Normalise to title-case (Strict / Lax / None) for display.
        cookie.sameSite = attrValue.charAt(0).toUpperCase() + attrValue.slice(1).toLowerCase()
        break
    }
  }
  return cookie
}

export function parseSetCookies(raws: string[]): ParsedCookie[] {
  return raws.map(parseSetCookie)
}
