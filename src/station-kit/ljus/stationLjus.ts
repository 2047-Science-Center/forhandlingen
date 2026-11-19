/**
 * Stationens ljus + feedbackljud (Lager A, IDENTISK i alla X&Y-stationsappar).
 * Ett modul-globalt tillstånd per flik (som station-kit/rotation).
 *
 *   station<N>/underglow  (retained)  basen: hela stationens segment, samma form som central/lights
 *   station<N>/feedback   (ej retained) en gest ovanpå basen: {segments:[{id,from,to,color,tempo,antal}]}
 *   regi/phase            (prenumeration) basen utanför rotationen följer regis fas
 *
 * Koppla in (små ingrepp, samma i alla appar):
 *   1. initLjus(ljusOptions({ stationN, enabled, mqttUrl, valv, segment, skrivare, spela })) vid start.
 *   2. Rotationens fas/läge → ljus.lage(lageFranRotation(phase, mode)); appens egna lägen → ljus.lage(…).
 *   3. Händelser → ljus.gest('ratt' | 'fel' | 'kvitto' | …, ['B']) — ljud + blink på rätt segment.
 *   4. Utfall → ljus.utfall('vinst' | 'forlust' | 'forlorarsida' | 'oavgjort', ids).
 *   5. <LjusRemsa /> i appens rot → förhandsvisning med ?ljus=visa (utan hårdvara).
 *
 * Bara EN skrivare per station publicerar basen (ledarfönstret); alla fönster får skicka
 * gester (ej retained, krockar inte). Delad station (st2): `delad: true` + `egna: ['A']` →
 * {ersatt:false} med bara egna segment, ompublicerat var 15:e s (retained håller bara senaste).
 */
import { reactive, readonly } from 'vue'
import mqtt from 'mqtt'
import { GEST, lageLook, regiLook, type Gest, type Lage, type LjudNamn, type Look, type Valv } from './kanon'

export interface LjusClient {
  publish(topic: string, payload: string, opts?: { retain?: boolean }): unknown
  subscribe(topic: string): unknown
  on(event: 'message', cb: (topic: string, payload: { toString(): string }) => void): unknown
  on(event: 'connect' | 'close', cb: () => void): unknown
}

export interface LjusOptions {
  /** Stationens nummer (topic-namespace station<N>/…). */
  stationN: number
  /** Publicera till MQTT. Av → bara ljud + ev. förhandsvisning. */
  enabled: boolean
  /** Broker (WebSocket). Tom → ingen MQTT. */
  mqttUrl: string
  /** Stationens valv (färg utanför rotationen). */
  valv: Valv
  /** Logiska segment → [from, to] (pixelindex, inklusivt). Pixlarna bor i appens config. */
  segment: Record<string, [number, number]>
  /** Segment det här fönstret äger (delad station). Default: alla. */
  egna?: string[]
  /** Delad station (två NUC:ar, en ESP32): {ersatt:false} + ompublicering. */
  delad?: boolean
  /** Publicerar det här fönstret basen? (ledarfönstret). Default true. Gester skickas ändå. */
  skrivare?: boolean
  /** Spela ett kanoniskt ljud (appens AudioEngine-mappning). */
  spela?: (ljud: LjudNamn) => void
  /** Förhandsvisning (LjusRemsa) — ?ljus=visa. */
  visa?: boolean
  /** Spärrtid per segment för gester av samma/lägre prio (ms). Default 1500. */
  sparrMs?: number
  /** Ompublicering av basen för delade stationer (ms). Default 15000. */
  republishMs?: number
}

interface FxState {
  color: string
  tempo: number
  antal: number
  prio: number
  t0: number
}

const state = reactive({
  enabled: false,
  visa: false,
  connected: false,
  /** Senaste regi/phase .phase. */
  regiFas: null as string | null,
  /** Läge per segment (null = följ regi/vila). */
  lage: {} as Record<string, Lage | null>,
  /** Uträknad bas per segment (det som ritas). */
  bas: {} as Record<string, Look>,
  /** Pågående gest per segment (för förhandsvisning + spärr). */
  fx: {} as Record<string, FxState>,
  /** Segmentens pixelintervall. */
  segment: {} as Record<string, [number, number]>,
  /** Senast publicerade bas (felsökning). */
  senast: '',
})

