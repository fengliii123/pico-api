import { defineConfig } from '@playwright/test'

// E2E smoke: builds the app, serves dist/ via vite preview, and runs the
// tests in tests/e2e/ against it. A local fixture server (scripts/e2e-
// test-server.cjs) provides deterministic request targets.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173'
  },
  webServer: [
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: true,
      timeout: 300_000
    },
    {
      command: 'node scripts/e2e-test-server.cjs',
      port: 8896,
      reuseExistingServer: true,
      timeout: 30_000
    }
  ]
})
