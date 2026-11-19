/**
 * Rotationen — stationssidans tillståndsmaskin (Lager A, IDENTISK i alla X&Y-stationer).
 * Se types.ts för kontrakt/topics. Ett modul-globalt tillstånd per flik.
 *
 *   waiting ──station<N>/group──▶ group ──touch (begin)──▶ running
 *      ▲                            ▲                         │ appens tutorial → markSkarp() → skarp
 *      │ round 0                    │ ny group (ny runda)     │ finishSkarp(): publicera done
 *      └────────────────────────────┴──────── lek ◀───────────┘
 *
 * Koppla in i en station (små ingrepp, samma i alla appar):
 *   1. initRotation(rotationOptions({ stationN, enabled, mqttUrl })) en gång vid start.
 *   2. Lägg <RotationScreens /> i appens rot (fullskärms-overlay i waiting/group/lek).
 *   3. watch(state.phase): → 'running' = hoppa förbi appens attract; lämnar 'running' = appens reset.
 *   4. markSkarp() när appens skarpa läge börjar; finishSkarp() när resultatet visats klart
 *      (returnerar false när rotationen är av → appen gör som förut).
 *   5. result.send(tagResult(payload)) — märker station<N>/result med round + group.
 *
 * Två skärmar på samma station (t.ex. lag1/lag2-fönster): båda prenumererar på
 * station<N>/done, så den skärm som INTE tryckte klart går också till lek när
 * den andra skickat done för samma runda.
 *
 * DELAD station (options.side satt, st2): sidorna är två halvor med var sitt spel. Varje
 * sida skickar done {…, side} och går till lek själv; den andra sidans done ignoreras
 * (halva stationen kan vara lila medan andra halvan fortfarande är orange).
 */
import { computed, reactive, readonly } from 'vue'
import mqtt from 'mqtt'
import type {
  GroupMember,
  GroupMessage,
  RotationClient,
  RotationMode,
  RotationOptions,
  RotationPhase,
  SessionId,
} from './types'

/**
 * Startspärren (SOM.md "Incheckningen vid stationerna", Josef 2026-11-19): regi publicerar runda 1:s
 * grupp redan i incheckningen, så gruppen får SE hur de ska ställa sig — men ingen kan starta stationen
 * förrän trailern och instruktionsfilmen spelats. Faserna nedan (regi/phase .phase) spärrar starten;
 * rotation och senare/okända faser släpper. Aldrig fått regi/phase (pilot/dev) = ingen spärr.
 */
export const START_LOCK_PHASES: readonly string[] = ['idle', 'incheckning', 'trailer', 'intro']

const DEFAULT_ORDER = [1, 4, 3, 2] // medsols, ändrad 2026-11-18 (inga diagonala byten)

const state = reactive({
  phase: 'off' as RotationPhase,
  sessionId: null as SessionId | null,
  round: 0,
  group: null as number | null,
  members: [] as GroupMember[],
  /** Gruppen valdes för hand (fallback) i stället för via regi. */
  manual: false,
  /** Visa manuellt gruppval (inget gruppmeddelande i tid / ingen broker). */
  showManual: false,
  /** Ansluten till brokern. */
  connected: false,
  /** Senast publicerade läge på station<N>/mode. */
  mode: null as RotationMode | null,
  /** Gruppens klippset ur DB (station<N>/group set_id, 1-baserat) — null = stationens config. */
  setId: null as number | null,
  /** Rollen som presenteras kvinnlig i setet vid stationen (station<N>/group female_role). */
  femaleRole: null as 'A' | 'B' | null,
  /** Senaste regi/phase .phase (retained). null = aldrig fått någon (pilot, dev, ingen regi). */
  regiPhase: null as string | null,
})

/** Starten spärrad: regi står före rotationen (trailer/instruktion inte spelade). Se START_LOCK_PHASES. */
const startLocked = computed(
  () => state.phase !== 'off' && state.regiPhase != null && START_LOCK_PHASES.includes(state.regiPhase),
)

let opts: (Required<Omit<RotationOptions, 'side'>> & { side: 'A' | 'B' | null }) | null = null
let client: RotationClient | null = null
let manualTimer: ReturnType<typeof setTimeout> | null = null

const groupTopic = () => `station${opts!.stationN}/group`
const doneTopic = () => `station${opts!.stationN}/done`
const modeTopic = () => `station${opts!.stationN}/mode`
const doneStoreKey = () => `xy-rotation-done-station${opts!.stationN}${opts!.side ? `-${opts!.side}` : ''}`
const runKey = (sid: SessionId | null, round: number, group: number | null) =>
  `${sid ?? '-'}:${round}:${group ?? '-'}`

