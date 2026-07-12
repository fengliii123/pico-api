# Pico API — Chrome Web Store Submission Materials

This directory holds everything you need to submit Pico API to the Chrome Web
Store. Each file maps to one or more fields on the developer dashboard.

## File map

| File | What it's for | Where to paste it |
|---|---|---|
| `PRIVACY.md` | Privacy policy source-of-truth (Markdown) | Hosted at the Pages URL — see "Hosting the privacy policy" below |
| `PERMISSIONS.md` | Justification for each permission | Paste each section into the matching permission field on the dashboard |
| `LISTING.md` | Store listing copy (name, summary, description, category, language, single purpose) | The main "Store listing" form |
| `SINGLE_PURPOSE.md` | Single-purpose statement (policy requirement) | "Single purpose" field, and as a reference if a reviewer asks |
| `VIDEO_SCRIPT.md` | 45-second demo video shooting script | Use to record the demo video that goes with the listing |
| `screenshots/` | 1280×800 screenshots (5 PNGs) | Drag into the "Screenshots" section of the listing |
| `promo-440x280.png` | Small promo tile | "Promotional images → Small tile 440×280" |
| `marquee-1400x560.png` | Marquee promo tile (optional, for featured placement) | "Promotional images → Marquee 1400×560" |
| `promo.svg` / `marquee.svg` | Source SVGs for the promo tiles | Edit then re-rasterize (see below) |
| `pico-api-1.0.0.zip` | The packaged extension itself | Upload via "Package" → "Upload new package" |

## Submission checklist

1. **Build the extension:**
   ```bash
   npm run build
   ```
   This produces `dist/`.

2. **Verify the package** (recommended sanity check):
   ```bash
   node scripts/verify-package.mjs
   ```
   Unzips the packaged extension into a temp dir, loads it into a real
   Chrome, opens the options page, and asserts that no page/console errors
   fire on mount.

3. **Take screenshots** (if not already in `screenshots/`):
   ```bash
   node scripts/capture-screenshots.mjs
   ```
   Writes 1280×800 PNGs into `store/screenshots/`. The script forces the
   English locale for store consistency and sends a live request to
   `api.github.com` to populate the response panel.

4. **Package as zip:**
   ```bash
   cd dist && zip -r ../store/pico-api-1.0.0.zip . && cd ..
   ```
   The zip must contain `manifest.json` at the root (not inside a parent
   folder).

5. **Host the privacy policy** — see section below.

6. **Upload via the developer dashboard:**
   - https://chrome.google.com/webstore/devconsole/
   - Pay the one-time $5 registration fee if you haven't.
   - Create new item → upload `pico-api-1.0.0.zip`.
   - Fill in store listing from `LISTING.md`.
   - Paste permission justifications from `PERMISSIONS.md`.
   - Paste privacy policy URL.
   - Upload screenshots, promo tile, marquee tile.
   - Submit for review.

## Hosting the privacy policy

The repo ships with a GitHub Actions workflow that auto-publishes
`docs/index.html` to GitHub Pages on every push to `main` that touches
`docs/`, `store/PRIVACY.md`, or the workflow itself.

**One-time setup:**
1. Push the repo to GitHub (if you haven't).
2. Repo → Settings → Pages → "Build and deployment" → Source: **GitHub Actions**.
3. Trigger the workflow by pushing a commit that touches `docs/`. The
   first run publishes the site.
4. Read the resulting URL from the workflow's deployment step. It will
   look like `https://<owner>.github.io/<repo>/`.
5. Paste that URL into the Chrome Web Store developer dashboard's
   "Privacy Policy URL" field.

When the policy changes, edit `docs/index.html` (or, if you prefer a
single source of truth, edit `store/PRIVACY.md` and mirror the change
into `docs/index.html`) and push. The site republishes automatically.

## Regenerating the promo tiles

After editing `store/promo.svg` or `store/marquee.svg`:
```bash
node scripts/rasterize-promo.mjs     # → store/promo-440x280.png
node scripts/rasterize-marquee.mjs   # → store/marquee-1400x560.png
```

Both scripts use Playwright's bundled Chromium for SVG rasterization,
producing retina-sharp PNGs.

## After approval

- Reviews typically take 1–3 business days; allow up to a week if the
  `debugger` permission triggers deeper review.
- If rejected, the dashboard shows the reviewer's note. Address it, bump the
  version in `package.json` + `public/manifest.json`, rebuild, repackage,
  re-upload.
- For subsequent updates: bump version, rebuild, repackage, upload as a new
  version of the existing item. No need to fill out the listing again.

## Tips

- **Don't strip the README from the repo.** It's not in `dist/`, so it
  doesn't affect the package, but keeping it accurate makes the GitHub link
  from the listing look professional.
- **Keep `store/` in the repo.** Future-you will need it for every version
  bump.
- **Don't commit `dist/`.** It's already in `.gitignore`. The zip in
  `store/pico-api-X.Y.Z.zip` is the canonical artifact for upload.
