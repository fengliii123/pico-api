// Capture Chrome Web Store screenshots of Pico API (v2 — with marketing banners).
//
// Phase 1: launches a real Chrome with the unpacked extension loaded from dist/,
// drives the UI through five representative states at 1280x680, and saves raw
// UI shots to store/screenshots-v2/raw/.
// Phase 2: composes each raw shot under a 1280x120 marketing banner into the
// final 1280x800 store images in store/screenshots-v2/.
//
// All request targets are served by a local HTTP server started by this
// script — no external APIs (jsonplaceholder/github 403 or get blocked on
// some networks, which used to break the screenshots).
//
// Usage:
//   npm run build
//   node scripts/capture-screenshots.mjs
//
// Output files:
//   1-postman-alternative.png  ← hero shot: request sent, response tree
//   2-streaming-live.png       ← SSE stream rendering mid-flight
//   3-json-tree.png            ← deep JSON tree view
//   4-import-curl.png          ← cURL import modal
//   5-local-first.png          ← collections + history in the sidebar

import { chromium } from 'playwright'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.resolve(PROJECT_ROOT, 'dist')
const OUT_DIR = path.resolve(PROJECT_ROOT, 'store', 'screenshots-v2')
const RAW_DIR = path.join(OUT_DIR, 'raw')

const UI_W = 1280
const UI_H = 680
const BANNER_H = 120

// Prefer PLAYWRIGHT_CHROMIUM_PATH; otherwise use the newest playwright
// chromium build in the shared cache (the exact build number changes
// with every playwright update, so hardcoding one path breaks).
function findChrome() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_PATH)) {
    return process.env.PLAYWRIGHT_CHROMIUM_PATH
  }
  const cacheDir = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
  if (!fs.existsSync(cacheDir)) return null
  const versions = fs.readdirSync(cacheDir).filter(d => /^chromium-\d+$/.test(d)).sort().reverse()
  for (const v of versions) {
    for (const dir of ['chrome-mac-arm64', 'chrome-mac']) {
      const bin = path.join(cacheDir, v, dir, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
      if (fs.existsSync(bin)) return bin
    }
  }
  return null
}

const CHROME_BUNDLE = findChrome()

if (!fs.existsSync(DIST_DIR)) {
  console.error(`dist/ not found at ${DIST_DIR}. Run \`npm run build\` first.`)
  process.exit(1)
}
if (!CHROME_BUNDLE) {
  console.error('No playwright chromium binary found. Set PLAYWRIGHT_CHROMIUM_PATH or run `npx playwright install chromium`.')
  process.exit(1)
}
fs.mkdirSync(RAW_DIR, { recursive: true })

// ----- local JSON server (deterministic, offline-safe data source) -----
const USER_JSON = {
  id: 1, name: 'Leanne Graham', username: 'Bret',
  email: 'leanne.graham@pico.dev', phone: '1-770-736-8031 x56442', website: 'pico.dev',
  address: { street: 'Kulas Light', suite: 'Apt. 556', city: 'Gwenborough', zipcode: '92998', geo: { lat: '-37.3159', lng: '81.1496' } },
  company: { name: 'Pico Labs', catchPhrase: 'The smallest meaningful unit of a REST client', bs: 'http client' }
}
const REPO_JSON = {
  id: 42, name: 'core', full_name: 'vuejs/core', private: false,
  description: 'The progressive JavaScript framework for building user interfaces',
  stargazers_count: 48213, forks_count: 8412, open_issues_count: 617,
  language: 'TypeScript', license: { key: 'mit', name: 'MIT License' },
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
  topics: ['vue', 'typescript', 'frontend', 'reactivity'],
  owner: { login: 'vuejs', avatar_url: 'https://pico.dev/avatar.png' }
}
const STREAM_TOKENS = ['Hello', ' from', ' a', ' live', ' stream', ' —', ' tokens', ' arrive', ' one', ' by', ' one,', ' rendered', ' the', ' moment', ' they', ' land.', ' No', ' waiting', ' for', ' the', ' full', ' response.']

const localServer = http.createServer((req, res) => {
  if (req.url.startsWith('/stream')) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    })
    let i = 0
    const timer = setInterval(() => {
      const token = STREAM_TOKENS[i % STREAM_TOKENS.length]
      res.write(`data: {"token":"${token}","seq":${i + 1}}\n\n`)
      i++
      if (i > 400) { clearInterval(timer); res.end() }
    }, 320)
    req.on('close', () => clearInterval(timer))
    return
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.url.startsWith('/users')) res.end(JSON.stringify(USER_JSON))
  else if (req.url.startsWith('/repos')) res.end(JSON.stringify(REPO_JSON))
  else { res.statusCode = 404; res.end(JSON.stringify({ message: 'not found' })) }
})
function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = e => { localServer.off('listening', onOk); reject(e) }
    const onOk = () => { localServer.off('error', onError); resolve() }
    localServer.once('error', onError)
    localServer.once('listening', onOk)
    localServer.listen(port, '127.0.0.1')
  })
}
// Serve on port 80 when possible so URLs read "http://api.pico.test/users/1"
// (macOS 10.14+ allows unprivileged low-port binding); fall back to 8899.
try { await listen(Number(process.env.SHOTS_PORT || 80)) } catch { await listen(8899) }
const LOCAL_PORT = localServer.address().port
// .dev is HSTS-preloaded (HTTPS forced) — plain http:// on it always fails;
// .test is the reserved TLD without that problem.
const BASE_URL = `http://api.pico.test${LOCAL_PORT === 80 ? '' : `:${LOCAL_PORT}`}`
console.log(`local server on ${BASE_URL} (→ 127.0.0.1:${LOCAL_PORT})`)

