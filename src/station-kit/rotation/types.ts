/**
 * Rotationen — stationssidan (Lager A, IDENTISK i alla X&Y-stationer).
 *
 * Kontrakt: xy-arkitektur/XY-ROTATION.md ("Stationssidans kontrakt").
 * Topics:   xy-rigg/SOM.md ("Parallell stationsrotation", spikad 2026-11-17).
 *
 *   station<N>/group  regi → station (retained)  {session_id, round, group, members:[{band_id,name,gender}]}
 *                     round 0 / group null = ingen aktiv rotation
 *   station<N>/done   station → regi             {session_id, round, group, side?}  (slutet av skarpt läge)
 *                     side = bara på DELADE stationer (st2: två sidor, två spel) — varje sida sitt done
 *   station<N>/mode   station → hälsovy (retained) {mode} ∈ tutorial | skarp | lek
 *   station<N>/result märks med round + group    (tagResult)
 *
 * Modulen beror INTE på appens @/config — allt kommer in via RotationOptions,
 * så filerna kan kopieras byte-identiskt mellan stationsrepona.
 */

/** En testgrupps medlem (ur incheckningen). */
export interface GroupMember {
  band_id: string
  name: string
  /** participants.gender ('man' | 'kvinna' | 'vill_ej_ange') — entréns sidindelning. */
  gender?: string | null
}

/** Regi skickar körningens id som tal (t.ex. 21826); sträng tillåts också. */
export type SessionId = string | number

/** Payload på station<N>/group (retained, från regi). */
export interface GroupMessage {
  session_id: SessionId | null
  round: number
  group: number | null
  members?: GroupMember[]
}

/**
 * Var stationen står i rotationen.
 *  off      — rotationen avstängd: appen kör som vanligt (pilot/demo).
 *  waiting  — ingen grupp ännu (regi idle / ingen broker) → manuellt val efter en stund.
 *  group    — "Testgrupp X — tryck för att börja" (visas av entrén, station-kit/entre).
 *  running  — appens egna tutorial → skarp körning.
 *  lek      — skarpt klart, done skickat, lila lek tills nästa grupp kommer.
 */
export type RotationPhase = 'off' | 'waiting' | 'group' | 'running' | 'lek'

/** Läget som publiceras på station<N>/mode. */
export type RotationMode = 'tutorial' | 'skarp' | 'lek'

/** Minimal MQTT-yta modulen behöver (mqtt.js-klienten uppfyller den; injicerbar i test). */
export interface RotationClient {
  publish(topic: string, payload: string, opts?: { retain?: boolean }): unknown
  subscribe(topic: string): unknown
  on(event: 'message', cb: (topic: string, payload: { toString(): string }) => void): unknown
  on(event: 'connect' | 'close', cb: () => void): unknown
}

export interface RotationOptions {
  /** Stationens nummer i riggen (topic-namespace station<N>/…). */
  stationN: number
  /** Rotationen på/av. Av → phase 'off' och appen beter sig som innan. */
  enabled: boolean
  /** Broker (WebSocket). Tom → ingen broker: bara manuellt gruppval, done skickas inte. */
  mqttUrl: string
  /** Medsols stationsordning (för manuellt val: runda räknas ur grupp). Default [1, 4, 2, 3]. */
  order?: number[]
  /** Visa manuellt gruppval om inget gruppmeddelande kommit inom så här lång tid. Default 5000. */
  manualAfterMs?: number
  /**
   * DELAD station (SOM.md 2026-11-18): den här skärmens sida = egen done-nyckel. Sidan går till
   * lek när DESS skarpa läge är slut, skickar done med `side`, och ignorerar andra sidans done.
   * Regi väntar in alla sidor (xy-regi config rotation.done_nycklar). null/utelämnad = hela stationen.
   */
  side?: 'A' | 'B' | null
}
