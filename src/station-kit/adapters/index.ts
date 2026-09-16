/**
 * Adapter-fabrik. EN plats där pilot↔drift avgörs (config.mode). Byter man
 * läge byts alla fyra adaptrar — spellogiken rörs aldrig.
 */

import { config } from '@/config'

import type { Transport } from './transport/Transport'
import { BroadcastChannelTransport } from './transport/BroadcastChannelTransport'
import { WebSocketTransport } from './transport/WebSocketTransport'

import type { Lights } from './lights/Lights'
import { ScreenLights } from './lights/ScreenLights'
import { MqttLights } from './lights/MqttLights'

import type { Identity } from './identity/Identity'
import { MockIdentity } from './identity/MockIdentity'
import { MqttIdentity } from './identity/MqttIdentity'

import type { ResultSink } from './result/ResultSink'
import { MockResultSink } from './result/MockResultSink'
import { MqttResultSink } from './result/MqttResultSink'

export interface Adapters {
  transport: Transport
  lights: Lights
  identity: Identity
  result: ResultSink
}

/**
 * Väljer transport (skärm↔skärm-synk):
 *  1. `?net=<wsUrl>&room=<rum>` i URL:en → uttrycklig WebSocket-relä.
 *  2. VITE_RELAY_PATH satt vid bygget (kombinerad Node-host) → samma-origin
 *     wss://<host><path> så olika enheter (dator/iPad) synkas över internet.
 *  3. Annars BroadcastChannel (samma-dator-pilot / GitHub Pages).
 */
function createTransport(): Transport {
  const room = `station${config.stationN}`
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const net = params.get('net')
    if (net) return new WebSocketTransport(net, params.get('room') ?? room)

    const relayPath = import.meta.env.VITE_RELAY_PATH as string | undefined
    if (relayPath) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return new WebSocketTransport(`${proto}//${window.location.host}${relayPath}`, room)
    }
  }
  if (config.mode === 'production') {
    return new WebSocketTransport(config.production.wsUrl, room)
  }
  return new BroadcastChannelTransport(`forhandlingen-station${config.stationN}`)
}

export function createAdapters(): Adapters {
  if (config.mode === 'production') {
    return {
      transport: createTransport(),
      lights: new MqttLights(config.stationN),
      identity: new MqttIdentity(config.stationN),
      result: new MqttResultSink(config.stationN),
    }
  }
  // Pilot (transport kan ändå vara WS för online-test via ?net=)
  return {
    transport: createTransport(),
    lights: new ScreenLights(),
    identity: new MockIdentity(),
    result: new MockResultSink(),
  }
}

export type { Transport, Lights, Identity, ResultSink }
export { ScreenLights }
