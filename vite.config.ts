import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'

// Vite emits each entry HTML at dist/src/<name>/index.html because of
// the input's source-tree path. For MV3 we need them at the dist root
// (manifest.options_ui.page / side_panel.default_path both point to
// dist/options.html / dist/sidepanel.html). This plugin lifts both
// entries up two levels and rewrites the asset URLs accordingly.
function flattenEntryHtml(names: string[]): Plugin {
  return {
    name: 'flatten-entry-html',
    enforce: 'post',
    apply: 'build',
    closeBundle() {
      for (const name of names) {
        const srcPath = resolve(import.meta.dirname, `dist/src/${name}/index.html`)
        const destPath = resolve(import.meta.dirname, `dist/${name}.html`)
        if (!existsSync(srcPath)) continue
        let html = readFileSync(srcPath, 'utf-8')
        // Asset URLs come out as "../../assets/…" because the source HTML
        // lived at dist/src/<name>/. After moving to dist/, they need to
        // be plain "assets/…".
        html = html.replace(/(["'])\.\.\/\.\.\/assets\//g, '$1assets/')
        writeFileSync(destPath, html, 'utf-8')
      }
      try {
        // Once all named entries have been lifted out, drop the src/ tree.
        rmSync(resolve(import.meta.dirname, 'dist/src'), { recursive: true, force: true })
      } catch {
        // best-effort cleanup
      }
    }
  }
}

// Copy public/manifest.json (and anything else under public/) to dist/.
// Vite copies public/ automatically on dev, but not always on build —
// this plugin guarantees the manifest lands next to background.js.
function copyPublic(): Plugin {
  return {
    name: 'copy-public',
    apply: 'build',
    writeBundle() {
      const src = resolve(import.meta.dirname, 'public/manifest.json')
      const dst = resolve(import.meta.dirname, 'dist/manifest.json')
      if (existsSync(src)) {
        writeFileSync(dst, readFileSync(src, 'utf-8'), 'utf-8')
      }
    }
  }
}

export default defineConfig({
  // MV3 extension pages are loaded at chrome-extension://<ext-id>/<page>.html.
  // Any leading "/" in the generated <script src> resolves to the same
  // origin correctly in most cases, BUT some Chrome versions + extension
  // flags treat that as a request for the chrome-extension root path,
  // which then 404s on the manifest's CSP / script policy. Using a
  // relative base ("./") makes the assets load regardless.
  base: './',
  plugins: [vue(), flattenEntryHtml(['options', 'sidepanel', 'sandbox']), copyPublic()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Production builds ship to the Chrome Web Store — keep source maps off
    // so the shipped bundle does not leak original identifiers, comments,
    // or file structure. esbuild minify (Vite default) already shortens
    // local variable names and strips whitespace; that is the most CWS-
    // compliant protection available (obfuscation is prohibited).
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        background: resolve(import.meta.dirname, 'src/background/index.ts'),
        options: resolve(import.meta.dirname, 'src/options/index.html'),
        sidepanel: resolve(import.meta.dirname, 'src/sidepanel/index.html'),
        sandbox: resolve(import.meta.dirname, 'src/sandbox/index.html')
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Split vendor chunks so the user only pays the parse cost for
        // big libraries when they actually use them. The app entry
        // (Vue + Pinia + the small Antd core used in AppLayout) stays
        // in a single chunk; everything else is split per vendor.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@ant-design/icons-vue') || id.includes('icons-vue')) {
              return 'vendor-antd-icons'
            }
            if (id.includes('/@rc-component/') || id.includes('/rc-')) {
              return 'vendor-rc'
            }
            if (id.includes('ant-design-vue')) {
              return 'vendor-antd'
            }
            if (id.includes('vue') || id.includes('pinia')) {
              return 'vendor-vue'
            }
            if (id.includes('js-yaml')) {
              return 'vendor-yaml'
            }
            return 'vendor-misc'
          }
          // Our own modules — keep code-split by route-ish boundaries:
          //   - openapi / capture are big features only used on demand
          //   - everything else stays in the entry chunk
          if (id.includes('/core/openapi/') || id.includes('/core/curl')) {
            return 'feature-import-export'
          }
          if (id.includes('/core/capture') || id.includes('/background/capture')) {
            return 'feature-capture'
          }
        }
      }
    }
  }
})