/**
 * Stationsskärmarna följer regis filmer OCH de gemensamma apparna på broker-NUC:en
 * (Lager A, IDENTISK i alla X&Y-stationsappar).
 * SOM.md "Filmer i riggen": regi publicerar `film/start` (retained) när en film-fas börjar
 * (trailern), ljudet är master i centralhögtalaren, skärmarna kör filmens tysta HTML-paket
 * (`http://<broker>:8090/film/<film>/skarm.html?start_at=…&tid=/time`) mot regi-klockan.
 *
 *   regi/phase  (retained)  {phase}                                — vilken fas riggen står i
 *   film/start  (retained)  {film, fas, start_at_ms, skarm, …}    — tom payload = ingen film
 *   film/stop               {film}
 *
 * Overlayen visas bara medan regi/phase.phase == filmens fas (och skärmpaket finns); vid
 * fasbyte eller film/stop släpps stationen tillbaka. Samma prenumerationsmönster som
 * station-kit/ljus (egen MQTT-klient, så filmen funkar även med ljuset avstängt).
 *
 * APPAR (SOM.md "Appar i riggen"): i fasen `reveal` visas xy-reveal (`:5188`) med gruppen som
 * står vid stationen (retained station<N>/group, sista rundan) — follower, utom på den ENDA
 * driver-skärmen. I fasen `sortering` visas VALdi-ceremonin (xy-sortering `:8790`, `?valdi=1`) för
 * stationens eget hål (station<N>/hal, gruppen ur station<N>/group). I fasen `syv` visas
 * syvverktyget (`:8791`) med stationens valv och sida.
 *
 * Koppla in: initFilm(filmOptions({ enabled, mqttUrl, stationN, sida })) vid start +
 * <FilmOverlay /> i appens rot.
 */
import { computed, reactive, readonly } from 'vue'
import mqtt from 'mqtt'

export interface FilmClient {
  subscribe(topic: string): unknown
  on(event: 'message', cb: (topic: string, payload: { toString(): string }) => void): unknown
  on(event: 'connect' | 'close', cb: () => void): unknown
}

export interface FilmOptions {
  /** Följ regis filmer. Av → overlayen visas aldrig. */
  enabled: boolean
  /** Broker (WebSocket), samma som rotationen/ljuset. Tom → ingen MQTT. */
  mqttUrl: string
  /** Regi-HTTP (där filmpaketen bor). Tom → samma värd som mqttUrl, port 8090. */
  regiUrl?: string
  /** Undertextspråk till skarm.html (?sprak=). Default paketets eget (sv). */
  sprak?: string
  /** Stationens nummer → station<N>/group (reveal-gruppen) och SYV-valvet. Saknas → inga appar. */
  stationN?: number
  /** NUC:ens sida (A|B) → SYV:s ?screen. null/undefined = delad vy (A). */
  sida?: 'A' | 'B' | null
  /** Den här skärmen är reveal-driver (EXAKT en i riggen). Default follower. */
  revealDriver?: boolean
  /** xy-reveal på broker-NUC:en. Tom → samma värd som mqttUrl, port 5188. */
  revealUrl?: string
  /** syvverktyget på broker-NUC:en. Tom → samma värd som mqttUrl, port 8791. */
  syvUrl?: string
  /** xy-sortering (VALdi) på broker-NUC:en. Tom → samma värd som mqttUrl, port 8790. */
  sorteringUrl?: string
}

export interface FilmSignal {
  film: string
  fas?: string | null
  start_at_ms: number
  duration_s?: number | null
  skarm?: boolean
  session_id?: unknown
}

/** Portar på broker-NUC:en (xy-arkitektur XY-RIGG-ARKITEKTUR §2.4, SOM.md "Appar i riggen"). */
export const REGI_PORT = 8090
export const REVEAL_PORT = 5188
export const SYV_PORT = 8791
export const SORTERING_PORT = 8790

/** Stationens valv i SYV-verktyget (XY-ROTATION: st1 Diplomatkåren, st2 Teknologerna, …). */
export const SYV_VALV: Record<number, string> = {
  1: 'diplomatkaren',
  2: 'teknologerna',
  3: 'forskningslaget',
  4: 'driften',
}

