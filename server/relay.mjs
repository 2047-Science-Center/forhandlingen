/**
 * Liten WebSocket-relä för online-test av Förhandlingen.
 *
 * Vidarebefordrar varje meddelande till ÖVRIGA klienter i samma rum. Ingen
 * spellogik här — samma "dumma" roll som webbläsarens BroadcastChannel, fast
 * över nätet. Klienter ansluter med `?room=<namn>` (t.ex. lag1/lag2 i samma rum).
 *
 * Kör:  node server/relay.mjs            (port 8787, eller PORT från miljön)
 * Klient: öppna appen med ?net=ws://<host>:8787&room=<rum>#lag1  (och …#lag2)
 *
 * Inga hemligheter här. För internet: kör bakom TLS (wss://) via en reverse
 * proxy, eller deploya på en tjänst som terminerar TLS.
 */

import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT ?? 8787)
const wss = new WebSocketServer({ port: PORT })

/** rum -> Set<WebSocket> */
const rooms = new Map()

function roomOf(req) {
  try {
    const url = new URL(req.url, 'http://localhost')
    return url.searchParams.get('room') ?? 'default'
  } catch {
    return 'default'
  }
}

wss.on('connection', (ws, req) => {
  const room = roomOf(req)
  if (!rooms.has(room)) rooms.set(room, new Set())
  const peers = rooms.get(room)
  peers.add(ws)
  console.log(`[relay] + klient i rum "${room}" (nu ${peers.size})`)

  ws.on('message', (data) => {
    const text = data.toString()
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === peer.OPEN) peer.send(text)
    }
  })

  ws.on('close', () => {
    peers.delete(ws)
    if (peers.size === 0) rooms.delete(room)
    console.log(`[relay] - klient i rum "${room}" (nu ${peers.size})`)
  })

  ws.on('error', () => ws.close())
})

console.log(`[relay] lyssnar på ws://localhost:${PORT}  (rum via ?room=)`)
