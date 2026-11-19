/**
 * Incheckningen vid stationen (Lager A, IDENTISK i alla X&Y-stationer). SOM.md "Incheckningen vid
 * stationerna" (2026-11-19). Design: xy-arkitektur/XY-BANDLOST-OCH-ANKOMST.md §2.6.
 *
 * Medan regi står i fasen `incheckning` visar stationen gruppen som BÖRJAR här (runda 1):
 *   "TA DITT BAND" + namnen per sida → knappen "Alla har sina band på sig"
 *   → station<N>/incheckad {session_id, group, side?} (retained) → "Vänta på de andra grupperna · 3 av 4"
 * Regi går till trailern när alla stationer kvitterat (delad station räknas en gång).
 *
 *   in:  regi/phase (retained)        fasen + session_id
 *        station<N>/group (retained)  gruppen + medlemmar (regi publicerar runda 1 redan i incheckningen)
 *        +/incheckad (station<N>/…)  alla stationers kvittens (för "3 av 4" och den andra sidan på delade stationer)
 *        station<N>/rfid              BARA med band (bandlost=false): bocka av namnen när de bippas
 *   ut:  station<N>/incheckad
 *
 * Fristående: beror bara på vue, mqtt, ../band och ../entre/logic (samma sidindelning som entrén),
 * inte på rotationen eller appens @/config — kan kopieras byte-identiskt till alla fyra stationerna.
 */
import { computed, reactive, readonly } from 'vue'
import mqtt from 'mqtt'
import { normaliseraMedlemmar } from '../band/band'
import { normUid, splitBySide } from '../entre/logic'
import type { EntreMember, SideId } from '../entre/types'

export interface IncheckningOptions {
  stationN: number
  /** På/av (följer driften som filmerna). Av → visas aldrig. */
  enabled: boolean
  /** Broker (WebSocket). Tom → av. */
  mqttUrl: string
  /** Delad station: den här skärmens sida (bara för loggen i kvittensen). */
  side?: SideId | null
  /** Bandlöst läge (station-kit/band). false → lyssna på station<N>/rfid och bocka av namnen. */
  bandlost?: boolean
  /** Med band: knappen låst tills alla i gruppen bippat. Default false (facilitatorn avgör). */
  kravBipp?: boolean
  /** Antal stationer i riggen (för "3 av 4"). Default 4. */
  antalStationer?: number
}

/** Minimal MQTT-yta (mqtt.js uppfyller den; injicerbar i test). */
export interface IncheckningClient {
  publish(topic: string, payload: string, opts?: { retain?: boolean }): unknown
  subscribe(topic: string): unknown
  on(event: 'message', cb: (topic: string, payload: { toString(): string }) => void): unknown
  on(event: 'connect' | 'close', cb: () => void): unknown
}

type Kvittens = { session_id: unknown; group: unknown; side?: unknown }

const state = reactive({
  /** regi står i fasen incheckning. */
  aktiv: false,
  sessionId: null as unknown,
  /** Gruppen som börjar här (station<N>/group). */
  group: null as number | null,
  groupSession: null as unknown,
  members: [] as EntreMember[],
  /** Alla stationers senaste kvittens (rå, filtreras mot sessionen). */
  kvittenser: {} as Record<number, Kvittens>,
  /** Band som bippats vid stationen (bara med band). */
  bippade: {} as Record<string, true>,
  connected: false,
})

let opts: Required<Omit<IncheckningOptions, 'side'>> & { side: SideId | null } = {
  stationN: 0,
  enabled: false,
  mqttUrl: '',
  side: null,
  bandlost: true,
  kravBipp: false,
  antalStationer: 4,
}
let client: IncheckningClient | null = null

const sammaSession = (k: Kvittens | undefined) =>
  !!k && (state.sessionId == null || k.session_id == null || k.session_id === state.sessionId)

const visible = computed(() => opts.enabled && state.aktiv)
const kvitterad = computed(() => sammaSession(state.kvittenser[opts.stationN]))
const klaraStationer = computed(() =>
  Object.entries(state.kvittenser)
    .filter(([, k]) => sammaSession(k))
    .map(([st]) => Number(st))
    .sort((a, b) => a - b),
)
/** Startsidorna, samma seed som entrén (session:grupp) → samma halvor som "Ställ er på rätt sida". */
const sidor = computed<Record<string, SideId>>(() =>
  splitBySide(state.members, `${(state.groupSession as string | number | null) ?? '-'}:${state.group}`),
)
const namnPaSida = (side: SideId) => state.members.filter((m) => sidor.value[m.band_id] === side)
const allaBippat = computed(() => state.members.length > 0 && state.members.every((m) => state.bippade[m.band_id]))
const kanKvittera = computed(() => !kvitterad.value && (!opts.kravBipp || opts.bandlost || allaBippat.value))

