// HTML escaping + JSON-like token highlighting for the v-html overlays
// (request-body editor, response renderer, URL input). One shared
// implementation so request and response bodies render identically.
//
// Escaping happens BEFORE tokenizing, so the token regex runs on escaped
// text and the isKey probe must undo the entities escapeHtml produces.
// Do NOT extend escapeHtml with quote entities ("&#39;") — the tokenizer's
// string pattern matches literal `"` and would stop matching, silently
// disabling highlighting. All v-html call sites render in text context,
// where &<> escaping is sufficient for safety.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const JSON_TOKEN_RE = /("(?:\\.|[^"\\])*"\s*:?)|(\b(?:true|false)\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],])/g

export function highlightJsonLike(s: string): string {
  return escapeHtml(s).replace(JSON_TOKEN_RE, (_m, str, bool, nul, num, punct) => {
    if (str !== undefined) {
      const isKey = /:\s*$/.test(
        str.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      )
      return isKey
        ? `<span class="tk-key">${str}</span>`
        : `<span class="tk-str">${str}</span>`
    }
    if (bool !== undefined) return `<span class="tk-kw">${bool}</span>`
    if (nul !== undefined) return `<span class="tk-kw">${nul}</span>`
    if (num !== undefined) return `<span class="tk-num">${num}</span>`
    if (punct !== undefined) return `<span class="tk-punc">${punct}</span>`
    return _m
  })
}
