/**
 * Stationens ljus + feedbackljud (Lager A, IDENTISK i alla X&Y-stationsappar).
 * Ett modul-globalt tillstånd per flik (som station-kit/rotation).
 *
 *   station<N>/underglow  (retained)  basen: hela stationens segment, samma form som central/lights
 *   station<N>/underglow/<sida> (retained) delad station: bara den här sidans segment (SOM.md
 *                         "Delad station: en topic per sida"); firmwaren slår ihop A + B per id
 *   station<N>/feedback   (ej retained) en gest ovanpå basen: {segments:[{id,from,to,color,tempo,antal}]}
 *   regi/phase            (prenumeration) basen utanför rotationen följer regis fas
 *   station<N>/hitta      (prenumeration) domslutet syns inte härifrån: HELA vagnen lyser i
 *                         målvalvets färg i `sekunder` + skärmen visar "Leta upp valvet med den
 *                         här färgen" (SOM.md "Domslut per person"; LjusRemsa ritar rutan)
 *   film/start|stop, reveal/film/start|stop, regi/round (prenumeration) — UNDERGLOW-SPÅREN
 *                         (XY-UNDERGLOW-MANUS, SOM.md "Underglow-spåren"): vagnen följer trailern,
 *                         instruktionsfilmen, reveal-filmen, bron, capstone och bytet med ett eget spår
 *                         ur regi-HTTP (`/film/<spår>/underglow.json`, klockan = regi `GET /time`).
 *                         Ingen ny topic; centralen tänder aldrig underglow (regel 2).
 *   idle/attract          attract-vågen: en blink i egen valvfärg var 20:e s, medsols runt rummet.
 *
 * Koppla in (små ingrepp, samma i alla appar):
 *   1. initLjus(ljusOptions({ stationN, enabled, mqttUrl, valv, segment, skrivare, spela })) vid start.
 *   2. Rotationens fas/läge → ljus.lage(lageFranRotation(phase, mode)); appens egna lägen → ljus.lage(…).
 *   3. Händelser → ljus.gest('ratt' | 'fel' | 'kvitto' | …, ['B']) — ljud + blink på rätt segment.
 *      Egen färg på ett segment (ovanpå läget) → ljus.farg({color, effekt}, ['A.lur2']); null släpper.
 *   4. Utfall → ljus.utfall('vinst' | 'forlust' | 'forlorarsida' | 'oavgjort', ids).
 *   5. <LjusRemsa /> i appens rot → förhandsvisning med ?ljus=visa (utan hårdvara).
 *
 * Bara EN skrivare per station publicerar basen (ledarfönstret); alla fönster får skicka
 * gester (ej retained, krockar inte). Delad station (st2): `sida: 'A'` + `egna: ['A', …]` → bara
 * egna segment på station<N>/underglow/A (retained, ingen ompublicering; aldrig på station<N>/underglow).
 */
