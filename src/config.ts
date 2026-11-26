/**
 * Central config för Förhandlingen.
 *
 * Pilot vs drift skiljs av EN sak: `MODE`. Allt annat (STATION_N, kapital,
 * antal resurser, datasets, timer, språk) är konstanter här. Pilot→drift =
 * byt MODE och fyll stubbarna i adaptrarna — rör aldrig spellogiken.
 *
 * INGA hemligheter i denna fil (broker-url, lösenord, tokens hör hemma i
 * miljövariabler/driftconfig, aldrig i git).
 */

import { bandlostFran } from '@/station-kit/band/band'
import type { Dataset, Person, TeamId } from './stations/forhandlingen/engine/types'
import type { RollvalConfig } from './station-kit/rollval/types'
import type { EntreConfig } from './station-kit/entre/types'
import type { OverlayData } from './station-kit/undertext/undertext'
import type { Valv } from './station-kit/ljus/kanon'

export type Mode = 'pilot' | 'production'

/** Stationens nummer i riggen. Topic-namespace blir `station<N>/…`.
 *  Förhandlingen = station 1 i X&Y-kedjan (incheckning → st1 → st2 → reveal …). */
export const STATION_N = 1

export const config = {
  /** 'pilot' = BroadcastChannel + skärm-ljus + mock-identitet/resultat.
   *  'production' = WebSocket + MQTT-ljus + MQTT-identitet/resultat (stubbat). */
  mode: 'pilot' as Mode,

  stationN: STATION_N,

  /** Startkapital per lag (kr). */
  capital: 100,

  /** Antal resurser på bordet. */
  resourceCount: 5,

  /** Fördröjning (ms) innan nästa lucka tänds efter en vunnen resurs. */
  nextHatchDelayMs: 1000,

  /** Aktivt språk. Svenska byggd; no/svorsk stubbade. */
  lang: 'sv' as 'sv' | 'no' | 'svorsk',

  /** Drift-adresser. wsUrl = skärm↔skärm-synk (tomt → faller tillbaka på
   *  BroadcastChannel, dvs samma-dator-synk; sätt för flera enheter).
   *  mqttUrl = broker för identitet/resultat/ljus (webbläsare → ws-lyssnare).
   *  Går att överstyra vid bygget med VITE_MQTT_URL. Inga hemligheter här. */
  production: {
    wsUrl: '',
    /** Tom → VITE_MQTT_URL (riggen: ws://192.168.10.10:9001) → dev-default ws://127.0.0.1:9001. */
    mqttUrl: '',
  },
} as const

/**
 * ROTATION (xy-arkitektur/XY-ROTATION.md, SOM.md 2026-11-17): regi skickar
 * station<N>/group → "Testgrupp X — tryck för att börja" → tutorial → skarp →
 * done → lek. Av i piloten (demo/Pages oförändrade); på i drift. Överstyrs
 * med ?rotation=1|0 / ?mqtt=ws://… i kiosk-URL:en eller VITE_ROTATION /
 * VITE_MQTT_URL vid bygget. Ingen IP i koden.
 */
export const ROTATION = {
  stationN: STATION_N,
  enabled: config.mode === 'production',
  mqttUrl: config.production.mqttUrl || 'ws://127.0.0.1:9001', // dev-default; env/URL går före
}

/**
 * BANDLÖST LÄGE (station-kit/band, xy-arkitektur/XY-BANDLOST-OCH-ANKOMST.md, SOM.md "bandlöst läge (v49)"):
 * på = allt banden gör görs på skärmen (rollvalet: en person i taget). Av = RFID-läsarna
 * (station<N>/rfidnej = roll A, rfidja = roll B). Default PÅ inför v49 (läsarna är inte klara).
 * Överstyrs med ?bandlost=1|0 i kiosk-URL:en eller VITE_BANDLOST=1|0 vid bygget.
 * ?rost=rfid|skarm (en enskild skärm) och facilitatormenyn går fortfarande före.
 */
export const BANDLOST: boolean = bandlostFran(true, import.meta.env.VITE_BANDLOST as string | undefined)