let opts: (Required<Omit<LjusOptions, 'spela'>> & { spela?: (l: LjudNamn) => void }) | null = null
let client: LjusClient | null = null
let republishTimer: ReturnType<typeof setInterval> | null = null

const underglowTopic = () => `station${opts!.stationN}/underglow`
const feedbackTopic = () => `station${opts!.stationN}/feedback`

function egna(): string[] {
  return opts!.egna.length ? opts!.egna : Object.keys(opts!.segment)
}

function lookFor(id: string): Look {
  const l = state.lage[id]
  if (l) return lageLook(l, id)
  return regiLook(state.regiFas, opts!.valv) ?? lageLook('vila', id)
}

function recompute(): void {
  for (const id of Object.keys(opts!.segment)) state.bas[id] = lookFor(id)
}

function publish(topic: string, payload: object, retain: boolean): void {
  if (!opts!.enabled) return
  client?.publish(topic, JSON.stringify(payload), { retain })
}

function publiceraBas(force = false): void {
  recompute()
  if (!opts!.skrivare) return
  const ids = opts!.delad ? egna() : Object.keys(opts!.segment)
  const segments = ids.map((id) => {
    const [from, to] = opts!.segment[id]
    return { id, from, to, ...state.bas[id] }
  })
  const lage = state.lage[ids[0]] ?? state.regiFas ?? 'vila'
  const body = opts!.delad ? { lage, ersatt: false, segments } : { lage, segments }
  const json = JSON.stringify(body)
  if (!force && json === state.senast) return
  state.senast = json
  publish(underglowTopic(), body, true)
}

/** Sätt läge (bas) på segment (default: egna). null = följ regi/vila. */
function lage(l: Lage | null, ids?: string[]): void {
  if (!opts) return
  for (const id of ids ?? egna()) if (id in opts!.segment) state.lage[id] = l
  publiceraBas()
}

/**
 * Spela en gest på segment (default: egna). Returnerar antalet segment som tog emot den.
 * `tyst` = inget ljud (appen spelar sitt eget stationsspecifika ljud).
 */
function gest(g: Gest, ids?: string[], o: { tyst?: boolean; sparrMs?: number } = {}): number {
  if (!opts) return 0
  const def = GEST[g]
  const now = Date.now()
  const sparr = o.sparrMs ?? opts.sparrMs
  const ok: string[] = []
  for (const id of ids ?? egna()) {
    if (!(id in opts.segment)) continue
    const cur = state.fx[id]
    if (cur && def.prio < 3) {
      const busy = now - cur.t0 < Math.max(cur.tempo * cur.antal, sparr)
      if (busy && def.prio <= cur.prio) continue
    }
    state.fx[id] = { color: def.color, tempo: def.tempo, antal: def.antal, prio: def.prio, t0: now }
    ok.push(id)
  }
  if (!ok.length) return 0
  if (def.bas) lage(def.bas, ok)
  publish(
    feedbackTopic(),
    {
      gest: g,
      segments: ok.map((id) => {
        const [from, to] = opts!.segment[id]
        return { id, from, to, color: def.color, tempo: def.tempo, antal: def.antal }
      }),
    },
    false,
  )
  if (!o.tyst) opts.spela?.(def.ljud)
  return ok.length
}

/** Utfall som HÅLLER under resultatrutan. Lag mot lag: vinnarsidan 'vinst', den andra 'forlorarsida'. */
function utfall(u: 'vinst' | 'forlust' | 'forlorarsida' | 'oavgjort', ids?: string[], o: { tyst?: boolean } = {}): void {
  if (u === 'vinst' || u === 'forlust') {
    gest(u, ids, o)
    return
  }
  lage(u, ids)
  if (!o.tyst) opts?.spela?.('neutral')
}