import { reactive, readonly } from 'vue'
import mqtt from 'mqtt'
import {
  FARG,
  GANGORDNING,
  GEST,
  lageLook,
  regiLook,
  REGI_FORE,
  VALVFARG,
  VALVORDNING,
  type Gest,
  type Lage,
  type LjudNamn,
  type Look,
  type Valv,
} from './kanon'
import {
  arBasRad,
  chaseValv,
  kompilera,
  lasSpar,
  lookPa,
  malIntervall,
  nastaVag,
  radGest,
  ramTillSegment,
  tillampa,
  type Del,
  type SparKontext,
  type SparRad,
} from './underglowSpar'

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
  /** Delad station (två NUC:ar, en ESP32): den här NUC:ens sida → basen på station<N>/underglow/<sida>. */
  sida?: 'A' | 'B' | null
  /** Publicerar det här fönstret basen? (ledarfönstret). Default true. Gester skickas ändå. */
  skrivare?: boolean
  /** Spela ett kanoniskt ljud (appens AudioEngine-mappning). */
  spela?: (ljud: LjudNamn) => void
  /** Förhandsvisning (LjusRemsa) — ?ljus=visa. */
  visa?: boolean
  /** Spärrtid per segment för gester av samma/lägre prio (ms). Default 1500. */
  sparrMs?: number
  /** Spela underglow-spåren (filmer, bron, capstone, byte) + attract-vågen + VALdi-snurren. Default true. */
  spar?: boolean
  /** Regi-HTTP (spårfilerna + /time). Tom → samma värd som mqttUrl, port 8090. */
  regiUrl?: string
  /** Hämta ett spår (test/överstyrning). Default: GET <regiUrl>/film/<namn>/underglow.json. */
  hamtaSpar?: (namn: string) => Promise<unknown>
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
  /** Egen färg per segment ovanpå läget (t.ex. lampan under den aktiva luren i spelarens färg). null = läget gäller. */
  farg: {} as Record<string, Look | null>,
  /** Uträknad bas per segment (det som ritas). */
  bas: {} as Record<string, Look>,
  /** Pågående gest per segment (för förhandsvisning + spärr). */
  fx: {} as Record<string, FxState>,
  /** Segmentens pixelintervall. */
  segment: {} as Record<string, [number, number]>,
  /** Senast publicerade bas (felsökning). */
  senast: '',
  /** Domslut: hela vagnen i målvalvets färg tills `until` (epoch-ms). null = inget. */
  hitta: null as { valv: string; color: string; band_id: string | null; until: number } | null,
  /** Underglow-spåret som spelar (bilden gäller bara medan regi står i `fas`). */
  spar: null as { namn: string; fas: string; nyckel: string; ram: Del[] | null } | null,
  /** Spårets extra delar ovanpå segmenten (förhandsvisningen). */
  extra: [] as Array<{ id: string; from: number; to: number } & Look>,
  /** VALdi analyserar (station<N>/valdi `chase`): hela vagnen i valvet snurren står på. */
  snurr: null as { valv: Valv; mal: number; ms: number; t0: number } | null,
  /** Domens blink pågår till (epoch-ms): basen släckt så att 3 blink i valvfärgen syns. */
  domTill: 0,
  /** Senaste regi/round .state (bytet startar sitt spår vid live-byte). */
  rundaState: null as string | null,
  /** Regi-klockan − den lokala (ms), mätt mot GET /time. */
  offsetMs: 0,
})

type Opts = Required<Omit<LjusOptions, 'spela' | 'hamtaSpar'>> & {
  spela?: (l: LjudNamn) => void
  hamtaSpar?: (namn: string) => Promise<unknown>
}
let opts: Opts | null = null
let client: LjusClient | null = null
let hittaTimer: ReturnType<typeof setTimeout> | null = null
let sparTimers: ReturnType<typeof setTimeout>[] = []
let sparGen = 0
let vagTimer: ReturnType<typeof setTimeout> | null = null
let snurrTimer: ReturnType<typeof setTimeout> | null = null
let domTimer: ReturnType<typeof setTimeout> | null = null
let klockTimer: ReturnType<typeof setInterval> | null = null
const sparCache = new Map<string, unknown>()

const underglowTopic = () => `station${opts!.stationN}/underglow${opts!.sida ? `/${opts!.sida}` : ''}`
const feedbackTopic = () => `station${opts!.stationN}/feedback`
const hittaTopic = () => `station${opts!.stationN}/hitta`
const valdiTopic = () => `station${opts!.stationN}/valdi`

function egna(): string[] {
  return opts!.egna.length ? opts!.egna : Object.keys(opts!.segment)
}

/** Utan delsegment vars huvudsegment redan finns i listan (`A.lur2` när `A` finns) — en gest per yta. */
function toppar(ids: string[]): string[] {
  return ids.filter((id) => !(id.includes('.') && ids.includes(id.split('.')[0])))
}

/** Spårets bild, om spåret gäller nu (regi står i spårets fas och inget domslut/snurr går före). */
function aktivRam(): Del[] | null {
  const sp = state.spar
  if (!sp?.ram || sp.fas !== state.regiFas) return null
  if (state.hitta && Date.now() < state.hitta.until) return null
  if (state.snurr || Date.now() < state.domTill) return null
  return sp.ram
}