function readDone(): string | null {
  try {
    return localStorage.getItem(doneStoreKey())
  } catch {
    return null
  }
}
function writeDone(k: string): void {
  try {
    localStorage.setItem(doneStoreKey(), k)
  } catch {
    /* privat läge e.d. — omstart efter done visar då gruppen igen */
  }
}

function publish(topic: string, payload: object, retain = false): void {
  client?.publish(topic, JSON.stringify(payload), { retain })
}

function setMode(m: RotationMode): void {
  state.mode = m
  publish(modeTopic(), opts!.side ? { mode: m, side: opts!.side } : { mode: m }, true)
}

function clearManualTimer(): void {
  if (manualTimer) clearTimeout(manualTimer)
  manualTimer = null
}
function armManual(): void {
  clearManualTimer()
  if (!client) {
    state.showManual = true
    return
  }
  state.showManual = false
  manualTimer = setTimeout(() => {
    if (state.phase === 'waiting') state.showManual = true
  }, opts!.manualAfterMs)
}

function onGroup(m: GroupMessage): void {
  const round = Number(m.round) || 0
  const group = m.group == null ? null : Number(m.group)
  const members = Array.isArray(m.members) ? m.members : []
  state.setId = typeof m.set_id === 'number' && m.set_id > 0 ? m.set_id : null
  state.femaleRole = m.female_role === 'A' || m.female_role === 'B' ? m.female_role : null

  // Ingen aktiv rotation (regi idle/reset). En grupp som kör får köra klart.
  if (!round || group == null) {
    if (state.phase === 'running') return
    state.sessionId = null
    state.round = 0
    state.group = null
    state.members = []
    state.manual = false
    state.phase = 'waiting'
    armManual()
    return
  }

  const sid = m.session_id ?? null
  // Samma grupp/runda igen (retained vid återanslutning, eller regi bekräftar ett
  // manuellt val) → uppdatera bara uppgifterna, rör inte läget.
  if (state.round === round && state.group === group && (state.manual || state.sessionId === sid)) {
    state.sessionId = sid
    state.members = members
    state.manual = false
    return
  }

  clearManualTimer()
  state.sessionId = sid
  state.round = round
  state.group = group
  state.members = members
  state.manual = false
  state.showManual = false
  // Omstart efter att done redan skickats för denna runda → tillbaka i lek.
  state.phase = readDone() === runKey(sid, round, group) ? 'lek' : 'group'
}

/** done från stationens andra skärm (eller eko av vår egen) → gå till lek utan att publicera. */
function onDone(d: { session_id?: SessionId | null; round?: number; group?: number; side?: string }): void {
  if (state.phase !== 'running') return
  // Delad station: den andra sidans done gäller inte oss (done utan side = hela stationen).
  if (opts!.side && d.side != null && d.side !== opts!.side) return
  if (Number(d.round) !== state.round || Number(d.group) !== state.group) return
  if ((d.session_id ?? null) !== state.sessionId) return
  writeDone(runKey(state.sessionId, state.round, state.group))
  state.mode = 'lek'
  state.phase = 'lek'
}

function onMessage(topic: string, raw: string): void {
  let d: unknown
  try {
    d = JSON.parse(raw)
  } catch {
    return
  }
  if (!d || typeof d !== 'object') return
  if (topic === 'regi/phase') {
    const ph = (d as { phase?: unknown }).phase
    state.regiPhase = typeof ph === 'string' ? ph : null
  } else if (topic === groupTopic()) onGroup(d as GroupMessage)
  else if (topic === doneTopic()) onDone(d as { session_id?: SessionId; round?: number; group?: number; side?: string })
}

/* ------------------------------------------------------------------ */

/** Touch på gruppskärmen → appens eget flöde (tutorial) börjar. */
function begin(): void {
  if (state.phase !== 'group' || startLocked.value) return
  state.phase = 'running'
  setMode('tutorial')
}

/** Appens skarpa läge har börjat (orange). Idempotent. */
function markSkarp(): void {
  if (state.phase === 'running' && state.mode !== 'skarp') setMode('skarp')
}

/**
 * Skarpt läge slut och resultatet visat → publicera done, gå till lek.
 * Returnerar true om rotationen tog hand om slutet (appen ska då INTE göra sin
 * egen återstart), false om rotationen är av.
 */
