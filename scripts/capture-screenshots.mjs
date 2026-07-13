// Capture Chrome Web Store screenshots of Pico API.
//
// Launches a real Chrome with the unpacked extension loaded from dist/,
// opens the options page, drives the UI through a few representative
// states, and saves 1280×800 PNGs to store/screenshots/.
//
// Usage:
//   npm run build
//   node scripts/capture-screenshots.mjs
//
// Output files (matching the order they're taken):
//   1-main-tree-view.png      ← hero shot for the listing
//   2-capture-panel.png
//   3-settings.png
//   4-import-curl.png
//   5-pretty-view.png

import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.resolve(PROJECT_ROOT, 'dist')
const OUT_DIR = path.resolve(PROJECT_ROOT, 'store', 'screenshots')

const CHROME_BUNDLE =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  '/Users/fengli/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

if (!fs.existsSync(DIST_DIR)) {
  console.error(`dist/ not found at ${DIST_DIR}. Run \`npm run build\` first.`)
  process.exit(1)
}
if (!fs.existsSync(CHROME_BUNDLE)) {
  console.error(`Chrome binary not found at ${CHROME_BUNDLE}.`)
  process.exit(1)
}
fs.mkdirSync(OUT_DIR, { recursive: true })

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
    // Window size sets the inner viewport for screenshots.
    '--window-size=1280,800'
  ],
  viewport: { width: 1280, height: 800 }
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

  // Force English locale for store screenshots (global audience).
  // Set localStorage and reload so the app re-reads locale on mount.
  await page.evaluate(() => {
    try { localStorage.setItem('mp2:locale', 'en') } catch { /* ignore */ }
  })
  await page.reload({ waitUntil: 'load' })
  await page.locator('input[placeholder*="api.example.com"]').first().waitFor({ state: 'visible', timeout: 15_000 })
  // Small extra settle for AntD hydration.
  await page.waitForTimeout(800)

  // Helper.
  async function shot(name, opts = {}) {
    const outPath = path.join(OUT_DIR, `${name}.png`)
    await page.screenshot({ path: outPath, fullPage: false, ...opts })
    console.log(`wrote ${path.relative(PROJECT_ROOT, outPath)}`)
  }

  // =========================================================
  // Shot 1 — main view, send a real request, response in tree mode
  // =========================================================
  // Type a real public API endpoint that returns rich JSON.
  const urlInput = page.locator('input[placeholder*="api.example.com"]').first()
  await urlInput.fill('https://api.github.com/repos/vuejs/core')
  // Find the Send button — it's the primary button at the end of the toolbar.
  // The URL bar input is wrapped in a flex row with the Send button.
  // Click by visible text to be resilient to DOM changes.
  await page.getByRole('button', { name: /send/i }).first().click()
  // Wait for the response panel to populate.
  await page.waitForTimeout(2500)
  // Switch to Tree view (the segmented control has a Tree icon button).
  // Try multiple selector strategies — the segmented control renders as buttons.
  // Strategy: find a button whose aria-label or title contains "Tree".
  // If that fails, just use the default view.
  try {
    const treeBtn = page.locator('[title*="Tree"], [aria-label*="Tree"]').first()
    if (await treeBtn.count() > 0) {
      await treeBtn.click({ timeout: 2000 })
      await page.waitForTimeout(500)
    }
  } catch {
    // Tree mode may already be active or selector mismatch — skip silently.
  }
  await shot('1-main-tree-view')

  // =========================================================
  // Shot 2 — capture panel
  // =========================================================
  // The sidebar segmented control has "Capture" as the second option.
  // Find it by visible text.
  try {
    await page.getByText('Capture', { exact: true }).first().click()
    await page.waitForTimeout(600)
    await shot('2-capture-panel')
  } catch (e) {
    console.log('[shot 2] capture button not found, skipping:', e.message)
  }

  // =========================================================
  // Shot 3 — settings modal
  // =========================================================
  // Switch back to Requests first.
  try {
    await page.getByText('Requests', { exact: true }).first().click()
  } catch { /* ignore */ }
  // Click the Settings button in the sidebar footer.
  try {
    await page.getByRole('button', { name: /settings/i }).first().click()
    await page.waitForTimeout(800)
    await shot('3-settings')
    // Close modal.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  } catch (e) {
    console.log('[shot 3] settings modal failed:', e.message)
  }

  // =========================================================
  // Shot 4 — import cURL modal
  // =========================================================
  try {
    // The Import button has a tooltip "Import from cURL".
    await page.locator('[title*="Import"], [aria-label*="Import"]').first().click()
    await page.waitForTimeout(500)
    // Paste a sample cURL into the textarea.
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
  // Shot 5 — pretty view (JSON pretty-printed)
  // =========================================================
  // Re-send the request so response panel is populated.
  try {
    await urlInput.fill('https://api.github.com/repos/vuejs/core')
    await page.getByRole('button', { name: /send/i }).first().click()
    await page.waitForTimeout(2500)
    // Switch to Pretty view.
    const prettyBtn = page.locator('[title*="Pretty"], [aria-label*="Pretty"]').first()
    if (await prettyBtn.count() > 0) {
      await prettyBtn.click({ timeout: 2000 })
      await page.waitForTimeout(500)
    }
    await shot('5-pretty-view')
  } catch (e) {
    console.log('[shot 5] pretty view failed:', e.message)
  }

  console.log('\nAll screenshots captured to store/screenshots/')
} finally {
  await context.close()
  try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* ignore */ }
}
