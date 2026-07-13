// One-shot: rasterize store/marquee.svg → store/marquee-1400x560.png.
// Chrome Web Store requires EXACTLY 1400×560 (24-bit PNG, no alpha).
//
// Usage: node scripts/rasterize-marquee.mjs

import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const storeDir = join(here, '..', 'store')
const svgPath = join(storeDir, 'marquee.svg')
const outPath = join(storeDir, 'marquee-1400x560.png')

const W = 1400
const H = 560

const svg = await readFile(svgPath, 'utf8')

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH
    || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
})
try {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1
  })
  const page = await ctx.newPage()
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:#fff;}
    svg{display:block;width:${W}px;height:${H}px;}
  </style></head><body>${svg}</body></html>`
  await page.setContent(html)
  const handle = await page.$('svg')
  const buf = await handle.screenshot({ type: 'png', omitBackground: false })
  await writeFile(outPath, buf)
  console.log(`wrote ${outPath} (${buf.length} bytes, ${W}×${H})`)
  await ctx.close()
} finally {
  await browser.close()
}