/**
 * STATIONSLJUS (station-kit/ljus, XY-FEEDBACK-LJUS-LJUD §1.2/§5.1): underglow-segmenten.
 * Sida A = vänster (#lag1), sida B = höger (#lag2). Bas retained på
 * station1/underglow, gester på station1/feedback (SOM.md "Stationsljus"). Publiceras bara i
 * drift (överstyr ?ljus=1|0|visa / VITE_LJUS). Broker = samma som rotationen (ROTATION.mqttUrl).
 * Pixelintervallen = standardslingan (141 LED 0–140, SOM.md "Stationsljus", 2026-11-26), samma som
 * Undersökningen: A 0–69, B 70–140. Delarna A.1–A.3 / B.1–B.3 läggs till här när de behövs — aldrig i firmware.
 */
export const LJUS: { valv: Valv; segment: Record<string, [number, number]> } = {
  valv: 'diplomat',
  segment: {
    A: [0, 69],
    B: [70, 140],
  },
}

/**
 * Resurserna på bordet. `id` är stabilt (används i signaler/datasets);
 * visningsnamnet slås upp via i18n (`resource.<id>`).
 */
export const RESOURCES = [
  { id: 'insulin' },
  { id: 'branslecell' },
  { id: 'styrkort' },
  { id: 'radiosandare' },
  { id: 'membranfilter' },
] as const

export type ResourceId = (typeof RESOURCES)[number]['id']

/**
 * 4 förbestämda dataset. Krockfria kritiska som default (lag1 ≠ lag2).
 * Lätt att tuna efter provspel; slumpordning kan läggas till som tillval.
 */
export const DATASETS: Dataset[] = [
  {
    id: 'set-1',
    kritisk_lag1: 'insulin',
    kritisk_lag2: 'membranfilter',
    ordning: ['styrkort', 'insulin', 'branslecell', 'membranfilter', 'radiosandare'],
    kapital: 100,
  },
  {
    id: 'set-2',
    kritisk_lag1: 'branslecell',
    kritisk_lag2: 'radiosandare',
    ordning: ['membranfilter', 'branslecell', 'styrkort', 'radiosandare', 'insulin'],
    kapital: 100,
  },
  {
    id: 'set-3',
    kritisk_lag1: 'styrkort',
    kritisk_lag2: 'insulin',
    ordning: ['radiosandare', 'membranfilter', 'insulin', 'styrkort', 'branslecell'],
    kapital: 100,
  },
  {
    id: 'set-4',
    kritisk_lag1: 'radiosandare',
    kritisk_lag2: 'branslecell',
    ordning: ['insulin', 'styrkort', 'membranfilter', 'radiosandare', 'branslecell'],
    kapital: 100,
  },
]

/** Standard-dataset för skarpt spel (efter trial). */
export const LIVE_DATASET_ID = 'set-1'

/**
 * TESTRUNDAN (tutorial, ljusblå — Josef 2026-11-26): TVÅ luckor + gissning, på den riktiga konsolen.
 * Varje sida har sin livsviktiga bland de två, så båda får se larmet "er livsviktiga" och sedan gissa.
 * Inget räknas; efteråt går ProvGenomgang.vue igenom vad som hände, steg för steg.
 */
export const TRIAL_DATASET: Dataset = {
  id: 'prov',
  kritisk_lag1: 'insulin',
  kritisk_lag2: 'branslecell',
  ordning: ['branslecell', 'insulin'],
  kapital: 100,
}

/** Alla dataset som store.start kan slå upp (test + trial + skarpa). */
export const ALL_DATASETS: Dataset[] = [TRIAL_DATASET, ...DATASETS]

/**
 * Tider (sekunder). getReadyFirst = "gör er redo" före FÖRSTA luckan. De sista 8 s pekar skärmen först på den
 * livsviktiga, sedan på pengarna (Josef 2026-11-24); i skarpt läge 12 s så att NU GÄLLER DET (~4 s) hinner först; getReady = mellan
 * luckorna; negotiation = budgivningen per lucka; guess = gissningen efter sista luckan.
 */
export const ROUND_TIMERS = {
  prov: { getReadyFirst: 8, getReady: 3, negotiation: 25, guess: 20 },
  live: { getReadyFirst: 12, getReady: 4, negotiation: 30, guess: 20 },
} as const

/** Klubban: hur länge ÅNGRA gäller efter KLUBBA, och prisstegen på knapparna. */
export const KLUBBA = {
  angraSekunder: 5,
  steg: [1, 5] as const,
  startpris: 20,
} as const

