/**
 * Drift-resultat: publicerar station<N>/result och station<N>/done via den
 * delade MQTT-klienten. Payload = frysta kontraktet (§5.3, gruppform).
 * Ingest skriver en rad per person ur `personer[]`; regin stegar kedjan på /done.
 */

import type { ResultSink, ResultPayload } from './ResultSink'
import { getMqttClient, type MqttClient } from '../mqtt/mqttClient'
import type { MqttPublisher } from '../lights/MqttLights'

export class MqttResultSink implements ResultSink {
  private resultTopic: string
  private doneTopic: string
  private pub: MqttPublisher | MqttClient

  constructor(stationN: number, publisher?: MqttPublisher) {
    this.resultTopic = `station${stationN}/result`
    this.doneTopic = `station${stationN}/done`
    this.pub = publisher ?? getMqttClient()
  }

  send(payload: ResultPayload): void {
    this.pub.publish(this.resultTopic, JSON.stringify(payload))
    this.pub.publish(this.doneTopic, JSON.stringify({ grupp: payload.grupp }))
  }
}
