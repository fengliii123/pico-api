// Strip the opaque white border from public/icons/128.png and return a base64
// PNG data URL with those pixels transparent.
//
// The source 128.png is 8-bit RGB (no alpha), and its rounded-corner
// transparent regions were flattened to white at export time. On dark banner
// backgrounds that reads as a white halo. We do the strip in-browser via
// Canvas because playwright is already a dependency and we want pixel-level
// control over the threshold. The source file is left untouched — this is a
// presentation-only transform for store assets.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const logoPath = join(here, '..', 'public', 'icons', '128.png')

// `browser` is the playwright chromium instance the caller already launched.
// Returns a base64 PNG data URL with the source logo's opaque white
// background removed by CLIPPING to the logo's rounded-square shape — not
// by colour-thresholding.
//
// Why shape-based and not colour-based: the source 128.png has a white
// ribbon-and-arrow inside the teal rounded square, and that ribbon is the
// same white/cream colour as the corner background. Any "white → alpha"
// ramp eats the ribbon along with the background, leaving what looks like
// a damaged logo. destination-in with a rounded-rect path keeps everything
// inside the logo outline (ribbon + teal gradient + AA pixels) and drops
// only the corner pixels to fully transparent. The browser anti-aliases
// the clip edge itself, so no jaggies.
//
// Corner radius 28px on a 128px canvas, measured from the source: the top
// row's first non-background pixel is at x=31, and the left edge reaches
// x=0 at y=28.
export async function processedLogoDataUri(browser) {
  const logoB64 = (await readFile(logoPath)).toString('base64')
  const srcUri = `data:image/png;base64,${logoB64}`
  const ctx = await browser.newContext({ viewport: { width: 128, height: 128 } })
  const page = await ctx.newPage()
  try {
    const dataUrl = await page.evaluate(async (src) => {
      const img = new Image()
      img.src = src
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
      const W = img.naturalWidth, H = img.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const cx = canvas.getContext('2d')
      cx.drawImage(img, 0, 0)
      // Clip the logo to a rounded square INSET 4px from each edge. The
      // source 128.png has a white ribbon that runs from the top edge to
      // the bottom edge of the icon, so the very top and bottom rows of
      // the logo are essentially white. On a dark banner that reads as a
      // bright halo along the logo's outline. Insetting the clip path by
      // 4px crops those rows out while keeping the ribbon intact inside
      // the logo. Corner radius shrinks 28 → 24 to match the smaller
      // square (so the visual corner proportion stays the same).
      const inset = 4
      const r = 24
      cx.beginPath()
      cx.moveTo(inset + r, inset)
      cx.arcTo(W - inset, inset, W - inset, inset + r, r)
      cx.arcTo(W - inset, H - inset, W - inset - r, H - inset, r)
      cx.arcTo(inset, H - inset, inset, H - inset - r, r)
      cx.arcTo(inset, inset, inset + r, inset, r)
      cx.closePath()
      cx.globalCompositeOperation = 'destination-in'
      cx.fillStyle = '#fff'
      cx.fill()
      cx.globalCompositeOperation = 'source-over'
      // Clean up clip-path edge anti-aliasing. destination-in produces
      // partial-alpha pixels along the rounded-rect boundary, and those
      // pixels retain their RGB from the source — which is the opaque
      // white corner background. When the SVG <image> later scales this
      // 128px PNG down to 96px (marquee) or 64px (promo), the browser's
      // bilinear filter mixes those white-ish partial-alpha pixels with
      // teal edge pixels, producing a visible light halo on the dark
      // banner. We zero out:
      //   - fully-transparent pixels (RGB blacked to stop white leaking
      //     through during scaling)
      //   - partial-alpha pixels whose RGB is white-ish (low saturation)
      //     — these are the white-background remnants on the clip edge
      // Partial-alpha teal edge pixels (high saturation) stay intact so
      // the logo outline keeps its own anti-aliasing. Fully-opaque white
      // pixels inside the logo (the ribbon) are untouched — alpha=255
      // means they're not edge pixels.
      const d = cx.getImageData(0, 0, W, H)
      const p = d.data
      for (let i = 0; i < p.length; i += 4) {
        const a = p[i + 3]
        if (a === 0) {
          p[i] = 0; p[i + 1] = 0; p[i + 2] = 0
        } else if (a < 255) {
          const mn = Math.min(p[i], p[i + 1], p[i + 2])
          const mx = Math.max(p[i], p[i + 1], p[i + 2])
          if (mx - mn <= 15) {
            p[i] = 0; p[i + 1] = 0; p[i + 2] = 0; p[i + 3] = 0
          }
        }
      }
      cx.putImageData(d, 0, 0)
      return canvas.toDataURL('image/png')
    }, srcUri)
    // DEBUG: dump processed PNG for inspection
    if (process.env.DEBUG_LOGO === '1') {
      const { writeFile } = await import('node:fs/promises')
      await writeFile('/tmp/debug-processed-logo.png', Buffer.from(dataUrl.split(',')[1], 'base64'))
    }
    return dataUrl
  } finally {
    await ctx.close()
  }
}