/**
 * Kombinerad server för online-drift: servar den byggda appen (dist/) OCH kör
 * WebSocket-reläet på samma origin (/ws). Då kan olika enheter (dator/iPad)
 * synkas över internet utan separat relähost — sidan hittar reläet själv via
 * `wss://<host>/ws` (byggt med VITE_RELAY_PATH=/ws).
 *
 * Kör lokalt:  npm run serve   (bygger + startar på PORT, default 8080)
 * Host (Render/Railway/Fly): startkommando `node server/server.mjs`, PORT sätts
 * av plattformen. Inga hemligheter här.
 */
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT ?? 8080)
const DIST = fileURLToPath(new URL('../dist', import.meta.url))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

async function serveFile(res, filePath) {
  const data = await readFile(filePath)
  res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' })
  res.end(data)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    // Hälsokoll (systemd/övervakning på NUC:en).
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('ok')
      return
    }
    // Skydda mot path traversal.
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
    let filePath = join(DIST, rel)
    if (!filePath.startsWith(DIST)) filePath = join(DIST, 'index.html')

    try {
      const s = await stat(filePath)
      if (s.isDirectory()) filePath = join(filePath, 'index.html')
      await serveFile(res, filePath)
    } catch {
      // SPA-fallback: allt okänt → index.html
      await serveFile(res, join(DIST, 'index.html'))
    }
  } catch {
    res.writeHead(500)
    res.end('server error')
  }
})

// --- WebSocket-relä på /ws (rum via ?room=) — samma "dumma" roll som relay.mjs ---
const wss = new WebSocketServer({ noServer: true })
const rooms = new Map()

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname !== '/ws') {
    socket.destroy()
    return
  }
  const room = url.searchParams.get('room') ?? 'default'
  wss.handleUpgrade(req, socket, head, (ws) => {
    if (!rooms.has(room)) rooms.set(room, new Set())
    const peers = rooms.get(room)
    peers.add(ws)
    ws.on('message', (data) => {
      const text = data.toString()
      for (const peer of peers) if (peer !== ws && peer.readyState === peer.OPEN) peer.send(text)
    })
    ws.on('close', () => {
      peers.delete(ws)
      if (peers.size === 0) rooms.delete(room)
    })
    ws.on('error', () => ws.close())
  })
})

server.listen(PORT, () => {
  console.log(`[server] app + relä på http://localhost:${PORT}  (ws: /ws?room=)`)
})
