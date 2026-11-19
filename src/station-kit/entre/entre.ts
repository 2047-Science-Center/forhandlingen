/**
 * Entrén — tillståndsmaskin (Lager A, IDENTISK i alla X&Y-stationer). Ett modul-globalt
 * tillstånd per flik/skärm. Se types.ts för flödet och kontraktet.
 *
 *   attract ──start()──▶ ankomst ──arrived()──▶ rollval ──clipsDone()──▶ valet ──(alla röstat)──▶ vantar ─▶ utfall ──finish()──▶ klar
 *
 * Koppla in i en station (samma i alla appar):
 *   1. initEntre({ stationN, config, mqttUrl }) en gång vid start (efter initRotation).
 *   2. store.init() → attachTransport(appens transport) + setScreen({ side, leader }).
 *   3. <Entre> i appens rot medan state.step !== 'klar'; @start = sessionen börjar
 *      (ljud/musik), @done = gå vidare till appens tutorial. personer() = resultatet.
 *   4. reset() när appen återställs (idle/facilitator/ny grupp).
 *
 * Synk mellan stationens skärmar (samma NUC: BroadcastChannel; två NUC:ar: appens
 * WebSocket-relä) med semantiska meddelanden `entre:*`, märkta med körningens `run`
 * (session:runda:grupp) så gamla röster aldrig blandas in. Ledarskärmen lottar.
 */
import { computed, reactive, readonly, watch } from 'vue'
import mqtt from 'mqtt'
import { useRotation } from '../rotation/rotation'
import { normaliseraMedlemmar } from '../band/band'
import { normUid, place, seededRng, splitBySide, voteFromTopic } from './logic'
import type {
  EntreConfig,
  EntreMember,
  EntreMqttClient,
  EntreOptions,
  EntrePerson,
  EntreTransport,
  RoleLetter,
  SideId,
  VoteMode,
} from './types'

export type EntreStep = 'attract' | 'ankomst' | 'rollval' | 'valet' | 'vantar' | 'utfall' | 'klar'

interface Msg {
  kind: string
  payload: unknown
}

const state = reactive({
  step: 'attract' as EntreStep,
  voteMode: 'skarm' as VoteMode,
  /** Den här skärmens sida. null = delad vy (en skärm för hela gruppen, pilot). */
  screenSide: null as SideId | null,
  /** Ledarskärmen lottar och skickar ut resultatet. */
  leader: true,
  /** Körningens nyckel: session:runda:grupp (rotation) eller 'pilot'. */
  run: 'pilot',
  votes: {} as Record<string, RoleLetter>,
  result: null as EntrePerson[] | null,
  /** Skärm-läget: vems tur (index i myVoters) och om namnet eller frågan visas. */
  turn: 0,
  turnStage: 'namn' as 'namn' | 'fraga',
  /** Senaste bipp (rfid) — för kvittens på skärmen. */
  lastBeep: null as { band_id: string; at: number } | null,
  /** Okänt band bippat (inte i gruppen). */
  unknownBeep: null as { uid: string; at: number } | null,
  mqttConnected: false,
  /** Aktivt klippset för den här körningen. */
  clipSet: 0,
  /** Bandlöst läge (station-kit/band) — för facilitatorns statusrad. */
  bandlost: true,
})

let opts: EntreOptions | null = null
let transport: EntreTransport | null = null
let unsubTransport: (() => void) | null = null
let mqttClient: EntreMqttClient | null = null
let rngFactory: (run: string) => () => number = (run) => seededRng(`${run}|${Date.now()}|${Math.random()}`)

const cfg = (): EntreConfig => opts!.config
const rotation = useRotation()

/**
 * Gruppen: regi:s station<N>/group-medlemmar, annars pilot-rostern. Normaliserad (station-kit/band):
 * regi:s `halva` blir `startsida`, och namn saknas (klasslistan har inga) → plats-koden ur det virtuella bandet.
 */
const members = computed<EntreMember[]>(() => {
  const m = rotation.state.members as EntreMember[]
  return normaliseraMedlemmar(m && m.length ? m : (opts?.config.pilotRoster ?? []))
})

