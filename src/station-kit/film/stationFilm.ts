/**
 * Stationsskärmarna följer regis filmer (Lager A, IDENTISK i alla X&Y-stationsappar).
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
 * Koppla in: initFilm(filmOptions({ enabled, mqttUrl })) vid start + <FilmOverlay /> i appens rot.
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
}

export interface FilmSignal {
  film: string
  fas?: string | null
  start_at_ms: number
  duration_s?: number | null
  skarm?: boolean
  session_id?: unknown
}

/** Regi-HTTP:s port (xy-arkitektur XY-RIGG-ARKITEKTUR §2.4). */
export const REGI_PORT = 8090

const state = reactive({
  enabled: false,
  connected: false,
  regiUrl: '',
  sprak: '',
  /** Senaste regi/phase .phase. */
  regiFas: null as string | null,
  /** Aktiv filmsignal (film/start) eller null. */
  signal: null as FilmSignal | null,
})

/** Visas filmen nu? Signal finns, har skärmpaket och riggen står i filmens fas. */
const synlig = computed(() => {
  const s = state.signal
  if (!state.enabled || !s || s.skarm === false || !state.regiUrl) return false
  return s.fas == null || s.fas === state.regiFas
})

/** iframe-adressen till filmens skärmpaket (tom när ingen film visas). */
const src = computed(() => (synlig.value && state.signal ? filmSrc(state.regiUrl, state.signal, state.sprak) : ''))

let client: FilmClient | null = null
let started = false

/** ws://värd:9001 → http://värd:8090 (wss → https). Ogiltig/tom → ''. */
export function regiFranMqtt(mqttUrl: string): string {
  try {
    const u = new URL(mqttUrl)
    const proto = u.protocol === 'wss:' ? 'https:' : 'http:'
    const host = u.hostname.includes(':') ? `[${u.hostname}]` : u.hostname
    return host ? `${proto}//${host}:${REGI_PORT}` : ''
  } catch {
    return ''
  }
}

/** Skärmpaketets adress: start_at på regi-klockan, klockan mäts mot regi /time (samma origin). */
export function filmSrc(regiUrl: string, s: FilmSignal, sprak = ''): string {
  const bas = regiUrl.replace(/\/+$/, '')
  const q = `start_at=${Math.round(s.start_at_ms)}&tid=/time${sprak ? `&sprak=${encodeURIComponent(sprak)}` : ''}`
  return `${bas}/film/${encodeURIComponent(s.film)}/skarm.html?${q}`
}

function onMessage(topic: string, raw: string): void {
  if (topic === 'regi/phase') {
    try {
      const d = JSON.parse(raw) as { phase?: unknown }
      state.regiFas = typeof d?.phase === 'string' ? d.phase : null
    } catch {
      /* trasig fas → behåll senaste */
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
  state.regiUrl = (o.regiUrl || regiFranMqtt(o.mqttUrl)).replace(/\/+$/, '')
  state.sprak = o.sprak ?? ''
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
  }
  return api
}

/**
 * Bygg FilmOptions med överstyrning utifrån (före appens default):
 *   ?film=1|0, ?mqtt=ws://…, ?regi=http://…  i URL:en
 *   VITE_FILM=1|0, VITE_MQTT_URL, VITE_REGI_URL vid bygget (riggen: ws://192.168.10.10:9001)
 * Ingen IP i koden: regi-adressen härleds ur broker-adressen (samma värd, port 8090).
 */
export function filmOptions(defaults: FilmOptions): FilmOptions {
  const out: FilmOptions = { ...defaults }
  const env = import.meta.env as Record<string, string | undefined>
  if (env.VITE_FILM === '1' || env.VITE_FILM === '0') out.enabled = env.VITE_FILM === '1'
  if (env.VITE_MQTT_URL) out.mqttUrl = env.VITE_MQTT_URL
  if (env.VITE_REGI_URL) out.regiUrl = env.VITE_REGI_URL
  if (typeof window !== 'undefined') {
    const p = new URLSearchParams(window.location.search)
    const f = p.get('film')
    if (f === '1' || f === '0') out.enabled = f === '1'
    const m = p.get('mqtt')
    if (m) out.mqttUrl = m
    const r = p.get('regi')
    if (r) out.regiUrl = r
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
  state.signal = null
}
