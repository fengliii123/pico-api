# Pico API — Privacy Policy

Public privacy policy for the **Pico API** Chrome extension. Hosted on
GitHub Pages so the Chrome Web Store listing can link to a stable URL.

**Live URL:** `https://<your-username>.github.io/<repo-name>/`
(replace with the actual URL after enabling Pages — see SETUP below)

## What's in this repo

```
index.html                          ← the privacy policy itself
README.md                           ← this file
.github/workflows/deploy-pages.yml  ← auto-deploys on push to main
```

That's it. No source code, no build step, no dependencies.

## SETUP (one-time, ~2 minutes)

1. **Create a new public repo on GitHub.** Name it whatever you want
   (e.g. `pico-api-privacy`). Do **not** initialize with a README — you'll
   push the one from this repo.

2. **Clone this directory into the new repo.** From inside this folder:
   ```bash
   cd privacy-repo
   git init
   git add .
   git commit -m "feat: initial privacy policy"
   git branch -M main
   git remote add origin git@github.com:<your-username>/<repo-name>.git
   git push -u origin main
   ```

3. **Enable GitHub Pages.** On GitHub:
   - Repo → Settings → Pages → "Build and deployment" → Source: **GitHub Actions**
   - The workflow in `.github/workflows/deploy-pages.yml` runs on every push.

4. **Trigger the first deploy.** Push any commit (or use the Actions tab →
   "Run workflow"). The deploy job prints the resulting URL.

5. **Paste the URL into the Chrome Web Store dashboard:**
   - https://chrome.google.com/webstore/devconsole/
   - Pico API listing → "Privacy Policy URL" field → paste.

## Updating the policy

Edit `index.html`, commit, push. GitHub Actions re-deploys automatically.
The deploy typically completes in 30–60 seconds.

If you also maintain a Markdown source (`PRIVACY.md`), edit both files —
GitHub Pages only serves the HTML.

## Why a separate repo?

The Pico API source code is private. The Chrome Web Store requires the
privacy policy to be at a public URL, but does not require the source
code to be public. A tiny dedicated repo keeps the policy reachable
without exposing anything else.