/** Det som visas i overlayen just nu. */
export type OverlayLage = 'film' | 'reveal' | 'sortering' | 'syv' | null

const state = reactive({
  enabled: false,
  connected: false,
  regiUrl: '',
  sprak: '',
  /** Senaste regi/phase .phase. */
  regiFas: null as string | null,
  /** Senaste regi/phase .session_id. */
  sessionId: null as string | number | null,
  /** Aktiv filmsignal (film/start) eller null. */
  signal: null as FilmSignal | null,
  /** Testgruppen vid stationen (retained station<N>/group). */
  grupp: null as number | string | null,
  mqttUrl: '',
  stationN: null as number | null,
  sida: null as 'A' | 'B' | null,
  revealDriver: false,
  revealUrl: '',
  syvUrl: '',
  sorteringUrl: '',
})

/** Visas filmen nu? Signal finns, har skärmpaket och riggen står i filmens fas. */
const filmSynlig = computed(() => {
  const s = state.signal
  if (!state.enabled || !s || s.skarm === false || !state.regiUrl) return false
  return s.fas == null || s.fas === state.regiFas
})

/** Vad overlayen visar: filmen går före; annars appen för fasen (reveal/syv) om den är konfigurerad. */
const lage = computed<OverlayLage>(() => {
  if (!state.enabled) return null
  if (filmSynlig.value) return 'film'
  if (state.regiFas === 'reveal' && state.revealUrl) return 'reveal'
  // EN VALdi per hål: bara sida A (eller delad vy) kör ceremonin — två skulle båda reagera på handen,
  // styra ringen och skicka sortering/dom dubbelt.
  if (state.regiFas === 'sortering' && state.sorteringUrl && state.stationN != null && state.sida !== 'B') return 'sortering'
  if (state.regiFas === 'syv' && state.syvUrl && state.stationN != null && SYV_VALV[state.stationN]) return 'syv'
  return null
})

/** iframe-adressen (tom när inget visas). */
const src = computed(() => {
  switch (lage.value) {
    case 'film':
      return filmSrc(state.regiUrl, state.signal!, state.sprak)
    case 'reveal':
      return revealSrc(state.revealUrl, {
        grupp: state.grupp,
        sessionId: state.sessionId,
        driver: state.revealDriver,
      })
    case 'sortering':
      return sorteringSrc(state.sorteringUrl, {
        stationN: state.stationN!,
        sessionId: state.sessionId,
        mqttUrl: state.mqttUrl,
      })
    case 'syv':
      return syvSrc(state.syvUrl, {
        valv: SYV_VALV[state.stationN!],
        sida: state.sida,
        stationN: state.stationN,
        sessionId: state.sessionId,
        mqttUrl: state.mqttUrl,
      })
    default:
      return ''
  }
})

/** Visas något i overlayen? */
const synlig = computed(() => src.value !== '')

let client: FilmClient | null = null
let started = false

/** ws://värd:9001 → http://värd:<port> (wss → https). Ogiltig/tom → ''. */
export function brokerHttp(mqttUrl: string, port: number): string {
  try {
    const u = new URL(mqttUrl)
    const proto = u.protocol === 'wss:' ? 'https:' : 'http:'
    const host = u.hostname.includes(':') ? `[${u.hostname}]` : u.hostname
    return host ? `${proto}//${host}:${port}` : ''
  } catch {
    return ''
  }
}

/** ws://värd:9001 → http://värd:8090 (regi). */
export function regiFranMqtt(mqttUrl: string): string {
  return brokerHttp(mqttUrl, REGI_PORT)
}

const bas = (u: string) => u.replace(/\/+$/, '')
const q = (o: Record<string, string | number | null | undefined | true>) =>
  Object.entries(o)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => (v === true ? k : `${k}=${encodeURIComponent(String(v))}`))
    .join('&')

/** xy-reveal: gruppens siffror; follower utom på driver-skärmen (autostart = lokal tempo). */
export function revealSrc(
  revealUrl: string,
  o: { grupp: number | string | null; sessionId: string | number | null; driver: boolean },
): string {
  const tail = q({ group: o.grupp, session: o.sessionId, [o.driver ? 'autostart' : 'follower']: true })
  return `${bas(revealUrl)}/?${tail}`
}