// ----- launch Chrome with the extension loaded -----
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pico-shots-'))
const defaultDir = path.join(userDataDir, 'Default')
fs.mkdirSync(defaultDir, { recursive: true })
fs.writeFileSync(
  path.join(defaultDir, 'Preferences'),
  JSON.stringify({
    extensions: { ui: { developer_mode: true } },
    profile: { exit_type: 'Normal', exited_cleanly: true }
  })
)

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  executablePath: CHROME_BUNDLE,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${DIST_DIR}`,
    `--load-extension=${DIST_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Make the local server answer to a friendly hostname in screenshots.
    // Direct connection only — a system proxy would fail to resolve the
    // mapped hostname (localhost is exempt, api.pico.test is not).
    '--no-proxy-server',
    '--host-resolver-rules=MAP api.pico.test 127.0.0.1',
    // Window size sets the inner viewport for screenshots.
    `--window-size=${UI_W},${UI_H}`
  ],
  viewport: { width: UI_W, height: UI_H }
})

try {
  // Wait for the SW to register so we can read the extension id.
  let sw = context.serviceWorkers().find(w => w.url().includes('chrome-extension://'))
  if (!sw) {
    await context.waitForEvent('serviceworker', { timeout: 60_000 })
    sw = context.serviceWorkers().find(w => w.url().includes('chrome-extension://'))
  }
  if (!sw) throw new Error('Extension service worker did not register')
  const extensionId = new URL(sw.url()).host

  const page = await context.newPage()
  page.on('pageerror', err => console.log('[pageerror]', err.message))

  // Open options page.
  await page.goto(`chrome-extension://${extensionId}/options.html`)
  // Wait for the URL input to appear — the canonical "app is mounted" signal.
  await page.locator('input[placeholder*="api.example.com"]').first().waitFor({ state: 'visible', timeout: 15_000 })

  // Force English locale + suppress the first-run onboarding modal.
  await page.evaluate(() => {
    try {
      localStorage.setItem('mp2:locale', 'en')
      localStorage.setItem('mp2:onboarded', '1')
    } catch { /* ignore */ }
  })
  await page.reload({ waitUntil: 'load' })
  await page.locator('input[placeholder*="api.example.com"]').first().waitFor({ state: 'visible', timeout: 15_000 })
  // Small extra settle for AntD hydration.
  await page.waitForTimeout(800)

  async function shot(name) {
    const outPath = path.join(RAW_DIR, `${name}.png`)
    await page.screenshot({ path: outPath, fullPage: false })
    console.log(`raw: ${path.relative(PROJECT_ROOT, outPath)}`)
  }
  const urlInput = page.locator('input[placeholder*="api.example.com"]').first()
  const sendBtn = page.getByRole('button', { name: /send/i }).first()

  // Switch the response panel to JSON tree view. The tree toggle is the
  // seg button carrying the branches icon (AntD tooltips don't render a
  // title attribute, so the icon class is the stable anchor).
  async function switchToTreeView() {
    const btn = page.locator('.seg-btn:has(.anticon-branches)').first()
    if (await btn.count() === 0) { console.log('[tree] branches button not found'); return false }
    await btn.click({ timeout: 2000 })
    await page.waitForTimeout(500)
    const cls = (await btn.getAttribute('class')) || ''
    const ok = cls.includes('active')
    if (!ok) console.log('[tree] button not active after click:', cls)
    return ok
  }

  // =========================================================
  // Raw shot 1 — request sent, response in tree view (hero)
  // =========================================================
  await urlInput.fill(`${BASE_URL}/users/1`)
  await sendBtn.click()
  await page.waitForTimeout(2500)
  await switchToTreeView()
  await shot('1-postman-alternative')

  // =========================================================
  // Raw shot 2 — SSE stream rendering mid-flight
  // =========================================================
  await urlInput.fill(`${BASE_URL}/stream`)
  await sendBtn.click()
  // Screenshot while chunks are still arriving (~10 chunks in).
  await page.waitForTimeout(3400)
  await shot('2-streaming-live')
  // Abort the stream so later shots start from a clean state.
  try {
    const stopBtn = page.getByRole('button', { name: /stop|cancel|abort/i }).first()
    if (await stopBtn.count() > 0) await stopBtn.click({ timeout: 1500 })
  } catch { /* stream keeps running; next send replaces the panel */ }

  // =========================================================
  // Raw shot 3 — deep JSON tree view
  // =========================================================
  await urlInput.fill(`${BASE_URL}/repos/vuejs/core`)
  await sendBtn.click()
  await page.waitForTimeout(2500)
  await switchToTreeView()
  await shot('3-json-tree')

  // =========================================================
  // Raw shot 4 — cURL import modal with a filled sample
  // =========================================================
  try {
    await page.locator('[title*="Import"], [aria-label*="Import"]').first().click()
    await page.waitForTimeout(500)
    const textarea = page.locator('textarea').first()
    if (await textarea.count() > 0) {
      await textarea.fill(`curl -X POST 'https://api.example.com/login' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer {{token}}' \\
  -d '{"user":"alice","remember":true}'`)
      await page.waitForTimeout(400)
    }
    await shot('4-import-curl')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  } catch (e) {
    console.log('[shot 4] import modal failed:', e.message)
  }

  // =========================================================
  // Raw shot 5 — collections sidebar + history after real use
  // =========================================================
  // The seeded example collection is present on a fresh profile; the sends
  // above have produced history entries. Show the sidebar collections view.
  await urlInput.fill(`${BASE_URL}/users/1`)
  await sendBtn.click()
  await page.waitForTimeout(2500)
  await shot('5-local-first')

  console.log('\nPhase 1 done (raw UI shots).')
} finally {
  await context.close()
  localServer.close()
  try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* ignore */ }
}

