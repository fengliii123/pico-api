**English** | [简体中文](./README.zh-CN.md)

# Pico API

A tiny REST client that lives in your Chrome side panel. Send requests,
capture traffic, and debug APIs without leaving the tab.

> `pico-` is the SI prefix for 10⁻¹² — the smallest meaningful unit.
> We aim to be the smallest REST client that still feels useful.

## Brand

- **Name**: Pico API (short: **Pico**)
- **Pronunciation**: "PEE-co" (rhymes with "echo", not "pick-o")
- **Tagline**: "Smallest meaningful unit of a REST client"
- **Palette anchor**: cyan/teal (`#00C9A7`) — chosen for fast/clean feel.

## Tech stack

- Vue 3 + TypeScript + Vite
- Pinia for state
- Ant Design Vue for UI components
- Native IndexedDB for persistence
- **No `vuedraggable`** — KeyValueTable uses native HTML5 drag-and-drop
  (the vuedraggable ecosystem is stuck on Vue 2 / Sortable.js shims).

## Features (MVP)

- Tree-structured folders (up to 5 levels) for organizing saved requests
- HTTP request builder: method, URL, headers, params, body
  (urlencoded / raw JSON/XML/text)
- Response viewer with Content-Type aware rendering
- Persistent storage via IndexedDB
- History of sent requests (capped)

## Development

```bash
npm install
npm run dev      # local dev (loads into a normal browser tab)
npm run build    # production build into dist/
```

After `npm run dev`, open one of these URLs in your browser. The project
root has no `index.html` — visiting `http://localhost:5173/` returns 404,
you have to navigate to a specific entry:

- Main UI:     <http://localhost:5173/src/options/index.html>
- Side panel:  <http://localhost:5173/src/sidepanel/index.html>
- Sandbox:     <http://localhost:5173/src/sandbox/index.html>

## Loading as extension

1. `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. "Load unpacked" → select `dist/`

## Layout

```
src/
├── background/      service worker (click handler → opens options page)
├── options/         main UI (Vue app)
├── components/
│   ├── layout/      AppLayout
│   ├── tree/        CollectionTree + treeUtils
│   ├── request/     RequestEditor + KeyValueTable + BodyEditor + MethodDropdown
│   ├── response/    ResponsePanel
│   └── common/      StatusTag, EmptyState
├── stores/          Pinia: collection, request, response, settings
├── db/              IndexedDB schema + CRUD
├── core/            pure functions: http, headers, url, body, mime, types
└── utils/           id, format
```

## License

The source code of this extension is **proprietary**. All rights reserved. See [`LICENSE`](./LICENSE) for details.

End users may install and use the compiled extension via the Chrome Web Store. Copying, redistributing, or re-publishing the source code — in open-source or commercial projects — requires written permission from the maintainer.