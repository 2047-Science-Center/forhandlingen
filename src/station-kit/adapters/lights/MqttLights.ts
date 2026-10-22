/**
 * Drift-ljus: publicerar på station<N>/lights via den delade MQTT-klienten.
 * Payloadformerna är frysta (§5.1); firmware översätter lucka→pixlar.
 *
 * Mockbart utan hårdvara (lyssna):
 *   mosquitto_sub -t station1/lights -v
 */

import type { Lights } from './Lights'
import type { HatchLight } from '@/stations/forhandlingen/engine/types'
import { getMqttClient } from '../mqtt/mqttClient'

/** Minsta publicerings-yta — så adaptrarna kan testas med en fejk-klient. */
export interface MqttPublisher {
  publish(topic: string, payload: string): void
}

export class MqttLights implements Lights {
  private topic: string
  private pub: MqttPublisher

  constructor(stationN: number, publisher?: MqttPublisher) {
    this.topic = `station${stationN}/lights`
    this.pub = publisher ?? getMqttClient()
  }

  set(lights: HatchLight[]): void {
    for (const l of lights) {
      this.pub.publish(
        this.topic,
        JSON.stringify({ hatch: l.hatch, state: l.state, winner: l.winner }),
      )
    }
  }

  reset(): void {
    this.pub.publish(this.topic, JSON.stringify({ state: 'reset' }))
  }
}
