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
import { stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT ?? 8080)
const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const NUC_DIR = fileURLToPath(new URL('../deploy/nuc', import.meta.url))
const LOKAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

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
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
}

/**
 * Range-stöd (206) för video/ljud: Chromium spolar i klippen (rollklippens synk sätter currentTime vid start
 * och vid glidning) och behöver då byte-intervall. Utan det blev varje spolning en ny nedladdning från början
 * → klippen hackade och fastnade i början (Josef 2026-11-27). Filen strömmas, läses inte in i minnet.
 */
async function serveFile(req, res, filePath) {
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  const { size } = await stat(filePath)
  const fel = () => res.destroy()
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    if (start >= size || start > end) {
      res.writeHead(416, { 'content-range': `bytes */${size}` })
      res.end()
      return
    }
    res.writeHead(206, {
      'content-type': type,
      'accept-ranges': 'bytes',
      'content-range': `bytes ${start}-${end}/${size}`,
      'content-length': end - start + 1,
    })
    createReadStream(filePath, { start, end }).on('error', fel).pipe(res)
    return
  }
  res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size })
  createReadStream(filePath).on('error', fel).pipe(res)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    // Kiosk-avsluta (håll övre vänstra hörnet → AVSLUTA): stäng BÅDA fönstren med NUC:ens eget stopp
    // (deploy/nuc/_common.sh stop_kiosk). window.close() blockeras så fort fönstret har historik.
    // Bara från NUC:en själv — inte från nätet. Samma som Undersökningen (3f20348).
    if (url.pathname === '/api/kiosk/avsluta' && req.method === 'POST') {
      const ok = LOKAL.has(req.socket.remoteAddress)
      res.writeHead(ok ? 202 : 403)
      res.end()
      if (ok) {
        spawn('bash', ['-c', '. ./_common.sh && kiosk_init && stop_kiosk'], { cwd: NUC_DIR, detached: true, stdio: 'ignore' }).unref()
      }
      return
    }
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
      await serveFile(req, res, filePath)
    } catch {
      // SPA-fallback: allt okänt → index.html
      await serveFile(req, res, join(DIST, 'index.html'))
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