/**
 * Testrundan (TRIAL_DATASET) mellan "Er tur" och skarpt läge: PÅ igen (Josef 2026-11-26) — två resurser,
 * gissning och en genomgång efteråt. false = direkt till skarpt efter "Er tur".
 */
export const PROVLUCKA = true

/**
 * Väntpunkter mellan skärmarna (spelläget, instruktionen klar): går vidare av sig
 * själv efter så här många sekunder med synlig nedräkning, så en tyst sida aldrig
 * låser stationen.
 */
export const VANTA_MAX_SEKUNDER = 20

/**
 * Drift: om ingen rör stationen på så här länge återställs den till början
 * (attract) så nästa grupp möter en ren station. 0 = av. `warnSeconds` = hur
 * länge en "återställs strax"-varning visas innan.
 */
export const IDLE_RESTART = {
  minutes: 8,
  warnSeconds: 20,
} as const

/**
 * Bygger en url till en fil i public/ som funkar oavsett bas-sökväg:
 * `/` i dev och på NUC-hosten, `/forhandlingen/` på GitHub Pages. Utan detta
 * 404:ar ljud/foton/undertext på Pages (de pekar på fel rot). Filnamn med
 * mellanslag encode:as.
 */
export function asset(path: string): string {
  return encodeURI(import.meta.env.BASE_URL + path.replace(/^\/+/, ''))
}

/** Ljud-url i public/Sound (via asset() så basen på Pages följer med). */
export function encodeAudio(name: string): string {
  return asset(`/Sound/${name}`)
}

/**
 * Lagen. Rollval/uppdelning sker UPPSTRÖMS i riggen — vi kommer rakt in i
 * dashboarden med sidorna redan satta. Namn = A / B (visas som SIDA A / SIDA B).
 * Ingen färgmarkering per lag.
 *
 * Logotyp: lägg PNG/SVG i `public/teams/` och peka ut den här. Saknas filen
 * visas bokstavs-fallbacken (emoji-fältet). `members` är pilotens roster
 * (ersätts av riggens identitet i drift) — deterministisk så två fönster/
 * skärmar är i synk.
 */
export interface TeamConfig {
  id: TeamId
  name: string
  emoji: string
  /** Sökväg till logga i public/, eller null för emoji-fallback. */
  logo: string | null
  members: Person[]
}

// Sida A = vänster (lag1), sida B = höger (lag2). Roll A/B (sändebud/
// rapportör) i X&Y-resultatet är oförändrat och sätts uppströms.
export const TEAMS: Record<TeamId, TeamConfig> = {
  lag1: {
    id: 'lag1',
    name: 'A',
    emoji: 'A',
    logo: asset('/teams/a.png'),
    members: [
      { band_id: 'a-1', name: 'Alva', team: 'lag1', chosen_role: 'A', assigned_role: 'A', role_presented_as: null },
      { band_id: 'a-2', name: 'Noah', team: 'lag1', chosen_role: 'B', assigned_role: 'B', role_presented_as: null },
    ],
  },
  lag2: {
    id: 'lag2',
    name: 'B',
    emoji: 'B',
    logo: asset('/teams/b.png'),
    members: [
      { band_id: 'b-1', name: 'Ebba', team: 'lag2', chosen_role: 'A', assigned_role: 'A', role_presented_as: null },
      { band_id: 'b-2', name: 'Hugo', team: 'lag2', chosen_role: 'B', assigned_role: 'B', role_presented_as: null },
    ],
  },
}

/** Deterministisk pilot-roster (delas av alla fönster). */
export function defaultRoster(): Record<TeamId, Person[]> {
  return {
    lag1: TEAMS.lag1.members.map((m) => ({ ...m })),
    lag2: TEAMS.lag2.members.map((m) => ({ ...m })),
  }
}

/* ------------------------------------------------------------------ *
 * ROLLVAL — nytt touchskärms-flöde FÖRE stationens eget flöde (Lager A).
 * Besökaren ser ett "en dag i livet"-klipp per roll och väljer roll på
 * skärmen. Skippbart via ROLLVAL_ENABLED. Inramning: förmågor värda att
 * vara bra på — IMPLICIT, copyn nämner aldrig "framtidsyrke" eller AI.
 *
 * Klippen bor i forhandlingen/assets/ (riktiga klipp, lagda av Josef) och
 * löses via Vite-glob nedan — matcha EXAKTA filnamn (å/ä/ö + mellanslag).
 * ------------------------------------------------------------------ */

