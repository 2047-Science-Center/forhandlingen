/**
 * Drift-identitet: station<N>/rfid ut (rå UID), station<N>/identity in.
 * Kontrakt §5.2 / SOM.md. Identitetstjänsten (`xy-regi/identitet.py`) slår upp
 * band_id i `participants` och svarar med {band_id, name, group, gender, grupp,
 * medlemmar}. Vi mappar svaret till IdentityGroup som spellogiken vill ha.
 */

import type { Identity, IdentityGroup } from './Identity'
import { getMqttClient, type MqttClient } from '../mqtt/mqttClient'

const DEFAULT_TIMEOUT_MS = 8000

interface IdentityResponse {
  band_id: string
  name?: string
  group?: string
  grupp?: string
  gender?: string
  medlemmar?: { band_id: string; name?: string }[]
}

export class MqttIdentity implements Identity {
  private rfidTopic: string
  private identityTopic: string
  private client: MqttClient

  constructor(
    stationN: number,
    client?: MqttClient,
    private timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.rfidTopic = `station${stationN}/rfid`
    this.identityTopic = `station${stationN}/identity`
    this.client = client ?? getMqttClient()
  }

  tag(bandId: string): Promise<IdentityGroup> {
    return new Promise<IdentityGroup>((resolve, reject) => {
      let unsub = () => {}
      const timer = setTimeout(() => {
        unsub()
        reject(new Error(`identity timeout (${this.identityTopic}, band ${bandId})`))
      }, this.timeoutMs)

      unsub = this.client.subscribe(this.identityTopic, (payload) => {
        let r: IdentityResponse
        try {
          r = JSON.parse(payload)
        } catch {
          return
        }
        // Vänta på svaret som gäller just detta band (flera stationer delar broker).
        if (r.band_id !== bandId) return
        clearTimeout(timer)
        unsub()
        resolve({
          grupp: r.grupp ?? r.group ?? 'okänd',
          medlemmar: r.medlemmar ?? [{ band_id: r.band_id, name: r.name }],
        })
      })

      // Läsaren publicerar rå UID (VERSALER) — vi speglar det kontraktet.
      this.client.publish(this.rfidTopic, bandId)
    })
  }

  /** Lyssna på inkommande identiteter (hårdvaru-bipp via regi). */
  listen(cb: (group: IdentityGroup) => void): () => void {
    return this.client.subscribe(this.identityTopic, (payload) => {
      let r: IdentityResponse
      try {
        r = JSON.parse(payload)
      } catch {
        return
      }
      cb({
        grupp: r.grupp ?? r.group ?? 'okänd',
        medlemmar: r.medlemmar ?? [{ band_id: r.band_id, name: r.name }],
      })
    })
  }
}