/** Fasens bas (det spåret ligger ovanpå). */
function fasLook(fas: string | null): Look {
  return regiLook(fas, opts!.valv) ?? lageLook('vila')
}

/** Segmenten spåret ritar på: hela stationen, eller (delad station) bara den här sidans. */
function sparSegment(): Record<string, [number, number]> {
  if (!opts!.sida) return opts!.segment
  return Object.fromEntries(egna().map((id) => [id, opts!.segment[id]]))
}

function sparKontext(fas: string | null): SparKontext {
  return { valv: opts!.valv, segment: sparSegment(), fasLook: fasLook(fas), delad: !!opts!.sida }
}

function lookFor(id: string): Look {
  if (state.hitta && Date.now() < state.hitta.until) return { color: state.hitta.color, effekt: 'static' }
  if (Date.now() < state.domTill) return { color: '#000000', effekt: 'av' }
  if (state.snurr) return { color: VALVFARG[state.snurr.valv], effekt: 'static' }
  const ram = aktivRam()
  if (ram) {
    const [from, to] = opts!.segment[id]
    return lookPa(ram, from, to) ?? fasLook(state.regiFas)
  }
  if (state.regiFas && REGI_FORE.includes(state.regiFas)) return regiLook(state.regiFas, opts!.valv)!
  const f = state.farg[id]
  if (f) return f
  // Delsegment (t.ex. `A.lur2`) utan eget läge följer sitt huvudsegment (`A`).
  const l = state.lage[id] ?? (id.includes('.') ? state.lage[id.split('.')[0]] : null)
  if (l) return lageLook(l, id)
  return regiLook(state.regiFas, opts!.valv) ?? lageLook('vila', id)
}

function recompute(): void {
  for (const id of Object.keys(opts!.segment)) state.bas[id] = lookFor(id)
  const ram = aktivRam()
  const ctx = ram ? sparKontext(state.regiFas) : null
  state.extra = ram && ctx && !ctx.delad ? ramTillSegment(ram, ctx).slice(Object.keys(ctx.segment).length) : []
}

function publish(topic: string, payload: object, retain: boolean): void {
  if (!opts!.enabled) return
  client?.publish(topic, JSON.stringify(payload), { retain })
}

