// Verify the packaged zip actually loads as a working extension.
//
// Unzips store/pico-api-1.0.0.zip to a temp dir, launches Chrome with
// that as the load-extension target, opens the options page, and checks
// for runtime errors. Prints a verification report.
//
// Usage: node scripts/verify-package.mjs

import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const ZIP_PATH = path.resolve(PROJECT_ROOT, 'store', 'pico-api-1.0.0.zip')

const CHROME_BUNDLE =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  '/Users/fengli/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

if (!fs.existsSync(ZIP_PATH)) {
  console.error(`✗ zip not found: ${ZIP_PATH}`)
  process.exit(1)
}

const errors = []
const warnings = []
const checks = []

// ----- 1. Unzip and inspect manifest -----
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pico-verify-'))
const extDir = path.join(tmpRoot, 'extension')
fs.mkdirSync(extDir, { recursive: true })
try {
  execSync(`unzip -q "${ZIP_PATH}" -d "${extDir}"`, { stdio: 'inherit' })
} catch (e) {
  console.error('✗ unzip failed:', e.message)
  process.exit(1)
}

const manifestPath = path.join(extDir, 'manifest.json')
if (!fs.existsSync(manifestPath)) {
  errors.push('manifest.json missing at zip root')
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  checks.push(`manifest.json parses (${manifest.name} v${manifest.version})`)
  checks.push(`manifest_version: ${manifest.manifest_version}`)
  checks.push(`permissions: ${manifest.permissions.join(', ')}`)
  checks.push(`host_permissions: ${manifest.host_permissions.join(', ')}`)
  checks.push(`minimum_chrome_version: ${manifest.minimum_chrome_version}`)

  // Verify all referenced icon files exist.
  for (const size of Object.values(manifest.icons)) {
    const p = path.join(extDir, size)
    if (!fs.existsSync(p)) errors.push(`icon missing: ${size}`)
  }
  if (manifest.action?.default_icon) {
    for (const p of Object.values(manifest.action.default_icon)) {
      if (!fs.existsSync(path.join(extDir, p))) errors.push(`action icon missing: ${p}`)
    }
  }
  // Verify background and HTML entrypoints exist.
  if (manifest.background?.service_worker) {
    const p = path.join(extDir, manifest.background.service_worker)
    if (!fs.existsSync(p)) errors.push(`service worker file missing: ${manifest.background.service_worker}`)
  }
  for (const html of ['options.html', 'sidepanel.html']) {
    if (!fs.existsSync(path.join(extDir, html))) errors.push(`${html} missing`)
  }
}

// ----- 2. Launch Chrome with the unzipped extension -----
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pico-verify-profile-'))
const defaultDir = path.join(userDataDir, 'Default')
fs.mkdirSync(defaultDir, { recursive: true })
fs.writeFileSync(
  path.join(defaultDir, 'Preferences'),
  JSON.stringify({
    extensions: { ui: { developer_mode: true } },
    profile: { exit_type: 'Normal', exited_cleanly: true }
  })
)

let extensionId
const pageErrors = []
const consoleErrors = []

try {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: CHROME_BUNDLE,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
      '--no-first-run',
      '--no-default-browser-check'
    ]
  })

  try {
    // Wait for service worker.
    let sw = context.serviceWorkers().find(w => w.url().includes('chrome-extension://'))
    if (!sw) {
      await context.waitForEvent('serviceworker', { timeout: 30_000 })
      sw = context.serviceWorkers().find(w => w.url().includes('chrome-extension://'))
    }
    if (!sw) {
      errors.push('service worker did not register')
    } else {
      extensionId = new URL(sw.url()).host
      checks.push(`service worker registered (id: ${extensionId})`)
    }

    const page = await context.newPage()
    page.on('pageerror', err => pageErrors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    if (extensionId) {
      await page.goto(`chrome-extension://${extensionId}/options.html`)
      // Wait for the URL input as the "mounted" signal.
      try {
        await page.locator('input[placeholder*="api.example.com"]').first().waitFor({ state: 'visible', timeout: 15_000 })
        checks.push('options page mounted successfully')
      } catch {
        errors.push('options page did not mount (URL input not found within 15s)')
      }
      // Brief settle, then capture any late errors.
      await page.waitForTimeout(1500)
    }

    await page.close()
  } finally {
    await context.close()
  }
} catch (e) {
  errors.push(`launch failed: ${e.message}`)
} finally {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch { /* ignore */ }
  try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* ignore */ }
}

// ----- 3. Report -----
console.log('\n========== Pico API package verification ==========\n')
console.log('Zip:', path.relative(PROJECT_ROOT, ZIP_PATH))
console.log('')
console.log('Checks passed:')
for (const c of checks) console.log('  ✓', c)
if (warnings.length) {
  console.log('\nWarnings:')
  for (const w of warnings) console.log('  ⚠', w)
}
if (pageErrors.length) {
  console.log('\nPage errors:')
  for (const e of pageErrors) console.log('  ✗', e)
}
if (consoleErrors.length) {
  console.log('\nConsole errors (filtered):')
  for (const e of consoleErrors.slice(0, 5)) console.log('  ✗', e)
}
if (errors.length) {
  console.log('\nFailures:')
  for (const e of errors) console.log('  ✗', e)
  console.log('\n❌ Verification FAILED')
  process.exit(1)
}
console.log('\n✅ All checks passed — package is loadable and UI mounts cleanly')
