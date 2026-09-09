# Changelog

All notable changes to Pico API are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.8] — 2026-09-08

Correctness and hardening release (full code review pass).

### Fixed

- **Extension network errors were mislabeled as CORS.** A "Failed to fetch"
  that went through the background service worker (where CORS cannot
  happen) surfaced as "Blocked by CORS"; it now reports a connectivity
  problem with an accurate message.
- **cURL import: unknown flags swallowed the URL.** `curl --http1.1
  https://…` consumed the URL as the flag's value and failed with "No URL
  found". Unknown flags no longer eat URL-looking tokens.
- **cURL import: non-Latin1 Basic credentials crashed the import.** `-u
  "user:密码"` hit `btoa`'s Latin1 limit; credentials are now UTF-8 encoded
  (request Basic auth had the same latent bug — fixed there too).
- **cURL import: a bare `%` in urlencoded bodies crashed decoding.** Values
  like "50% off" now import as-is instead of throwing `URIError`.
- **Streaming + multipart body was sent garbled.** The streaming bridge
  path didn't rebuild the base64-transported Blob body the way the normal
  path does.
- **Streaming responses reported the wrong size** for multi-byte content
  (character count instead of byte count) and built the response Blob
  twice.
- **The streaming UI ignored an `Accept: text/event-stream` header**
  written with canonical casing (lookup was lowercase-only).
- `pm.expect().to.eql`: `NaN` now equals `NaN`, and cyclic structures no
  longer hang the script.
- `pm.sendRequest` sub-requests now honor Cancel and the browser-cookie
  setting, consistent with the main request.

### Changed

- The background service worker validates message and port senders before
  proxying fetches (defense-in-depth for the privileged relay).
- API import modal: preview tags ("operations / tags / duplicates
  skipped") are localized instead of hardcoded Chinese; the live preview
  re-parse moved out of a side-effecting computed into a watch.
- JSON / URL syntax highlighting unified into one shared implementation
  (`src/utils/highlight.ts`) so request body, response body, and the URL
  overlay cannot drift apart again.
- Added unit tests for cURL flag parsing, non-Latin1 Basic auth,
  urlencoded fallback, and error classification (privileged vs direct).

### Removed

- 49 unused i18n keys (en/zh), including one advertising a "Postman
  Collection" import the app does not have.
- Dead `inflightStreaming` map, stray `executeStreaming` debug logs, and
  the unused `@codemirror/theme-one-dark` / `@types/js-yaml` dependencies.
  `@codemirror/language` and `@codemirror/autocomplete` are now declared
  dependencies (they were riding transitive resolution).
- ~150 lines of unreachable CSS in ResponsePanel (the code/image/binary
  styles actually live in ResponseBodyRenderer) and a dead `splitUrlParams`
  wrapper in the cURL importer.

### Refactored (behavior-preserving)

- Full readability pass: the duplicated URL-validation block in `send()`
  now shares one `assertHttpUrl` path; transport-body encoding, cookie
  injection, script-context assembly, sibling re-ordering, and the
  undo/redo bodies each collapsed to a single shared implementation.
- AntD drop placement derivation extracted into a pure
  `resolveDropPlacement` (treeUtils) — the tree component's drop handler
  is now ~30 lines.
- The success / streaming-completed response tabs share one
  `ResponseResultTabs` component instead of two near-identical template
  blocks.
- `src/i18n/index.ts` (1,300 lines) split into `types.ts` / `en.ts` /
  `zh-CN.ts` plus a 40-line aggregation entry point.

## [1.0.7] — 2026-09-03

Feature, retention, and performance release.

### Added

- **`pm.sendRequest(url, cb)`** in scripts: fetch another endpoint from a
  pre-request or test script and use the result (Postman-shaped response
  object with `json()/text()/headers()/status`). Routed through the
  extension's request bridge — no CORS limits; sandbox runs proxy the call
  through the host page via a hardened sub-message protocol.
- **`pm.collectionVariables`** now works as a read/write alias over globals
  (previously a console warning). Documented mapping in the README.
- **Postman-style assertions**: `pm.response.to.have.header()/body()`,
  status getters (`to.be.ok/created/accepted/badRequest/unauthorized/
  forbidden/notFound/serverError`), and `pm.expect().to.eql/equal/include/
  a/an` plus `to.be.empty/null/undefined/defined/exist/true/false`.
- **Collection tree search/filter** by name or URL, with ancestors kept
  visible and auto-expanded while searching.
- **First-run experience**: the app opens automatically right after
  install; the onboarding dialog offers a one-click example request; an
  "Examples / 示例" folder with two sendable requests is seeded once (and
  re-localizes when the UI language changes, unless the user edited it).
- **History "Re-run" now actually re-sends** the request after restoring
  it (method, URL, headers, params, body) into the editor.
- **OpenAPI import resolves local `$ref`s** (`#/components/…` and legacy
  `#/definitions/…`), including nested refs, with cycle protection and a
  summary warning for unresolvable/external refs; schema examples now
  honor `default` and `enum` values.
- **Playable e2e smoke suite** (`npm run test:e2e`): Playwright config +
  local fixture server covering the install→send→response golden path.

### Changed

- **JSON tree rewritten as a lazy recursive renderer**: arbitrarily large
  responses open instantly (containers materialize only when expanded,
  wide containers stay collapsed by default) — the 10k-node tree
  disablement is gone.
- **Store summaries lead with privacy** (en/zh): "Data stays local: no
  account, no tracking."
- Import-dialog errors are localized (en/zh); duplicate cURL imports
  auto-number ("Imported cURL 2") instead of failing.

### Fixed

- Timing breakdown on re-sent requests showed the PREVIOUS run's numbers
  (resource-timing entry selection).
- `pm.expect(number).to.be.empty` incorrectly passed; it now fails
  (chai semantics).
- Import conflicts leaked raw i18n machine codes (`requestNameConflict:…`)
  into the UI.
- History grows unbounded in IndexedDB — entries are now pruned to the
  newest 500 after each write.
- Duplicate-cURL import name collision (see above).
- Dev-page favicon 404.

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