function publiceraBas(force = false): void {
  recompute()
  if (!opts!.skrivare) return
  const ids = opts!.sida ? egna() : Object.keys(opts!.segment)
  const segments = ids.map((id) => {
    const [from, to] = opts!.segment[id]
    return { id, from, to, ...state.bas[id] }
  })
  segments.push(...state.extra) // spårets delar ovanpå (senare vinner i firmwaren)
  const lage = aktivRam() ? `spar:${state.spar!.namn}` : (state.lage[ids[0]] ?? state.regiFas ?? 'vila')
  const body = { lage, segments }
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
 * Egen färg/effekt på segment (default: egna), ovanpå läget — t.ex. lampan under den lur som har
 * turen, i spelarens färg (st2 `A.lur1–3`). null = tillbaka till segmentets läge.
 */
function farg(look: Look | null, ids?: string[]): void {
  if (!opts) return
  for (const id of ids ?? egna()) if (id in opts!.segment) state.farg[id] = look
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

function clearHitta(): void {
  if (hittaTimer) clearTimeout(hittaTimer)
  hittaTimer = null
  state.hitta = null
}

/** station<N>/hitta: {valv, color, sekunder, band_id?}. sekunder 0 = släck direkt (nästa person). */
function onHitta(raw: string): void {
  let d: { valv?: string; color?: string; sekunder?: number; band_id?: string }
  try {
    d = JSON.parse(raw)
  } catch {
    return
  }
  const sek = Number(d?.sekunder) || 0
  clearHitta()
  if (sek > 0 && typeof d.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(d.color)) {
    state.hitta = { valv: String(d.valv ?? ''), color: d.color.toLowerCase(), band_id: d.band_id ?? null, until: Date.now() + sek * 1000 }
    hittaTimer = setTimeout(() => {
      clearHitta()
      publiceraBas()
    }, sek * 1000)
  }
  publiceraBas()
}

/**
 * station<N>/valdi (VALdi-ceremonin → hålets ring) speglas på underglow under `sortering` (SOM.md,
 * Josef 2026-11-25): varje hjärtslag = amber lub-dub över hela vagnen; domen = hela vagnen i valvets
 * färg tills nästa person (nästa läge som inte är dom/hjarta/blixt, max VALDI_DOM_S). Sidorna spelar ingen roll.
 */
const VALDI_DOM_S = 30
/** Domens blink på underglow: 3 × 400 ms i valvfärgen (som ringens `dom`), sedan hela vagnen fast. */
const DOM_TEMPO = 400
const DOM_ANTAL = 3
/** Ringens lägen som inte avbryter vagnens snurr (handen ut = `paus` ändrar inget, manus §4.8). */
const SNURR_HALLER = ['chase', 'hjarta', 'blixt', 'paus', 'skann']
/** Flimmerregeln: högst 3 byten/s på vagnen (ringen får snurra fortare). */
const SNURR_MIN_MS = 340

function startaSnurr(mal: number, ms: number, t: number): void {
  stoppaSnurr()
  if (!opts!.spar) return
  const m = Math.max(0, Math.min(3, Math.round(mal)))
  const langd = Math.max(500, ms)
  const t0 = Date.now() - Math.max(0, t)
  const steg = () => {
    const dt = Date.now() - t0
    state.snurr = { valv: VALVORDNING[chaseValv(dt, langd, m)], mal: m, ms: langd, t0 }
    publiceraBas()
    if (dt < 0.92 * langd) snurrTimer = setTimeout(steg, SNURR_MIN_MS)
  }
  steg()
}

function stoppaSnurr(): void {
  if (snurrTimer) clearTimeout(snurrTimer)
  snurrTimer = null
  if (!state.snurr) return
  state.snurr = null
  publiceraBas()
}

/** Domen: basen släckt + 3 blink i valvfärgen (feedback), sedan hela vagnen i färgen (hitta, max 30 s). */
function domBlink(color: string): void {
  if (snurrTimer) clearTimeout(snurrTimer)
  snurrTimer = null
  state.snurr = null
  if (domTimer) clearTimeout(domTimer)
  const langd = DOM_TEMPO * DOM_ANTAL
  state.domTill = Date.now() + langd
  publiceraBas()
  if (opts!.skrivare) {
    const segments = toppar(egna()).map((id) => {
      const [from, to] = opts!.segment[id]
      return { id, from, to, color, tempo: DOM_TEMPO, antal: DOM_ANTAL }
    })
    publish(feedbackTopic(), { gest: 'dom', segments }, false)
  }
  domTimer = setTimeout(() => {
    domTimer = null
    state.domTill = 0
    onHitta(JSON.stringify({ valv: 'dom', color, sekunder: VALDI_DOM_S }))
  }, langd)
}
function onValdi(raw: string): void {
  if (state.regiFas !== 'sortering') return
  let d: { lage?: string; color?: string; mal?: number; ms?: number; t?: number }
  try {
    d = JSON.parse(raw)
  } catch {
    return
  }
  if (d?.lage === 'chase') {
    if (state.hitta) clearHitta() // nästa person vägs: förra domen släpps
    startaSnurr(Number(d.mal) || 0, Number(d.ms) || 5000, Number(d.t) || 0)
    return
  }
  if (d?.lage && d.lage !== 'dom' && !SNURR_HALLER.includes(d.lage)) stoppaSnurr()
  if (d?.lage === 'hjarta') {
    if (!opts!.skrivare) return // ett fönster per station, annars dubbla slag
    if (aktivRam() && state.spar?.namn === 'bron') return // bron (de första 10,5 s) går före hjärtslagen
    const segments = egna().map((id) => {
      const [from, to] = opts!.segment[id]
      return { id, from, to, color: FARG.amber, tempo: 250, antal: 2 }
    })
    publish(feedbackTopic(), { gest: 'hjarta', segments }, false)
    return
  }
  if (d?.lage === 'dom') {
    if (typeof d.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(d.color)) domBlink(d.color.toLowerCase())
    return
  }
  if (d?.lage !== 'blixt' && state.hitta) {
    clearHitta()
    publiceraBas()
  }
}

// --- underglow-spåren (XY-UNDERGLOW-MANUS §3) -----------------------------------------------------

/** Regi-klockan nu (epoch-ms på broker-NUC:en). */
function regiNu(): number {
  return Date.now() + state.offsetMs
}

/** ws://värd:9001 → http://värd:8090 (regi). Ogiltig/tom → ''. */
export function regiFranMqtt(mqttUrl: string): string {
  try {
    const u = new URL(mqttUrl)
    const proto = u.protocol === 'wss:' ? 'https:' : 'http:'
    const host = u.hostname.includes(':') ? `[${u.hostname}]` : u.hostname
    return host ? `${proto}//${host}:8090` : ''
  } catch {
    return ''
  }
}

/** Mät regi-klockan (GET /time, som skarm.html): offset = regi − lokal, mitt i rundresan. */
async function maleKlocka(): Promise<void> {
  if (!opts?.regiUrl || typeof fetch === 'undefined') return
  try {
    const t1 = Date.now()
    const r = await fetch(`${opts.regiUrl}/time`, { cache: 'no-store' })
    const j = (await r.json()) as { now_ms?: number }
    const t2 = Date.now()
    if (Number.isFinite(Number(j?.now_ms))) state.offsetMs = Math.round(Number(j.now_ms) - (t1 + t2) / 2)
  } catch {
    /* regi nere → lokal klocka (NUC:arna går på NTP) */
  }
}

async function hamta(namn: string): Promise<unknown> {
  try {
    let d: unknown = null
    if (opts!.hamtaSpar) d = await opts!.hamtaSpar(namn)
    else if (opts!.regiUrl && typeof fetch !== 'undefined') {
      const r = await fetch(`${opts!.regiUrl}/film/${encodeURIComponent(namn)}/underglow.json`, { cache: 'no-cache' })
      d = r.ok ? await r.json() : null
    }
    if (d) sparCache.set(namn, d)
    return d ?? sparCache.get(namn) ?? null
  } catch {
    return sparCache.get(namn) ?? null
  }
}

function rensaSparTimers(): void {
  for (const t of sparTimers) clearTimeout(t)
  sparTimers = []
}

/** Stoppa spåret (fasbyte, film/stop, slut_s). Bilden släpps → fasens bas. */
function stoppaSpar(): void {
  sparGen++
  rensaSparTimers()
  if (!state.spar) return
  state.spar = null
  publiceraBas()
}

/** Spela en rad nu: bas-rader ändrar bilden, gest-rader blinkar på målen. */
function utfor(rad: SparRad, tyst = false): void {
  const sp = state.spar
  if (!sp || !opts) return
  const ctx = sparKontext(sp.fas)
  if (arBasRad(rad)) {
    sp.ram = tillampa(sp.ram ?? [], rad, ctx)
    if (!tyst) publiceraBas()
  }
  const g = tyst ? null : radGest(rad, opts.valv)
  if (g && sp.fas === state.regiFas) {
    const mal = malIntervall(rad.mal, ctx)
    const ids = toppar(mal.map((m) => m.id))
    const segments = mal.filter((m) => ids.includes(m.id)).map((m) => ({ ...m, color: g.color, tempo: g.tempo, antal: g.antal }))
    if (segments.length) publish(feedbackTopic(), { gest: g.namn, segments }, false)
  }
}

/**
 * Starta spåret `namn` med t = 0 vid `t0` (epoch-ms på regi-klockan), giltigt i regi-fasen `fas`.
 * Kommer stationen in sent hoppar spelaren fram: passerade bas-rader läggs på direkt, passerade gester hoppas över.
 */
async function spela(namn: string, t0: number, fas: string): Promise<void> {
  if (!opts?.spar || !opts.skrivare) return
  const nyckel = `${namn}@${Math.round(t0)}`
  if (state.spar?.nyckel === nyckel) return // samma signal igen (retained vid återanslutning)
  stoppaSpar()
  const gen = sparGen
  const spar = lasSpar(await hamta(namn), namn)
  if (gen !== sparGen || !opts || !spar) return
  state.spar = { namn, fas, nyckel, ram: null }
  const start = t0 - state.offsetMs + (spar.forskjut_ms ?? 0) // lokal epoch-ms för t = 0
  const nu = Date.now()
  for (const s of kompilera(spar, opts.valv)) {
    const at = start + s.ms
    // Mer än SENT_MS passerat → lägg bara på bilden (gesten är för gammal); annars spela (nu eller senare).
    if (at < nu - SENT_MS) utfor(s.rad, true)
    else sparTimers.push(setTimeout(() => utfor(s.rad), Math.max(0, at - nu)))
  }
  if (spar.slut_s != null) {
    const slut = start + spar.slut_s * 1000 - nu
    if (slut <= 0) {
      stoppaSpar()
      return
    }
    sparTimers.push(setTimeout(() => stoppaSpar(), slut))
  }
  publiceraBas()
}

/** En rad som passerats med mindre än så här (hämtning, nätet) spelas ändå, gesten också. */
const SENT_MS = 250

/** Capstone-fanfaren startar så här långt efter fasbytet till `klart` (regi config.json → filmer.capstone). */
const CAPSTONE_FORSPRANG_MS = 1500

// --- attract-vågen (manus §4.1) ---------------------------------------------------------------------
const VAG_PERIOD_MS = 20000
const VAG_STEG_MS = 500
const VAG_TEMPO = 1200

function planeraVag(): void {
  if (vagTimer) clearTimeout(vagTimer)
  vagTimer = null
  if (!opts?.spar || !opts.skrivare || !opts.enabled) return
  if (state.regiFas !== 'idle' && state.regiFas !== 'attract') return
  const nu = regiNu()
  const nasta = nastaVag(nu, Math.max(0, GANGORDNING.indexOf(opts.valv)), VAG_PERIOD_MS, VAG_STEG_MS)
  vagTimer = setTimeout(() => {
    vagTimer = null
    if (state.regiFas === 'idle' || state.regiFas === 'attract') {
      const color = VALVFARG[opts!.valv]
      const segments = toppar(egna()).map((id) => {
        const [from, to] = opts!.segment[id]
        return { id, from, to, color, tempo: VAG_TEMPO, antal: 1 }
      })
      publish(feedbackTopic(), { gest: 'vag', segments }, false)
    }
    planeraVag()
  }, nasta - nu)
}

function onFilmStart(raw: string): void {
  if (!raw.trim()) {
    if (state.spar && state.spar.fas !== 'reveal' && state.spar.fas !== 'sortering') stoppaSpar()
    return
  }
  try {
    const d = JSON.parse(raw) as { film?: unknown; fas?: unknown; start_at_ms?: unknown }
    const t0 = Number(d?.start_at_ms)
    if (typeof d?.film !== 'string' || !d.film || !Number.isFinite(t0)) return
    void spela(d.film, t0, typeof d.fas === 'string' && d.fas ? d.fas : d.film)
  } catch {
    /* trasig → ignorera */
  }
}

function onMessage(topic: string, raw: string): void {
  if (!opts) return
  if (topic === hittaTopic()) {
    onHitta(raw)
    return
  }
  if (topic === valdiTopic()) {
    onValdi(raw)
    return
  }
  if (topic === 'film/start') {
    onFilmStart(raw)
    return
  }
  if (topic === 'film/stop' || topic === 'reveal/film/stop') {
    let film: unknown = null
    try {
      film = (JSON.parse(raw) as { film?: unknown })?.film
    } catch {
      /* tom → stoppa ändå */
    }
    const sp = state.spar
    if (sp && (topic === 'reveal/film/stop' ? sp.namn === 'reveal' : !film || film === sp.namn)) stoppaSpar()
    return
  }
  if (topic === 'reveal/film/start') {
    try {
      const t0 = Number((JSON.parse(raw) as { start_at_ms?: unknown })?.start_at_ms)
      if (Number.isFinite(t0)) void spela('reveal', t0, 'reveal')
    } catch {
      /* trasig → ignorera */
    }
    return
  }
  if (topic === 'regi/round') {
    let st: string | null = null
    try {
      const d = JSON.parse(raw) as { state?: unknown }
      st = typeof d?.state === 'string' ? d.state : null
    } catch {
      return
    }
    const forra = state.rundaState
    state.rundaState = st
    // Bara ett LIVE-byte startar bytets spår (inte det retained läget vid anslutning).
    if (forra !== null && forra !== 'byte' && st === 'byte' && state.regiFas === 'rotation') void spela('byte', regiNu(), 'rotation')
    return
  }
  if (topic !== 'regi/phase') return
  const forra = state.regiFas
  try {
    const d = JSON.parse(raw) as { phase?: string }
    state.regiFas = typeof d?.phase === 'string' ? d.phase : null
  } catch {
    return
  }
  if (forra !== state.regiFas) {
    if (state.spar && state.spar.fas !== state.regiFas) stoppaSpar()
    if (state.snurr) stoppaSnurr()
    // Live-byte (inte det retained läget vid anslutning): bron startar med sorteringen, capstone med klart.
    if (forra !== null && state.regiFas === 'sortering') void spela('bron', regiNu(), 'sortering')
    if (forra !== null && state.regiFas === 'klart') void spela('capstone', regiNu() + CAPSTONE_FORSPRANG_MS, 'klart')
    planeraVag()
  }
  publiceraBas()
}

const api = {
  state: readonly(state),
  lage,
  farg,
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
    sida: null,
    skrivare: true,
    visa: false,
    sparrMs: 1500,
    spar: true,
    ...o,
    regiUrl: (o.regiUrl || regiFranMqtt(o.mqttUrl)).replace(/\/+$/, ''),
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
    client.subscribe(hittaTopic())
    client.subscribe(valdiTopic())
    if (opts.spar && opts.skrivare) {
      for (const t of ['film/start', 'film/stop', 'reveal/film/start', 'reveal/film/stop', 'regi/round']) client.subscribe(t)
      void maleKlocka()
      klockTimer = setInterval(() => void maleKlocka(), 10 * 60 * 1000)
    }
  }
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
  if (env.VITE_REGI_URL) out.regiUrl = env.VITE_REGI_URL
  if (env.VITE_UNDERGLOW_SPAR === '0' || env.VITE_UNDERGLOW_SPAR === '1') out.spar = env.VITE_UNDERGLOW_SPAR === '1'
  if (typeof window !== 'undefined') {
    const p = new URLSearchParams(window.location.search)
    apply(p.get('ljus'))
    const u = p.get('mqtt')
    if (u) out.mqttUrl = u
    const r = p.get('regi')
    if (r) out.regiUrl = r
    const sp = p.get('spar')
    if (sp === '0' || sp === '1') out.spar = sp === '1'
  }
  return out
}

/** Endast för test: nollställ modulens singleton. */
export function __resetLjusForTest(): void {
  clearHitta()
  rensaSparTimers()
  sparGen++
  for (const t of [vagTimer, snurrTimer, domTimer]) if (t) clearTimeout(t)
  if (klockTimer) clearInterval(klockTimer)
  vagTimer = snurrTimer = domTimer = null
  klockTimer = null
  sparCache.clear()
  state.spar = null
  state.extra = []
  state.snurr = null
  state.domTill = 0
  state.rundaState = null
  state.offsetMs = 0
  opts = null
  client = null
  state.enabled = false
  state.visa = false
  state.connected = false
  state.regiFas = null
  state.lage = {}
  state.farg = {}
  state.bas = {}
  state.fx = {}
  state.segment = {}
  state.senast = ''
}
