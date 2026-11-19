/**
 * Resultatet ut i riggen: station<N>/result (IDENTISK i alla X&Y-stationsappar).
 * Design: xy-arkitektur/XY-RESULTAT-OCH-VINST.md §1.6. Söm: xy-rigg/SOM.md (`station<N>/result`).
 *
 * Varför en egen flagga: `config.mode` är 'pilot' i apparna (byter man till 'production' byts
 * transport, ljus OCH identitet). Resultatet ska ändå ut när stationen står i riggen. Därför
 * väljs resultat-sinken för sig:
 *   ?result=1|0 i kiosk-URL:en  ·  VITE_RESULT=1|0 vid bygget  ·  default = rotationen på/av
 * Broker = samma som rotationen (?mqtt= / VITE_MQTT_URL / appens ROTATION.mqttUrl). Ingen IP i koden.
 *
 * Regler:
 *  - Bara LEDAREN skickar (ett fönster per station, delad station: en per sida) → inga dubbletter.
 *  - `grupp` = testgruppens nummer när rotationen märkt resultatet (`group`), annars appens värde.
 *  - `done` skickas INTE här: rotationen äger station<N>/done (efter att resultatet visats).
 *  - Av → appens reserv-sink (pilot: konsolen), som förut.
 */
import mqtt from 'mqtt'
import type { ResultPayload, ResultSink } from '@/station-kit/adapters/result/ResultSink'

export interface ResultatOptions {
  stationN: number
  /** Publicera station<N>/result till brokern. */
  enabled: boolean
  /** Broker (WebSocket). Tom → inget publiceras. */
  mqttUrl: string
}

export interface ResultatClient {
  publish(topic: string, payload: string, opts?: { qos?: 0 | 1; retain?: boolean }): unknown
}

let opts: ResultatOptions | null = null
let client: ResultatClient | null = null

/** Kör en gång vid appstart. `injected` = testklient (annars mqtt.connect när det behövs). */
export function initResultat(o: ResultatOptions, injected?: ResultatClient): void {
  opts = o
  client = injected ?? null
}

function getClient(): ResultatClient | null {
  if (client) return client
  if (!opts?.enabled || !opts.mqttUrl) return null
  client = mqtt.connect(opts.mqttUrl, { reconnectPeriod: 2000, connectTimeout: 8000 }) as unknown as ResultatClient
  return client
}

/** Är resultat-publiceringen på? (för loggar/statusrader) */
export function resultatPa(): boolean {
  return !!opts?.enabled && !!opts.mqttUrl
}

/** Payloaden som faktiskt går ut: `grupp` följer rotationens testgrupp när den finns. */
export function resultatPayload<T extends ResultPayload>(p: T): T {
  return p.group != null ? { ...p, grupp: String(p.group) } : p
}

/**
 * Skicka rundans resultat. Returnerar true om det gick ut på brokern.
 *   ledare=false → ingenting (följarfönstret)
 *   av           → reserv (appens adapter-sink: konsolen i pilot)
 */
export function skickaResultat(p: ResultPayload, o: { ledare: boolean; reserv?: ResultSink | null }): boolean {
  if (!o.ledare) return false
  const ut = resultatPayload(p)
  const c = opts?.enabled ? getClient() : null
  if (!c || !opts) {
    o.reserv?.send(ut)
    return false
  }
  c.publish(`station${opts.stationN}/result`, JSON.stringify(ut), { qos: 1, retain: false })
  // eslint-disable-next-line no-console
  console.info(`[resultat] station${opts.stationN}/result`, ut)
  return true
}

/**
 * Bygg ResultatOptions med överstyrning utifrån (före appens default):
 *   ?result=1|0 och ?mqtt=ws://… i URL:en · VITE_RESULT=1|0 och VITE_MQTT_URL vid bygget
 */
export function resultatOptions(defaults: ResultatOptions): ResultatOptions {
  const out: ResultatOptions = { ...defaults }
  const env = import.meta.env as Record<string, string | undefined>
  if (env.VITE_RESULT === '1' || env.VITE_RESULT === '0') out.enabled = env.VITE_RESULT === '1'
  if (env.VITE_MQTT_URL) out.mqttUrl = env.VITE_MQTT_URL
  if (typeof window !== 'undefined') {
    const p = new URLSearchParams(window.location.search)
    const r = p.get('result')
    if (r === '1' || r === '0') out.enabled = r === '1'
    const u = p.get('mqtt')
    if (u) out.mqttUrl = u
  }
  return out
}

/** Endast för test. */
export function __resetResultatForTest(): void {
  opts = null
  client = null
}
