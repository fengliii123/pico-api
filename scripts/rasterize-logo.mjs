// Rasterize the master logo SVG to the four PNG sizes Chrome expects.
// Run with: node scripts/rasterize-logo.mjs
//
// Uses headless Chromium (already installed for e2e tests) as the SVG
// rasterizer. For each size, we set the SVG element's CSS dimensions to
// the target px value and screenshot it directly — Chromium's built-in
// SVG renderer produces clean anti-aliased output at any scale.

import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(here, '..', 'public', 'icons')
const svgPath = join(iconsDir, '128.png')

const sizes = [16, 32, 48, 128]
const svg = await readFile(svgPath, 'utf8')

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH
    || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
})
try {
  for (const size of sizes) {
    const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;background:transparent;}
      svg{display:block;width:${size}px;height:${size}px;}
    </style></head><body>${svg}</body></html>`
    await page.setContent(html)
    const svgHandle = await page.$('svg')
    const buf = await svgHandle.screenshot({ type: 'png', omitBackground: true })
    const out = join(iconsDir, `${size}.png`)
    await writeFile(out, buf)
    console.log(`wrote ${size}.png (${buf.length} bytes)`)
    await ctx.close()
  }
} finally {
  await browser.close()
}