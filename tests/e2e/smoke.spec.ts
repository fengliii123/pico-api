// Golden-path smoke test: fresh profile → onboarding CTA → send a real
// request against the local fixture server → response renders. Run via
// `npm run test:e2e` (config builds dist/ and starts both servers).
import { expect, test } from '@playwright/test'

test('first run → onboarding CTA → send → 200 + body', async ({ page }) => {
  await page.goto('/options.html')

  // Fresh context: onboarding modal appears with the example CTA.
  const cta = page.getByRole('button', { name: /try with example|试试示例/i }).first()
  await expect(cta).toBeVisible({ timeout: 15_000 })
  await cta.click()

  // CTA filled the example URL; point it at the deterministic fixture.
  const urlBar = page.locator('input[placeholder*="api.example.com"]').first()
  await expect(urlBar).toHaveValue(/jsonplaceholder|example/)
  await urlBar.fill('http://127.0.0.1:8896/users/1')

  await page.getByRole('button', { name: /send|发送/i }).first().click()

  const main = page.locator('main')
  await expect(main).toContainText('200', { timeout: 20_000 })
  await expect(main).toContainText('Leanne')

  // Examples seed folder exists.
  await expect(page.locator('.tree-row').filter({ hasText: /examples|示例/i }).first()).toBeVisible()

  // Favicon resolves (no dev 404).
  const icon = await page.request.get('/icons/16.png')
  expect(icon.status()).toBe(200)
})

test('tree view renders the JSON response', async ({ page }) => {
  // This test targets the response UI — skip the first-run onboarding.
  await page.addInitScript(() => {
    localStorage.setItem('mp2:onboarded', '1')
    localStorage.setItem('mp2:seededExamples', '1')
  })
  await page.goto('/options.html')
  await page.locator('input[placeholder*="api.example.com"]').first().fill('http://127.0.0.1:8896/users/1')
  await page.getByRole('button', { name: /send|发送/i }).first().click()
  await expect(page.locator('main')).toContainText('Leanne', { timeout: 20_000 })

  // First segmented button switches to the tree view.
  await page.locator('.seg-btn').first().click()
  await expect(page.locator('.json-node').first()).toBeVisible({ timeout: 10_000 })
})

test('request tabs: open, switch, dirty, close, persist across reload', async ({ page }) => {
  // Skip onboarding but let the first-run seed create the Examples folder
  // with its two saved requests.
  await page.addInitScript(() => {
    localStorage.setItem('mp2:onboarded', '1')
  })
  await page.goto('/options.html')

  const getUser = page.locator('.tree-row').filter({ hasText: /demo user|演示/i }).first()
  await expect(getUser).toBeVisible({ timeout: 15_000 })
  const echoPost = page.locator('.tree-row').filter({ hasText: /echo a post|回显/i }).first()
  await expect(echoPost).toBeVisible()

  // A single open request keeps the bar hidden; a pristine unsaved-draft
  // tab yields its slot instead of lingering.
  await getUser.click()
  await expect(page.locator('.request-tabbar')).toBeHidden()

  await echoPost.click()
  const bar = page.locator('.request-tabbar')
  await expect(bar).toBeVisible()
  await expect(bar.locator('.req-tab')).toHaveCount(2)

  // Switching tabs swaps the editor contents.
  const urlBar = page.locator('input[placeholder*="api.example.com"]').first()
  await expect(urlBar).toHaveValue(/postman-echo/)
  await bar.locator('.req-tab').first().click()
  await expect(urlBar).toHaveValue(/jsonplaceholder/)

  // Editing marks the active tab dirty.
  await urlBar.fill('https://jsonplaceholder.typicode.com/users/2')
  await expect(bar.locator('.req-tab.active .req-tab-dirty')).toBeVisible()

  // Open tabs (saved ids) survive a reload.
  await page.reload()
  const barAfterReload = page.locator('.request-tabbar')
  await expect(barAfterReload).toBeVisible()
  await expect(barAfterReload.locator('.req-tab')).toHaveCount(2)

  // Closing the active tab activates the neighbor; with one tab left the
  // bar hides again.
  await barAfterReload.locator('.req-tab.active .req-tab-close').click()
  await expect(page.locator('.request-tabbar')).toBeHidden()
})

test('body editor: CodeMirror editing, validity pill, pretty button', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mp2:onboarded', '1')
  })
  await page.goto('/options.html')

  // The seeded POST request has a raw JSON body, so the Body tab is
  // active on open and hosts the CodeMirror editor.
  const echoPost = page.locator('.tree-row').filter({ hasText: /echo a post|回显/i }).first()
  await expect(echoPost).toBeVisible({ timeout: 15_000 })
  await echoPost.click()

  const cm = page.locator('.raw-editor-cm .cm-content')
  await expect(cm).toBeVisible()
  await expect(page.locator('.raw-status-ok')).toContainText(/valid json|有效/i)

  // Typing invalid JSON flips the pill; removing it restores validity.
  await cm.click()
  await page.keyboard.type('{')
  await expect(page.locator('.raw-status-error')).toBeVisible()
  await page.keyboard.press('Backspace')
  await expect(page.locator('.raw-status-ok')).toBeVisible()

  // Pretty writes through the store and back into the editor doc.
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('{"a":1}')
  await page.getByRole('button', { name: /pretty|格式化/i }).first().click()
  await expect(cm).toContainText('"a": 1')
})

test('dark theme paints CodeMirror via CSS variables', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mp2:onboarded', '1')
    // Settings values are stored JSON-encoded.
    localStorage.setItem('mp2:theme', '"dark"')
  })
  await page.goto('/options.html')
  const echoPost = page.locator('.tree-row').filter({ hasText: /echo a post|回显/i }).first()
  await expect(echoPost).toBeVisible({ timeout: 15_000 })
  await echoPost.click()
  await expect(page.locator('.raw-editor-cm .cm-content')).toBeVisible()

  // Editor chrome reads the themed variables (--bg-subtle dark #161616).
  const gutters = page.locator('.raw-editor-cm .cm-gutters')
  await expect(gutters).toHaveCSS('background-color', 'rgb(22, 22, 22)')
  // Token colors come from --syntax-* (dark key #7ca9ff). CM6 highlight
  // spans use generated classes, so locate the seeded property by text.
  const token = page.locator('.raw-editor-cm .cm-line span').filter({ hasText: '"hello"' }).first()
  await expect(token).toHaveCSS('color', 'rgb(124, 169, 255)')
})

test('json autocompletion suggests prior keys', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mp2:onboarded', '1')
  })
  await page.goto('/options.html')
  const echoPost = page.locator('.tree-row').filter({ hasText: /echo a post|回显/i }).first()
  await expect(echoPost).toBeVisible({ timeout: 15_000 })
  await echoPost.click()
  const cm = page.locator('.raw-editor-cm .cm-content')
  await expect(cm).toBeVisible()

  await cm.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('{"alpha":1,"a')
  // Typing a new property name should surface the completion list with
  // the existing key.
  await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('alpha')
})