const runKey = computed(() => {
  const r = rotation.state
  if (r.phase === 'off' || r.group == null) return 'pilot'
  return `${r.sessionId ?? '-'}:${r.round}:${r.group}`
})

/** Startsidornas seed: session:grupp UTAN runda → samma halvor vid alla stationer (XY-PLATSER). */
const startKey = computed(() => {
  const r = rotation.state
  if (r.phase === 'off' || r.group == null) return 'pilot'
  return `${r.sessionId ?? '-'}:${r.group}`
})
/** Startsidorna (fasta halvor; medlemmens `startsida` går före). Deterministisk → alla skärmar får samma. */
const voteSides = computed(() => splitBySide(members.value, startKey.value))

/** De som röstar på DEN HÄR skärmen i skärm-läget. */
const myVoters = computed<EntreMember[]>(() =>
  state.screenSide == null ? members.value : members.value.filter((m) => voteSides.value[m.band_id] === state.screenSide),
)
const currentVoter = computed<EntreMember | null>(() => myVoters.value[state.turn] ?? null)
const votedCount = computed(() => members.value.filter((m) => state.votes[m.band_id]).length)
const allVoted = computed(() => members.value.length > 0 && votedCount.value >= members.value.length)

function send(kind: string, payload: object): void {
  transport?.send({ kind, payload })
}

function resetLocal(): void {
  state.step = 'attract'
  state.votes = {}
  state.result = null
  state.turn = 0
  state.turnStage = 'namn'
  state.lastBeep = null
  state.unknownBeep = null
}

function setResult(personer: EntrePerson[]): void {
  state.result = personer
  if (state.step === 'valet' || state.step === 'vantar') state.step = 'utfall'
}

function recordVote(bandId: string, role: RoleLetter, broadcast: boolean): void {
  if (state.result) return
  if (!members.value.some((m) => m.band_id === bandId)) return
  state.votes = { ...state.votes, [bandId]: role }
  if (broadcast) send('entre:vote', { run: state.run, band_id: bandId, role })
  tryResolve()
}

/** Ledaren: alla har valt → ombalansera, lotta, skicka ut. */
function tryResolve(): void {
  if (state.leader && !state.result && allVoted.value) resolve()
}

/** Lotta nu (även de som inte valt). Icke-ledare ber ledaren. */
function resolve(): void {
  if (state.result) return
  if (!state.leader) {
    send('entre:force', { run: state.run })
    return
  }
  const personer = place(members.value, state.votes, cfg(), voteSides.value, rngFactory(state.run))
  setResult(personer)
  send('entre:result', { run: state.run, personer })
}

function onTransport(msg: Msg): void {
  if (!msg || typeof msg.kind !== 'string' || !msg.kind.startsWith('entre:')) return
  const p = (msg.payload ?? {}) as Record<string, unknown>
  if (msg.kind === 'entre:mode') {
    if (p.mode === 'skarm' || p.mode === 'rfid') setVoteMode(p.mode, false)
    return
  }
  if (p.run !== state.run) return
  switch (msg.kind) {
    case 'entre:vote':
      if ((p.role === 'A' || p.role === 'B') && typeof p.band_id === 'string') recordVote(p.band_id, p.role, false)
      break
    case 'entre:result':
      if (Array.isArray(p.personer) && !state.result) setResult(p.personer as EntrePerson[])
      break
    case 'entre:force':
      if (state.leader) resolve()
      break
    case 'entre:hello':
      send('entre:sync', { run: state.run, votes: state.votes, result: state.result, mode: state.voteMode })
      break
    case 'entre:sync': {
      const v = (p.votes ?? {}) as Record<string, RoleLetter>
      for (const [b, r] of Object.entries(v)) if (!state.votes[b]) recordVote(b, r, false)
      if (Array.isArray(p.result) && !state.result) setResult(p.result as EntrePerson[])
      break
    }
  }
}

function onMqtt(topic: string, raw: string): void {
  if (!opts || state.voteMode !== 'rfid') return
  const role = voteFromTopic(opts.stationN, topic)
  if (!role) return
  const uid = normUid(raw)
  if (!uid) return
  const m = members.value.find((x) => normUid(x.band_id) === uid)
  if (!m) {
    state.unknownBeep = { uid, at: Date.now() }
    return
  }
  state.lastBeep = { band_id: m.band_id, at: Date.now() }
  // Senaste bippet gäller tills lottningen är gjord (man kan ändra sig).
  if (state.result) return
  state.votes = { ...state.votes, [m.band_id]: role }
  send('entre:vote', { run: state.run, band_id: m.band_id, role })
  tryResolve()
}