// ----- Phase 2: compose raw shots with marketing banners -----
const SHOTS = [
  {
    raw: '1-postman-alternative',
    headline: 'The lightweight Postman alternative for Chrome',
    sub: 'No account · No cloud sync · No bloat'
  },
  {
    raw: '2-streaming-live',
    headline: 'Watch streaming responses arrive live',
    sub: 'SSE · NDJSON · LLM token streams'
  },
  {
    raw: '3-json-tree',
    headline: 'A JSON tree that stays fast on any response',
    sub: 'Copy path · Deep nesting · Syntax highlighting'
  },
  {
    raw: '4-import-curl',
    headline: 'Bring your existing requests along',
    sub: 'Import cURL · OpenAPI · ApiFox'
  },
  {
    raw: '5-local-first',
    headline: 'Everything stays on your machine',
    sub: 'Local-first · Open source · No tracking'
  }
]

function bannerHtml(shot) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; }
    body { width: ${UI_W}px; height: ${BANNER_H + UI_H}px; }
    .wrap { width: ${UI_W}px; }
    .banner {
      height: ${BANNER_H}px; background: #0f172a;
      border-bottom: 4px solid #00B894;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 56px; box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    }
    .text h1 { font-size: 38px; font-weight: 800; color: #ffffff; letter-spacing: -0.6px; line-height: 1.15; }
    .text p { font-size: 18px; color: #2EE6C2; margin-top: 8px; font-weight: 600; letter-spacing: 0.1px; }
    .logo { display: flex; align-items: center; gap: 14px; }
    .logo .mark {
      width: 54px; height: 54px; border-radius: 12px; background: #00B894;
      color: #fff; font-weight: 900; font-size: 32px;
      display: flex; align-items: center; justify-content: center;
    }
    .logo .name { color: #94a3b8; font-size: 20px; font-weight: 700; }
    img { width: ${UI_W}px; height: ${UI_H}px; display: block; }
  </style></head><body>
    <div class="wrap">
      <div class="banner">
        <div class="text"><h1>${esc(shot.headline)}</h1><p>${esc(shot.sub)}</p></div>
        <div class="logo"><div class="mark">P</div><div class="name">Pico API</div></div>
      </div>
      <img src="${shot.raw}.png">
    </div>
  </body></html>`
}

const browser = await chromium.launch()
const composePage = await browser.newPage({ viewport: { width: UI_W, height: BANNER_H + UI_H } })
for (const shot of SHOTS) {
  const htmlPath = path.join(RAW_DIR, `${shot.raw}-compose.html`)
  fs.writeFileSync(htmlPath, bannerHtml(shot))
  await composePage.goto(`file://${htmlPath}`)
  await composePage.locator('img').waitFor({ state: 'visible' })
  await composePage.waitForTimeout(120)
  const outPath = path.join(OUT_DIR, `${shot.raw}.png`)
  await composePage.screenshot({ path: outPath, fullPage: false })
  console.log(`final: ${path.relative(PROJECT_ROOT, outPath)}`)
}
await browser.close()
console.log(`\nAll v2 screenshots captured to ${path.relative(PROJECT_ROOT, OUT_DIR)}/`)
