// Ambient declarations for Chrome Extension APIs used by the service worker.
// vue-tsc / TypeScript doesn't see the runtime `chrome` global without this.

export {}

declare global {
  const chrome: {
    action: {
      onClicked: { addListener(cb: () => void): void }
    }
    runtime: {
      openOptionsPage(): void
    }
  }
}