function ensureMqtt(): void {
  if (mqttClient || !opts?.mqttUrl) return
  const c = mqtt.connect(opts.mqttUrl, {
    reconnectPeriod: 2000,
    connectTimeout: 8000,
    clientId: `xy-entre-st${opts.stationN}-${Math.random().toString(16).slice(2, 8)}`,
  })
  c.on('connect', () => (state.mqttConnected = true))
  c.on('close', () => (state.mqttConnected = false))
  attachMqtt(c as unknown as EntreMqttClient)
}

/* ------------------------------------------------------------------ */

/**
 * Klippsetet för körningen. Regi:s set_id (DB, group_assignments) går före; stationens config
 * (fast index eller 'alternate') bara när regi inte skickat något (pilot, dev, ingen DB).
 */
function dbClipIndex(): number {
  const dbSet = rotation.state.setId
  if (dbSet == null) return -1
  const ids = cfg().clipSetIds ?? Array.from({ length: Math.max(1, cfg().clipSetCount ?? 2) }, (_, i) => i + 1)
  return ids.indexOf(dbSet)
}

function pickClipSet(): number {
  const i = dbClipIndex()
  if (i >= 0) return i
  const c = cfg().clipSet ?? 0
  if (c !== 'alternate') return c
  const n = Math.max(1, cfg().clipSetCount ?? 1)
  try {
    const key = 'xy-rollval-set'
    const i = (Number(localStorage.getItem(key) ?? '-1') + 1) % n
    localStorage.setItem(key, String(i))
    return i
  } catch {
    return 0
  }
}

/** Touch på attract → (rotationens begin) → ankomsten (startsidorna i 3D). */
function start(): void {
  if (state.step !== 'attract') return
  // Rotationen väntar på regi / står i lek → overlayen äger skärmen, ingen start.
  if (rotation.state.phase === 'waiting' || rotation.state.phase === 'lek') return
  if (rotation.state.phase === 'group') rotation.begin()
  state.clipSet = pickClipSet()
  state.step = 'ankomst'
}

/** Gruppen står på sina startsidor → rollval-klippen eller direkt valet. */
function arrived(): void {
  if (state.step !== 'ankomst') return
  state.step = cfg().clips === false ? 'valet' : 'rollval'
  if (state.step === 'valet') enterValet()
}

function enterValet(): void {
  state.turn = 0
  state.turnStage = 'namn'
  if (state.result) state.step = 'utfall'
  else if (state.voteMode === 'skarm' && myVoters.value.length === 0) state.step = 'vantar'
}

/** Rollvalets klipp klara (eller överhoppade) → valet. */
function clipsDone(): void {
  if (state.step !== 'rollval') return
  state.step = 'valet'
  enterValet()
}

/** Skärm-läget: jättenamnet visat → frågan. */
function showQuestion(): void {
  if (state.step === 'valet') state.turnStage = 'fraga'
}

/** Skärm-läget: den som står på tur trycker på en rollbild. */
function vote(role: RoleLetter): void {
  const m = currentVoter.value
  if (state.step !== 'valet' || state.voteMode !== 'skarm' || !m) return
  recordVote(m.band_id, role, true)
  if (state.result) return
  state.turn++
  state.turnStage = 'namn'
  if (state.turn >= myVoters.value.length) state.step = 'vantar'
}

/** Utfallet läst → appens eget flöde. */
function finish(): void {
  if (state.step === 'utfall') state.step = 'klar'
}

/** Facilitator: hoppa över valet (lotta alla som inte valt). */
function skipVote(): void {
  if (state.step === 'ankomst' || state.step === 'rollval' || state.step === 'valet' || state.step === 'vantar') {
    if (state.step === 'ankomst' || state.step === 'rollval') state.step = 'vantar'
    resolve()
  }
}

