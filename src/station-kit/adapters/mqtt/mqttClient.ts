/**
 * Delad MQTT-klient för driftläget (webbläsare → broker via WebSocket).
 *
 * En enda anslutning per flik, delas av MqttLights / MqttResultSink /
 * MqttIdentity. Webbläsare kan inte prata rå TCP-MQTT, så vi går över
 * WebSocket-lyssnaren (mosquitto `listener 9001 / protocol websockets`,
 * se xy-startkit/mosquitto.conf).
 *
 * URL väljs i ordning: config.production.mqttUrl → VITE_MQTT_URL → lokal default
 * `ws://127.0.0.1:9001`. Inga hemligheter här.
 */

import mqtt, { type MqttClient as PahoClient } from 'mqtt'
import { config } from '@/config'

export interface MqttClient {
  /** Publicera en payload (sträng) på en topic. Köas om anslutningen inte är uppe än. */
  publish(topic: string, payload: string): void
  /** Prenumerera; callback får (payload, topic). Returnerar en avprenumerant. */
  subscribe(topic: string, cb: (payload: string, topic: string) => void): () => void
}

function resolveUrl(): string {
  const fromConfig = config.production.mqttUrl
  const fromEnv = import.meta.env.VITE_MQTT_URL as string | undefined
  return fromConfig || fromEnv || 'ws://127.0.0.1:9001'
}

class BrowserMqttClient implements MqttClient {
  private client: PahoClient
  private subs = new Map<string, Set<(payload: string, topic: string) => void>>()

  constructor(url: string) {
    this.client = mqtt.connect(url, {
      reconnectPeriod: 2000,
      // Stabilt, läsbart klient-id per station (hjälper felsökning i broker-loggen).
      clientId: `xy-${location?.host ?? 'station'}-${config.stationN}-${Math.random()
        .toString(16)
        .slice(2, 8)}`,
    })
    this.client.on('message', (topic, payload) => {
      const text = payload.toString()
      for (const [filter, cbs] of this.subs) {
        if (topicMatches(filter, topic)) for (const cb of cbs) cb(text, topic)
      }
    })
    this.client.on('error', (e) => console.warn('[mqtt] fel', e?.message ?? e))
  }

  publish(topic: string, payload: string): void {
    this.client.publish(topic, payload)
  }

  subscribe(topic: string, cb: (payload: string, topic: string) => void): () => void {
    let set = this.subs.get(topic)
    if (!set) {
      set = new Set()
      this.subs.set(topic, set)
      this.client.subscribe(topic)
    }
    set.add(cb)
    return () => {
      set!.delete(cb)
      if (set!.size === 0) {
        this.subs.delete(topic)
        this.client.unsubscribe(topic)
      }
    }
  }
}

/** MQTT-topic-matchning för +/# (vi använder bara exakta topics men stödet är billigt). */
function topicMatches(filter: string, topic: string): boolean {
  if (filter === topic) return true
  const f = filter.split('/')
  const t = topic.split('/')
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true
    if (f[i] === '+') continue
    if (f[i] !== t[i]) return false
  }
  return f.length === t.length
}

let shared: MqttClient | null = null

/** Hämta (och vid behov skapa) den delade MQTT-klienten. */
export function getMqttClient(): MqttClient {
  if (!shared) shared = new BrowserMqttClient(resolveUrl())
  return shared
}
