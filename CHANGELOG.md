# Changelog

All notable changes to Pico API are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] — 2026-08-29

Store visibility release.

### Changed

- **Extension name now leads with search keywords**: "HTTP & REST Client -
  Pico API" (was "Pico API - HTTP & REST Client"). Update the store listing
  names for every language to match.

### Added

- **One-time rating prompt**: after 15 successful sends, a single
  dismissible dialog links to the Chrome Web Store review page. Never
  shown twice; counts and state live in localStorage.
- Feedback link in Settings now points to the real store review URL.

## [1.0.5] — 2026-08-26

Stability and polish release: streaming memory caps, Postman-compatible
`pm.variables`, i18n error messages, narrow-window layout fixes, and a
product landing page.

### Added

- **`pm.variables.get/set/unset`** in scripts: Postman-style request-scoped
  local variables — resolved in the request URL/headers/body after the
  pre-request script runs, never persisted (scope order local > environment
  > globals).
- **History batch delete**: multi-select checkboxes with a confirm dialog,
  alongside the existing per-entry delete and clear-all.
- **Empty-state actions**: the collection tree and response panel empty
  states now offer "New Request" / "New Folder" / "Send" buttons.
- **Product landing page** (`docs/`) with full SEO metadata (OG, Twitter
  Card, JSON-LD), relocated privacy policy, and rewritten bilingual README.

### Fixed

- **Streaming responses now honor the max-response-size cap** — previously
  the streaming path bypassed it entirely and grew without bound; oversized
  streams are truncated at an exact byte boundary (multi-byte UTF-8 safe).
- **Header names deduplicated case-insensitively** — `Content-Type` and
  `content-type` no longer silently coexist; duplicates are surfaced as
  virtual rows.
- **Sandbox postMessage hardened**: both directions verify `event.source`,
  so a foreign window can neither trigger script execution nor inject
  results.
- **Pre-request script variables usable in the URL**: the unresolved-variable
  check now runs after the pre-request script instead of before it.
- **Command palette close paths repaired** — Esc / overlay click / executing
  a command previously left the palette open; focus is now also restored to
  the previously focused element. `⌘K` now works while typing in an input.
- **Timeouts surface as timeouts** — an aborted-by-timeout request showed
  Chrome's raw "signal is aborted without reason"; it now reports a
  localized timeout error with the matching hint.
- **Import dialog no longer overflows** on narrow windows — the mode switch
  and URL/file import actions are laid out on separate rows; the URL input
  flexes to the available width.
- **form-data file rows** no longer overflow narrow panels: the filename
  cell shrinks with ellipsis truncation and column tracks use `minmax()`.
- **Copy-as-cURL exports resolved variables** (previously raw `{{baseUrl}}`
  placeholders), and `{{var}}` placeholders stay readable in the URL bar
  instead of appearing percent-encoded.
- **Response panel tab state**: switching from a request with test results
  to one without no longer leaves the panel blank (dangling active tab).
- Full functional test pass (26 unit tests) plus a number of smaller i18n
  placeholder gaps closed (auth form, urlencoded table, JSON tree tooltip).

## [1.0.0] — 2026-07-08

First Chrome Web Store release. Stable API surface, no known crashes, full
feature set for an MVP REST client + network capture.

### Added

- **Side panel UI**: the entire app lives in Chrome's side panel
  (`sidepanel.html`); a "fullscreen" button pops out to a full options
  tab (`options.html`) when more room is needed.
- **Tree-structured collection**: organize saved requests into folders
  (up to 5 levels deep). Drag to reorder, rename in place, full-tree
  search.
- **Request builder**: every HTTP method, headers, query params, body
  formats (urlencoded, raw JSON, raw XML, raw text). Content-Type
  auto-detection. URL variables (`{{var}}`) highlighted live.
- **Response viewer**: three view modes — JSON tree with copy-path,
  syntax-highlighted raw, and Pretty. Status, timing breakdown
  (DNS/connect/TLS/wait/receive), response size, MIME, and Set-Cookie
  headers all surfaced separately.
- **Network capture**: attach Chrome's debugger to any tab to observe
  Fetch/XHR traffic live. Replay any captured request into the editor
  with one click. Filter "API only" or "all traffic". The debugger
  attaches only while a capture session is active and detaches on stop,
  tab close, or service worker suspension.
- **Environments and variables**: define variables scoped per
  environment, switch from the sidebar or via `⌘⇧K`. Live URL-bar
  highlighting of `{{var}}` placeholders.
- **Import**: paste cURL, drop an OpenAPI document, or import a Postman
  Collection — requests are reconstructed into the tree.
- **Export**: ship the whole collection (or a single folder / request)
  as an OpenAPI document for sharing.
- **History**: every sent request is kept (capped) with full request
  and response. Resend or open as a new draft.
- **Templates**: save a request as a template; stamp new ones from it.
- **Keyboard shortcuts**:
  - `⌘⇧P` — open command palette
  - `⌘⇧H` — open history
  - `⌘⇧K` — quick switch environment
  - `⌘⏎` — send request (from the URL bar)
  - `⌘S` — save current draft
  - `⌘Z` / `⌘⇧Z` — undo / redo
- **Themes**: light, dark, eye-comfort — three palettes tuned for long
  debugging sessions.
- **i18n**: English and Simplified Chinese, auto-detected from browser
  language.
- **Browser cookies**: opt-in, per-request toggle to inject the
  browser's session cookies as a `Cookie` header on outgoing requests.
- **Data backup / restore**: export the whole local DB to a JSON file
  and re-import on another machine.

### Brand

- Name: **Pico API** (short: **Pico**)
- Pronunciation: "PEE-co" (rhymes with "echo")
- Tagline: "The smallest meaningful unit of a REST client."
- Palette anchor: cyan/teal `#00C9A7`
- Custom logo: stylized bird carrying a camera (brand mark in
  `public/icons/logo.svg`).

### Security & Privacy

- **No analytics, no telemetry, no third-party scripts.**
- All user data stored locally in IndexedDB and `chrome.storage.local`.
- Network capture runs entirely in-memory; captured traffic never
  written to disk.
- Cookie access is opt-in per request; the extension never sets or
  deletes cookies.
- Strict CSP: `script-src 'self'; object-src 'self'`.
- See `store/PRIVACY.md` for the full privacy policy.

### Known Limitations

- Capture feature cannot attach to a tab that already has DevTools
  open — Chrome forbids two debuggers. The extension surfaces this as
  a clear error.
- WebSocket / SSE responses are not captured in this release; only
  Fetch/XHR are surfaced.
- The 16×16 toolbar icon reduces the logo to a teal blob with a white
  P — small-size detail (eye, camera LED) blends into the mass. This
  is unavoidable at 16×16 and reads correctly from 32×32 upward.

## [0.2.0] — 2026-06

Internal alpha. Project renamed to Pico API, design tokens introduced,
side panel layout finalized. Not submitted to the Chrome Web Store.

## [0.1.0] — 2026-05

Initial prototype. Basic request/response flow, IndexedDB persistence,
folder tree. No capture, no environments, no i18n.