/** Tidsvarning: 0 = av (tillbaka till skarp), 1 = ≤15 s (andning), 2 = ≤5 s (blink). Bara i skarpt läge. */
function varning(niva: 0 | 1 | 2, ids?: string[]): void {
  if (!opts) return
  const target: Lage = niva === 2 ? 'sista' : niva === 1 ? 'varning' : 'skarp'
  const berorda = (ids ?? egna()).filter((id) => {
    const l = state.lage[id]
    return l === 'skarp' || l === 'varning' || l === 'sista'
  })
  if (berorda.length) lage(target, berorda)
}

/** Bara ljud (kanoniskt namn). */
function ljud(namn: LjudNamn): void {
  opts?.spela?.(namn)
}

function onMessage(topic: string, raw: string): void {
  if (!opts || topic !== 'regi/phase') return
  try {
    const d = JSON.parse(raw) as { phase?: string }
    state.regiFas = typeof d?.phase === 'string' ? d.phase : null
  } catch {
    return
  }
  publiceraBas()
}

const api = {
  state: readonly(state),
  lage,
  gest,
  utfall,
  varning,
  ljud,
}
export type StationLjus = typeof api

/** Hämta ljuset (efter initLjus). Säker att anropa före init: allt blir no-op. */
export function useLjus(): StationLjus {
  return api
}

/** Starta modulen. Idempotent (första anropet vinner). `injected` = egen MQTT-klient (test). */
export function initLjus(o: LjusOptions, injected?: LjusClient): StationLjus {
  if (opts) return api
  opts = {
    egna: [],
    delad: false,
    skrivare: true,
    visa: false,
    sparrMs: 1500,
    republishMs: 15000,
    ...o,
  }
  state.enabled = o.enabled
  state.visa = !!o.visa
  state.segment = { ...o.segment }
  for (const id of Object.keys(o.segment)) state.lage[id] = null
  recompute()
  if (!o.enabled) return api
  if (injected) client = injected
  else if (o.mqttUrl) {
    client = mqtt.connect(o.mqttUrl, {
      reconnectPeriod: 2000,
      connectTimeout: 8000,
      clientId: `xy-ljus-st${o.stationN}-${Math.random().toString(16).slice(2, 8)}`,
    }) as unknown as LjusClient
  }
  if (client) {
    client.on('connect', () => {
      state.connected = true
      publiceraBas(true)
    })
    client.on('close', () => {
      state.connected = false
    })
    client.on('message', (topic, payload) => onMessage(topic, payload.toString()))
    client.subscribe('regi/phase')
  }
  if (opts.delad && opts.skrivare) republishTimer = setInterval(() => publiceraBas(true), opts.republishMs)
  return api
}

/**
 * Bygg LjusOptions med överstyrning utifrån (före appens default):
 *   ?ljus=1|0|visa och ?mqtt=ws://…  i URL:en
 *   VITE_LJUS=1|0|visa och VITE_MQTT_URL vid bygget (riggen: ws://192.168.10.10:9001)
 */
export function ljusOptions(defaults: LjusOptions): LjusOptions {
  const out: LjusOptions = { ...defaults }
  const env = import.meta.env as Record<string, string | undefined>
  const apply = (v: string | null | undefined) => {
    if (v === '1' || v === '0') out.enabled = v === '1'
    if (v === 'visa') out.visa = true
  }
  apply(env.VITE_LJUS)
  if (env.VITE_MQTT_URL) out.mqttUrl = env.VITE_MQTT_URL
  if (typeof window !== 'undefined') {
    const p = new URLSearchParams(window.location.search)
    apply(p.get('ljus'))
    const u = p.get('mqtt')
    if (u) out.mqttUrl = u
  }
  return out
}

/** Endast för test: nollställ modulens singleton. */
export function __resetLjusForTest(): void {
  if (republishTimer) clearInterval(republishTimer)
  republishTimer = null
  opts = null
  client = null
  state.enabled = false
  state.visa = false
  state.connected = false
  state.regiFas = null
  state.lage = {}
  state.bas = {}
  state.fx = {}
  state.segment = {}
  state.senast = ''
}