/** Sätt false för att hoppa över hela rollvalet (appen kör utan det). */
export const ROLLVAL_ENABLED = true

/** Aktivt klippset. Testet kör ETT fast set (set 1 = Ida + Ossian); det andra
 *  setet finns kvar i config. 'alternate' = växla per körning. */
export const ROLLVAL_START_SET: number | 'alternate' = 0

/** Riktiga rollklipp i forhandlingen/assets/ (url via Vite). */
const ROLLVAL_CLIPS = import.meta.glob('../assets/*.mp4', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function rollvalClip(file: string): string {
  // Vite-globens nycklar är NFD (macOS dekomponerar å/ä/ö); våra literaler är
  // NFC. Normalisera båda till NFC före jämförelsen.
  const target = ('/' + file).normalize('NFC')
  const hit = Object.entries(ROLLVAL_CLIPS).find(([k]) => k.normalize('NFC').endsWith(target))
  return hit?.[1] ?? ''
}

/** Textlager (overlay.json) + rollvalsporträtt bredvid varje klipp i assets/ (XY-TEXTLAGER). */
const ROLLVAL_OVERLAYS = import.meta.glob('../assets/*.overlay.json', { eager: true, import: 'default' }) as Record<string, unknown>
const ROLLVAL_PORTRATTER = import.meta.glob('../assets/*.portratt.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

function globHit<T>(map: Record<string, T>, file: string): T | undefined {
  const target = ('/' + file).normalize('NFC')
  return Object.entries(map).find(([k]) => k.normalize('NFC').endsWith(target))?.[1]
}
/** Overlay-data för ett klipp: "Namn roll.mp4" → "Namn roll.overlay.json". */
function clipOverlay(file: string): OverlayData | null {
  return (globHit(ROLLVAL_OVERLAYS, file.replace(/\.mp4$/i, '.overlay.json')) as OverlayData | undefined) ?? null
}
/** Rollvalsporträtt för ett klipp: "Namn roll.mp4" → "Namn roll.portratt.jpg". */
function clipPortratt(file: string): string {
  return globHit(ROLLVAL_PORTRATTER, file.replace(/\.mp4$/i, '.portratt.jpg')) ?? ''
}

export const ROLLVAL: RollvalConfig = {
  stationTitle: 'Förhandlingen',
  intro: 'Två sätt att göra skillnad i ett rum. Titta på hur en dag ser ut — välj sedan vilken du vill kliva in i.',
  question: 'Vilken av dem känns som du?',
  roles: [
    {
      id: 'sandebud',
      name: 'Sändebud',
      tagline: 'Den som möter motparten ansikte mot ansikte.',
      description: 'Läser rummet, hittar orden som landar och bygger förtroende där andra kör fast. Det går inte att förhandla utan någon som vågar tala.',
    },
    {
      id: 'rapportor',
      name: 'Rapportör',
      tagline: 'Den som håller överblicken och fattar besluten.',
      description: 'Ser helheten, väger varje bud mot det som står på spel och styr konsolen med lugn hand. Utan överblick blir även den bästa förhandlingen gissningar.',
    },
  ],
  // Ett set per körning (ett klipp per roll). Josef byter/lägger till klipp i
  // forhandlingen/assets/ och uppdaterar filnamnen här.
  clipSets: [
    { sandebud: rollvalClip('Ida sändebud.mp4'), rapportor: rollvalClip('Ossian rapportör.mp4') },
    { sandebud: rollvalClip('Jakob Sändebud.mp4'), rapportor: rollvalClip('Mary rapportör.mp4') },
  ],
}

/** Textlager (overlay.json) per klippset, parallellt med ROLLVAL.clipSets — undertexten på de textfria klippen. */
export const ROLLVAL_OVERLAY_SETS: Array<Record<string, OverlayData | null>> = [
  { sandebud: clipOverlay('Ida sändebud.mp4'), rapportor: clipOverlay('Ossian rapportör.mp4') },
  { sandebud: clipOverlay('Jakob Sändebud.mp4'), rapportor: clipOverlay('Mary rapportör.mp4') },
]
/** Rollvalsporträtt per klippset (personen som spelar rollen i setet), parallellt med ROLLVAL.clipSets. */
export const ROLLVAL_PORTRATT_SETS: Array<Record<string, string>> = [
  { sandebud: clipPortratt('Ida sändebud.mp4'), rapportor: clipPortratt('Ossian rapportör.mp4') },
  { sandebud: clipPortratt('Jakob Sändebud.mp4'), rapportor: clipPortratt('Mary rapportör.mp4') },
]

/* ------------------------------------------------------------------ *
 * ENTRÉN (station-kit/entre, gemensam för st1–3): attract med testgrupp +
 * sidindelning → rollval-klippen → valet (person för person / RFID) →
 * placering → "Så här blev det" (3D). XY-PLATSER (2026-11-18): sidan = STARTSIDAN = laget
 * (sida A = lag1 vänster, sida B = lag2 höger, EN NUC); rollerna fördelas INOM varje sida —
 * minst 1 sändebud + 1 rapportör per sida, resten efter önskemål.
 * Röstläge: styrs av BANDLOST (ovan); voteMode gäller bara om BANDLOST inte skickas in. ?rost=rfid|skarm går före.
 * ------------------------------------------------------------------ */

export const ENTRE: EntreConfig = {
  stationTitle: 'Förhandlingen',
  roles: [
    { letter: 'A', rollvalRoleId: 'sandebud', name: 'Sändebud', min: 1, plats: 'sandebud' },
    { letter: 'B', rollvalRoleId: 'rapportor', name: 'Rapportör', min: 1, plats: 'rapportor' },
  ],
  sides: {
    A: { id: 'A', label: '' },
    B: { id: 'B', label: '' },
  },
  placement: 'roll-inom-sida',
  station3d: 'forh',
  voteMode: 'skarm',
  /** 3D-översikten från three.js-tråden (xy-entre-3d → public/entre/). Saknas → 2D-vyn. */
  illustrationUrl: `${import.meta.env.BASE_URL}entre/sidor-3d.html`,
  /** Attract-bilden bakom "Ställ er på rätt sida" (Josef 2026-11-19: st1-a, lockin-luckorna; xy-produktion/attract/ut/). En per station.
   *  Saknas filen → ingen bild. */
  attractBild: asset('attract/forhandlingen-lockin.jpg'),
  /** Stationsintrot (hype-klipp ~5–6 s) efter "Ställ er på rätt sida". Saknas filen → hoppas över. */
  introClip: `${import.meta.env.BASE_URL}media/stationsintro/forhandlingen.mp4`,
  /** Rollsekvensen efter introt (inga klick): brygga → kort A → klipp A → brygga → kort B → klipp B → valet.
   *  Rollnamn/valvfärg enligt station-kit/stationsintro/README.md (Josef 2026-11-19). */
  rollkort: { A: 'SÄNDEBUD', B: 'RAPPORTÖR', valvfarg: '#7ad14f', sprak: config.lang === 'no' ? 'no' : 'sv' },
  /** Båda skärmarna (sida A + B på samma NUC) väntar in varandra och spelar introt + rollsekvensen i takt (Josef 2026-11-20). */
  synkIntro: true,
  clips: ROLLVAL_ENABLED,
  clipSet: ROLLVAL_START_SET,
  clipSetCount: ROLLVAL.clipSets.length,
  /** DB:ns set_id per klippset-index (SOM.md "Klippset per grupp"): set 0 = Ida (kvinna) sändebud/A + Ossian rapportör → kvinnlig A = DB set 1 (st1 A); set 1 = Jakob sändebud + Mary (kvinna) rapportör/B → DB set 2 (st1 B). */
  clipSetIds: [1, 2],
  pilotRoster: [
    { band_id: 'PILOT01', name: 'Liam', gender: 'man' },
    { band_id: 'PILOT02', name: 'Jonna', gender: 'kvinna' },
    { band_id: 'PILOT03', name: 'Andreas', gender: 'man' },
    { band_id: 'PILOT04', name: 'Maja', gender: 'kvinna' },
    { band_id: 'PILOT05', name: 'Omar', gender: 'man' },
    { band_id: 'PILOT06', name: 'Saga', gender: 'kvinna' },
  ],
}

/** Sida (entrén) ↔ lag (spelet). */
export const SIDE_TO_TEAM = { A: 'lag1', B: 'lag2' } as const
