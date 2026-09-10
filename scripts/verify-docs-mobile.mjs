// Verify docs landing pages render correctly after CTA/mobile edits.
// Standalone playwright script (the MCP browser routes through a proxy that
// cannot reach localhost). Serves docs/ and checks mobile + desktop.
import { chromium } from 'playwright'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.resolve(__dirname, '..', 'docs')
const PORT = 4401
const CWS = 'https://chromewebstore.google.com/detail/nckjedkhineddehjkdlgaibfgpacmhcl'

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' }

const server = http.createServer((req, res) => {
  const file = path.join(DOCS, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]))
  try {
    const data = fs.readFileSync(file)
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404).end('not found')
  }
})

const pages = [
  { url: 'curl-converter.html', checks: ['Install Pico API — Free', '(free, no account)'] },
  { url: 'sse-tester.html', checks: ['Install Pico API — Free', 'Test real endpoints — Install Free'] },
  { url: 'how-to-test-rest-api-in-chrome.html', checks: ['Install Pico API from the Chrome Web Store'] },
  { url: 'index.html', checks: [] },
  { url: 'postman-alternative.html', checks: [] },
  { url: 'postman-alternative.zh-CN.html', checks: [] },
]

await new Promise((r) => server.listen(PORT, r))
const browser = await chromium.launch()
let failures = 0

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  const page = await browser.newPage({ viewport })
  for (const p of pages) {
    const label = `${p.url} @${viewport.width}`
    try {
      await page.goto(`http://127.0.0.1:${PORT}/${p.url}`, { waitUntil: 'load' })
      const body = await page.textContent('body')
      for (const c of p.checks) {
        if (!body.includes(c)) { console.log(`FAIL text [${label}]: missing "${c}"`); failures++ }
      }
      // nav must not overflow horizontally on mobile
      if (viewport.width === 390) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        if (overflow > 2) { console.log(`FAIL nav [${label}]: horizontal overflow ${overflow}px`); failures++ }
      }
      // CWS links on the page must use the canonical detail URL
      const badLinks = await page.$$eval('a', (as, cws) => as.filter(a => a.href.includes('chromewebstore') && a.href !== cws && !a.href.startsWith(cws + '?')).map(a => a.href), CWS)
      if (badLinks.length) { console.log(`FAIL link [${label}]: non-canonical CWS links: ${badLinks.join(', ')}`); failures++ }
    } catch (e) {
      console.log(`FAIL load [${label}]: ${e.message}`)
      failures++
    }
  }
  if (viewport.width === 390) {
    const page2 = await browser.newPage({ viewport })
    await page2.goto(`http://127.0.0.1:${PORT}/sse-tester.html`)
    await page2.screenshot({ path: path.join(DOCS, '..', '.playwright-mcp', 'verify-sse-mobile.png'), fullPage: false })
    await page2.close()
  }
}

await browser.close()
server.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} failures`)
process.exit(failures === 0 ? 0 : 1)