function parse(raw: string): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw)
    return d && typeof d === 'object' ? (d as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function onMessage(topic: string, raw: string): void {
  const N = opts.stationN
  if (topic === 'regi/phase') {
    const d = parse(raw)
    const sid = d?.session_id ?? null
    if (sid !== state.sessionId) state.bippade = {}
    state.sessionId = sid
    state.aktiv = d?.phase === 'incheckning'
    return
  }
  if (topic === `station${N}/group`) {
    const d = parse(raw)
    const g = d && typeof d.group === 'number' ? d.group : null
    state.group = g
    state.groupSession = d?.session_id ?? null
    state.members = g == null ? [] : normaliseraMedlemmar((d?.members as EntreMember[]) ?? [])
    return
  }
  const m = /^station(\d+)\/incheckad$/.exec(topic)
  if (m) {
    const st = Number(m[1])
    const d = parse(raw)
    const next = { ...state.kvittenser }
    if (d) next[st] = d as Kvittens
    else delete next[st]
    state.kvittenser = next
    return
  }
  if (topic === `station${N}/rfid` && !opts.bandlost) {
    const uid = normUid(raw)
    const hit = state.members.find((x) => normUid(x.band_id) === uid)
    if (hit) state.bippade = { ...state.bippade, [hit.band_id]: true }
  }
}

/** Knappen "Alla har sina band på sig". */
function kvittera(): void {
  if (!kanKvittera.value) return
  const payload: Kvittens = { session_id: state.sessionId, group: state.group }
  if (opts.side) payload.side = opts.side
  state.kvittenser = { ...state.kvittenser, [opts.stationN]: payload }
  client?.publish(`station${opts.stationN}/incheckad`, JSON.stringify(payload), { retain: true })
}

function attach(c: IncheckningClient): void {
  client = c
  c.on('message', (t, p) => onMessage(t, p.toString()))
  c.on('connect', () => {
    state.connected = true
    for (const t of ['regi/phase', `station${opts.stationN}/group`, '+/incheckad']) c.subscribe(t)
    if (!opts.bandlost) c.subscribe(`station${opts.stationN}/rfid`)
  })
  c.on('close', () => (state.connected = false))
}

const api = {
  state: readonly(state),
  visible,
  kvitterad,
  klaraStationer,
  kanKvittera,
  allaBippat,
  namnPaSida,
  kvittera,
  options: () => opts,
}
export type Incheckning = typeof api

export function useIncheckning(): Incheckning {
  return api
}

/** Starta (idempotent). `injected` = test-klient (ingen riktig anslutning). */
export function initIncheckning(o: IncheckningOptions, injected?: IncheckningClient): Incheckning {
  if (client) return api
  opts = { ...opts, ...o, side: o.side ?? null, bandlost: o.bandlost ?? true, kravBipp: o.kravBipp ?? false }
  if (!opts.enabled) return api
  if (injected) {
    attach(injected)
    return api
  }
  if (!opts.mqttUrl) return api
  const c = mqtt.connect(opts.mqttUrl, {
    reconnectPeriod: 2000,
    connectTimeout: 8000,
    clientId: `xy-incheckning-st${opts.stationN}-${Math.random().toString(16).slice(2, 8)}`,
  })
  attach(c as unknown as IncheckningClient)
  return api
}

/**
 * Påslag som filmerna: stationens default (drift) → VITE_INCHECKNING=1|0 / VITE_MQTT_URL vid bygget
 * → ?incheckning=1|0 / ?mqtt=ws://… i kiosk-URL:en.
 */
export function incheckningOptions(defaults: IncheckningOptions): IncheckningOptions {
  const out: IncheckningOptions = { ...defaults }
  const env = import.meta.env as Record<string, string | undefined>
  if (env.VITE_INCHECKNING === '1' || env.VITE_INCHECKNING === '0') out.enabled = env.VITE_INCHECKNING === '1'
  if (env.VITE_MQTT_URL) out.mqttUrl = env.VITE_MQTT_URL
  if (typeof window !== 'undefined') {
    const p = new URLSearchParams(window.location.search)
    const f = p.get('incheckning')
    if (f === '1' || f === '0') out.enabled = f === '1'
    const m = p.get('mqtt')
    if (m) out.mqttUrl = m
  }
  return out
}

/** Endast för test. */
export function __resetIncheckningForTest(): void {
  client = null
  opts = { stationN: 0, enabled: false, mqttUrl: '', side: null, bandlost: true, kravBipp: false, antalStationer: 4 }
  Object.assign(state, {
    aktiv: false,
    sessionId: null,
    group: null,
    groupSession: null,
    members: [],
    kvittenser: {},
    bippade: {},
    connected: false,
  })
}