/**
 * syvverktyget: stationens valv + sida + nummer, broker för RFID/syv-sömmen, startar direkt.
 * `station` gör att SYV i band-läget lyssnar på DEN HÄR stationens station<N>/rfidja|rfidnej (SOM.md 2026-11-19).
 */
export function syvSrc(
  syvUrl: string,
  o: {
    valv: string
    sida: 'A' | 'B' | null
    stationN?: number | null
    sessionId: string | number | null
    mqttUrl: string
  },
): string {
  const tail = q({
    valv: o.valv,
    screen: o.sida ?? 'A',
    station: o.stationN,
    session: o.sessionId,
    broker: o.mqttUrl,
    autostart: 1,
  })
  return `${bas(syvUrl)}/?${tail}`
}

/**
 * VALdi-ceremonin (xy-sortering): stationens hål (station<N>/hal + station<N>/group), körningens session
 * (→ sortering/dom till regi), broker för sömmen. Ringen styrs via station<N>/valdi (SOM.md).
 */
export function sorteringSrc(
  sorteringUrl: string,
  o: { stationN: number; sessionId: string | number | null; mqttUrl: string },
): string {
  const tail = q({ valdi: 1, station: o.stationN, session: o.sessionId, broker: o.mqttUrl })
  return `${bas(sorteringUrl)}/?${tail}`
}

/** Skärmpaketets adress: start_at på regi-klockan, klockan mäts mot regi /time (samma origin). */
export function filmSrc(regiUrl: string, s: FilmSignal, sprak = ''): string {
  const tail = `start_at=${Math.round(s.start_at_ms)}&tid=/time${sprak ? `&sprak=${encodeURIComponent(sprak)}` : ''}`
  return `${bas(regiUrl)}/film/${encodeURIComponent(s.film)}/skarm.html?${tail}`
}

function onMessage(topic: string, raw: string): void {
  if (topic === 'regi/phase') {
    try {
      const d = JSON.parse(raw) as { phase?: unknown; session_id?: unknown }
      state.regiFas = typeof d?.phase === 'string' ? d.phase : null
      const sid = d?.session_id
      state.sessionId = typeof sid === 'number' || typeof sid === 'string' ? sid : null
    } catch {
      /* trasig fas → behåll senaste */
    }
    return
  }
  if (state.stationN != null && topic === `station${state.stationN}/group`) {
    try {
      const g = (JSON.parse(raw) as { group?: unknown })?.group
      state.grupp = typeof g === 'number' || (typeof g === 'string' && g) ? g : null
    } catch {
      /* trasig → behåll senaste */
    }
    return
  }
  if (topic === 'film/stop') {
    let film: unknown = null
    try {
      film = (JSON.parse(raw) as { film?: unknown })?.film
    } catch {
      /* tom/trasig → stoppa ändå */
    }
    if (!film || film === state.signal?.film) state.signal = null
    return
  }
  if (topic === 'film/start') {
    if (!raw.trim()) {
      state.signal = null // retained rensad = ingen film
      return
    }
    try {
      const d = JSON.parse(raw) as Partial<FilmSignal>
      state.signal =
        typeof d?.film === 'string' && d.film && Number.isFinite(Number(d.start_at_ms))
          ? { ...d, film: d.film, start_at_ms: Number(d.start_at_ms) }
          : null
    } catch {
      state.signal = null
    }
  }
}

const api = {
  state: readonly(state),
  synlig,
  src,
  lage,
}
export type StationFilm = typeof api

/** Hämta filmläget (efter initFilm). Säker före init: synlig = false. */
export function useFilm(): StationFilm {
  return api
}

