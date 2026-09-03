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
