// Synthesizes a same-origin SSE endpoint at ./demo-stream so the SSE tester
// page has an always-working sample — no network, no CORS, works offline.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.endsWith('/demo-stream')) return

  const encoder = new TextEncoder()
  let seq = 0
  let timer = null
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': built-in demo stream — generated locally by a service worker\n\n'))
      timer = setInterval(() => {
        seq += 1
        const payload = JSON.stringify({
          seq: seq,
          time: new Date().toISOString(),
          msg: 'event #' + seq + ' from the built-in demo stream'
        })
        try {
          controller.enqueue(encoder.encode('data: ' + payload + '\n\n'))
        } catch (e) { clearInterval(timer) }
        if (seq >= 300) { clearInterval(timer); controller.close() }
      }, 300)
    },
    cancel() { clearInterval(timer) }
  })

  event.respondWith(new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' }
  }))
})
