// One-shot: rasterize store/marquee.svg → store/marquee-1400x560.png.
// Chrome Web Store requires EXACTLY 1400×560 (24-bit PNG, no alpha).
//
// Usage: node scripts/rasterize-marquee.mjs

import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { processedLogoDataUri } from './process-logo.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const storeDir = join(here, '..', 'store')
const svgPath = join(storeDir, 'marquee.svg')
const outPath = join(storeDir, 'marquee-1400x560.png')

const W = 1400
const H = 560

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH
    || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
})
try {
  // Strip the logo's white border in-browser, then inline as a data URI so
  // the SVG is self-contained when handed to setContent() (which has no base
  // URL for relative path resolution).
  const logoDataUri = await processedLogoDataUri(browser)
  let svg = await readFile(svgPath, 'utf8')
  svg = svg.replace('../public/icons/128.png', logoDataUri)

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