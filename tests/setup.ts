// Global test setup — runs before every spec file (see vitest.config.ts).
// Keep this minimal: add polyfills/mocks only when a test actually needs them.

// happy-dom lacks matchMedia, which Ant Design Vue components touch on mount.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
}

export {}