function finishSkarp(): boolean {
  if (state.phase === 'off') return false
  if (state.phase !== 'running') return true
  const payload: { session_id?: SessionId; round: number; group: number | null; side?: 'A' | 'B' } = {
    round: state.round,
    group: state.group,
  }
  if (state.sessionId != null) payload.session_id = state.sessionId
  if (opts!.side) payload.side = opts!.side
  publish(doneTopic(), payload)
  writeDone(runKey(state.sessionId, state.round, state.group))
  state.phase = 'lek'
  setMode('lek')
  return true
}

/** Fallback: välj testgrupp för hand (regi tyst / ingen broker). Runda räknas ur stationsordningen. */
function pickManual(group: number): void {
  if (state.phase === 'off' || state.phase === 'running') return
  const order = opts!.order
  const n = order.length
  const pos = order.indexOf(opts!.stationN)
  // Grupp g står i runda r på position (g − 1 + r − 1) mod n  →  r = (pos − (g − 1)) mod n + 1
  const round = pos < 0 ? 1 : ((((pos - (group - 1)) % n) + n) % n) + 1
  clearManualTimer()
  state.round = round
  state.group = group
  state.members = []
  state.setId = null
  state.femaleRole = null
  state.manual = true
  state.showManual = false
  state.phase = 'group'
}

/** Märk station<N>/result med round + group (oförändrad när rotationen är av). */
export function tagResult<T extends object>(payload: T): T & { round?: number; group?: number } {
  if (state.phase === 'off' || state.group == null) return payload
  return { ...payload, round: state.round, group: state.group }
}

const api = {
  state: readonly(state),
  /** true = gruppen visas men får inte starta än (regi före rotationen). Entrén/Ankomst läser den. */
  startLocked,
  begin,
  markSkarp,
  finishSkarp,
  pickManual,
  tagResult,
}
export type Rotation = typeof api

/** Hämta rotationen (efter initRotation). */
export function useRotation(): Rotation {
  return api
}

/**
 * Starta rotationen. Idempotent (första anropet vinner). `injected` = egen
 * MQTT-klient (test); annars ansluter modulen själv till `mqttUrl`.
 */
export function initRotation(o: RotationOptions, injected?: RotationClient): Rotation {
  if (opts) return api
  opts = { order: DEFAULT_ORDER, manualAfterMs: 5000, ...o, side: o.side ?? null }
  if (!o.enabled) {
    state.phase = 'off'
    return api
  }
  if (injected) client = injected
  else if (o.mqttUrl) {
    client = mqtt.connect(o.mqttUrl, {
      reconnectPeriod: 2000,
      connectTimeout: 8000,
      clientId: `xy-rotation-st${o.stationN}-${Math.random().toString(16).slice(2, 8)}`,
    }) as unknown as RotationClient
  }
  state.phase = 'waiting'
  if (client) {
    client.on('connect', () => {
      state.connected = true
    })
    client.on('close', () => {
      state.connected = false
    })
    client.on('message', (topic, payload) => onMessage(topic, payload.toString()))
    client.subscribe(groupTopic())
    client.subscribe(doneTopic())
    client.subscribe('regi/phase')
  }
  armManual()
  return api
}

/**
 * Bygg RotationOptions med överstyrning utifrån (före appens default):
 *   ?rotation=1|0 och ?mqtt=ws://…  i URL:en (kiosk-URL:en på NUC:en)
 *   VITE_ROTATION=1|0 och VITE_MQTT_URL vid bygget (riggen: ws://192.168.10.10:9001)
 */
export function rotationOptions(defaults: RotationOptions): RotationOptions {
  const out: RotationOptions = { ...defaults }
  const env = import.meta.env as Record<string, string | undefined>
  if (env.VITE_ROTATION === '1' || env.VITE_ROTATION === '0') out.enabled = env.VITE_ROTATION === '1'
  if (env.VITE_MQTT_URL) out.mqttUrl = env.VITE_MQTT_URL
  if (typeof window !== 'undefined') {
    const p = new URLSearchParams(window.location.search)
    const r = p.get('rotation')
    if (r === '1' || r === '0') out.enabled = r === '1'
    const u = p.get('mqtt')
    if (u) out.mqttUrl = u
  }
  return out
}

/** Endast för test: nollställ modulens singleton. */
export function __resetRotationForTest(): void {
  clearManualTimer()
  opts = null
  client = null
  Object.assign(state, {
    phase: 'off',
    sessionId: null,
    round: 0,
    group: null,
    members: [],
    setId: null,
    femaleRole: null,
    regiPhase: null,
    manual: false,
    showManual: false,
    connected: false,
    mode: null,
  })
}