/** Starta modulen. Idempotent (första anropet vinner). `injected` = egen MQTT-klient (test). */
export function initFilm(o: FilmOptions, injected?: FilmClient): StationFilm {
  if (started) return api
  started = true
  state.enabled = o.enabled
  state.regiUrl = bas(o.regiUrl || regiFranMqtt(o.mqttUrl))
  state.sprak = o.sprak ?? ''
  state.mqttUrl = o.mqttUrl
  state.stationN = o.stationN ?? null
  state.sida = o.sida ?? null
  state.revealDriver = !!o.revealDriver
  state.revealUrl = bas(o.revealUrl || brokerHttp(o.mqttUrl, REVEAL_PORT))
  state.syvUrl = bas(o.syvUrl || brokerHttp(o.mqttUrl, SYV_PORT))
  state.sorteringUrl = bas(o.sorteringUrl || brokerHttp(o.mqttUrl, SORTERING_PORT))
  if (!o.enabled) return api
  if (injected) client = injected
  else if (o.mqttUrl) {
    client = mqtt.connect(o.mqttUrl, {
      reconnectPeriod: 2000,
      connectTimeout: 8000,
      clientId: `xy-film-${Math.random().toString(16).slice(2, 8)}`,
    }) as unknown as FilmClient
  }
  if (client) {
    client.on('connect', () => {
      state.connected = true
    })
    client.on('close', () => {
      state.connected = false
    })
    client.on('message', (topic, payload) => onMessage(topic, payload.toString()))
    client.subscribe('regi/phase')
    client.subscribe('film/start')
    client.subscribe('film/stop')
    if (state.stationN != null) client.subscribe(`station${state.stationN}/group`)
  }
  return api
}

/**
 * Bygg FilmOptions med överstyrning utifrån (före appens default):
 *   ?film=1|0, ?mqtt=ws://…, ?regi=http://…, ?revealurl=…, ?syvurl=…, ?sorteringurl=…, ?revealdriver=1|0
 *   VITE_FILM=1|0, VITE_MQTT_URL, VITE_REGI_URL, VITE_REVEAL_URL, VITE_SYV_URL, VITE_SORTERING_URL,
 *   VITE_REVEAL_DRIVER=1|0 vid bygget (riggen: VITE_MQTT_URL=ws://192.168.10.10:9001)
 * Ingen IP i koden: regi/reveal/VALdi/SYV härleds ur broker-adressen (samma värd, 8090/5188/8790/8791).
 */
export function filmOptions(defaults: FilmOptions): FilmOptions {
  const out: FilmOptions = { ...defaults }
  const env = import.meta.env as Record<string, string | undefined>
  if (env.VITE_FILM === '1' || env.VITE_FILM === '0') out.enabled = env.VITE_FILM === '1'
  if (env.VITE_MQTT_URL) out.mqttUrl = env.VITE_MQTT_URL
  if (env.VITE_REGI_URL) out.regiUrl = env.VITE_REGI_URL
  if (env.VITE_REVEAL_URL) out.revealUrl = env.VITE_REVEAL_URL
  if (env.VITE_SYV_URL) out.syvUrl = env.VITE_SYV_URL
  if (env.VITE_SORTERING_URL) out.sorteringUrl = env.VITE_SORTERING_URL
  if (env.VITE_REVEAL_DRIVER === '1' || env.VITE_REVEAL_DRIVER === '0') out.revealDriver = env.VITE_REVEAL_DRIVER === '1'
  if (typeof window !== 'undefined') {
    const p = new URLSearchParams(window.location.search)
    const f = p.get('film')
    if (f === '1' || f === '0') out.enabled = f === '1'
    const m = p.get('mqtt')
    if (m) out.mqttUrl = m
    const r = p.get('regi')
    if (r) out.regiUrl = r
    const ru = p.get('revealurl')
    if (ru) out.revealUrl = ru
    const su = p.get('syvurl')
    if (su) out.syvUrl = su
    const so = p.get('sorteringurl')
    if (so) out.sorteringUrl = so
    const d = p.get('revealdriver')
    if (d === '1' || d === '0') out.revealDriver = d === '1'
  }
  return out
}

/** Endast för test: nollställ modulens singleton. */
export function __resetFilmForTest(): void {
  started = false
  client = null
  state.enabled = false
  state.connected = false
  state.regiUrl = ''
  state.sprak = ''
  state.regiFas = null
  state.sessionId = null
  state.signal = null
  state.grupp = null
  state.mqttUrl = ''
  state.stationN = null
  state.sida = null
  state.revealDriver = false
  state.revealUrl = ''
  state.syvUrl = ''
  state.sorteringUrl = ''
}