function setVoteMode(m: VoteMode, broadcast = true): void {
  if (state.voteMode === m) return
  state.voteMode = m
  if (m === 'rfid') ensureMqtt()
  if (state.step === 'valet') enterValet()
  if (broadcast) send('entre:mode', { mode: m })
}

/** Appen återställs (idle/facilitator/ny grupp) → tillbaka till attract, röster bort. */
function reset(): void {
  resetLocal()
}

function setScreen(s: { side: SideId | null; leader: boolean }): void {
  state.screenSide = s.side
  state.leader = s.leader
  tryResolve()
}

function attachTransport(t: EntreTransport | null | undefined): void {
  if (!t || t === transport) return
  unsubTransport?.()
  transport = t
  unsubTransport = t.subscribe((m) => onTransport(m as Msg))
  send('entre:hello', { run: state.run })
}

/** MQTT-klient för rfidja/rfidnej (injicerbar i test). */
function attachMqtt(c: EntreMqttClient): void {
  mqttClient = c
  c.on('message', (topic, payload) => onMqtt(topic, payload.toString()))
  c.subscribe(`station${opts!.stationN}/rfidja`)
  c.subscribe(`station${opts!.stationN}/rfidnej`)
}

/**
 * role_presented_as (station<N>/result): hur personens VALDA roll presenterades i setet som spelades —
 * 'kvinnlig' om rollen = regi:s female_role, annars 'manlig'. Lottad utan val → den tilldelade rollen.
 * Utan female_role (pilot, ingen DB) → null som förut. SOM.md "Klippset per grupp".
 */
function presentedAs(p: { chosen_role: RoleLetter | null; assigned_role: RoleLetter }): 'manlig' | 'kvinnlig' | null {
  const f = rotation.state.femaleRole
  // Bara när klippen som spelas ÄR DB-setet (annars vet vi inte vem som syntes).
  if (!f || dbClipIndex() < 0 || dbClipIndex() !== state.clipSet) return null
  return (p.chosen_role ?? p.assigned_role) === f ? 'kvinnlig' : 'manlig'
}

const api = {
  state: readonly(state),
  presentedAs,
  members,
  myVoters,
  currentVoter,
  voteSides,
  votedCount,
  allVoted,
  /** Resultatet till appen (tom tills lottningen är gjord). */
  personer: computed<EntrePerson[]>(() => state.result ?? []),
  start,
  arrived,
  clipsDone,
  showQuestion,
  vote,
  resolve,
  skipVote,
  finish,
  reset,
  setVoteMode,
  setScreen,
  attachTransport,
  attachMqtt,
  config: () => cfg(),
}
export type Entre = typeof api

export function useEntre(): Entre {
  return api
}

/** Röstläge: ?rost=rfid|skarm i URL:en (kiosk) går före stationens config. */
export function voteModeFromUrl(fallback: VoteMode): VoteMode {
  if (typeof window === 'undefined') return fallback
  const r = new URLSearchParams(window.location.search).get('rost')
  return r === 'rfid' || r === 'skarm' ? r : fallback
}

/** Starta entrén. Idempotent (första anropet vinner). */
export function initEntre(o: EntreOptions): Entre {
  if (opts) return api
  opts = o
  state.bandlost = o.bandlost ?? (o.config.voteMode ?? 'skarm') === 'skarm'
  const grund: VoteMode = o.bandlost == null ? (o.config.voteMode ?? 'skarm') : o.bandlost ? 'skarm' : 'rfid'
  state.voteMode = voteModeFromUrl(grund)
  state.run = runKey.value
  if (state.voteMode === 'rfid') ensureMqtt()
  // Ny grupp/runda → ny körning: rensa röster och börja om på attract.
  watch(runKey, (k) => {
    if (k === state.run) return
    state.run = k
    resetLocal()
    send('entre:hello', { run: k })
  })
  return api
}

/** Endast för test: nollställ modulens singleton (och styr lottningens slump). */
export function __resetEntreForTest(rng?: (run: string) => () => number): void {
  unsubTransport?.()
  opts = null
  transport = null
  unsubTransport = null
  mqttClient = null
  if (rng) rngFactory = rng
  resetLocal()
  Object.assign(state, { voteMode: 'skarm', screenSide: null, leader: true, run: 'pilot', mqttConnected: false, bandlost: true })
}
