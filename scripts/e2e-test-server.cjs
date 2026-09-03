// Local endpoint fixture for the Playwright e2e smoke test.
// Deterministic, offline-safe targets: JSON GET (with a custom response
// header), POST echo, and an SSE stream. CORS is fully open (including
// exposed headers) because the dev/preview build sends via plain fetch.
const http = require('http')

const PORT = 8896

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*'
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }

  if (url.pathname === '/users/1' && req.method === 'GET') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'X-Trace-Id': 'e2e-123' })
    return res.end(JSON.stringify({ id: 1, name: 'Leanne Graham', tags: ['a', 'b'], profile: { active: true, score: 9.5 } }))
  }

  if (url.pathname === '/echo' && req.method === 'POST') {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ method: req.method, contentType: req.headers['content-type'] || '', received: body }))
    })
    return
  }

  if (url.pathname === '/sse') {
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    let n = 0
    const timer = setInterval(() => {
      n += 1
      res.write(`data: ${JSON.stringify({ seq: n })}\n\n`)
      if (n >= 10) { clearInterval(timer); res.end() }
    }, 200)
    req.on('close', () => clearInterval(timer))
    return
  }

  res.writeHead(404, { ...cors, 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found', path: url.pathname }))
})

server.listen(PORT, '127.0.0.1', () => console.log(`e2e fixture server on http://127.0.0.1:${PORT}`))
