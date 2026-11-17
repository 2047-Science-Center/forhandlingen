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

import type { Dataset, Person, TeamId } from './stations/forhandlingen/engine/types'
import type { RollvalConfig } from './station-kit/rollval/types'
import type { EntreConfig } from './station-kit/entre/types'

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

  /** Sekunder per förhandling. Timern är knuten till VARJE lucka och räknar
   *  ner från detta; ingen total tid. null = ingen timer (spela för hand). */
  negotiationSeconds: 30,

  /** "Gör er redo"-nedräkning (s) innan varje förhandling startar. */
  getReadySeconds: 10,

  /** Intro-popup innan första luckan: kritisk resurs (~5 s) → flyger → pengar
   *  (~5 s). Totala längden i sekunder (kritisk + flyg + pengar). */
  revealSeconds: 11,

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
 * Trial-omgången (§7): hela aktiviteten med 3 resurser och 60 kr, spelas
 * tvåsidigt mot motparten. Leder in i skarpt spel (5 resurser, 100 kr).
 */
export const TRIAL_DATASET: Dataset = {
  id: 'trial',
  kritisk_lag1: 'insulin',
  kritisk_lag2: 'membranfilter',
  ordning: ['styrkort', 'insulin', 'membranfilter'],
  kapital: 60,
}

/** Test 1: förhandla om EN resurs (styrkort), 50 kr per valv. */
export const TEST1_DATASET: Dataset = {
  id: 'test1',
  kritisk_lag1: 'styrkort',
  kritisk_lag2: 'styrkort',
  ordning: ['styrkort'],
  kapital: 50,
}

/** Alla dataset som store.start kan slå upp (test + trial + skarpa). */
export const ALL_DATASETS: Dataset[] = [TEST1_DATASET, TRIAL_DATASET, ...DATASETS]

/**
 * Per-omgångs-tider (sekunder). getReadyFirst = nedräkning före FÖRSTA
 * förhandlingen; getReady = mellan varje därefter; negotiation = tidsgräns per
 * förhandling.
 */
export const ROUND_TIMERS = {
  test1: { getReadyFirst: 5, getReady: 5, negotiation: 15 },
  test2: { getReadyFirst: 5, getReady: 5, negotiation: 30 },
  live: { getReadyFirst: 10, getReady: 5, negotiation: 30 },
} as const

/**
 * Hoppa över Test 1 (öva-att-buda-omgången). Den förvirrade mer än den hjälpte
 * i test — sekvensen går då block1 → block2 direkt. Sätt false för att få
 * tillbaka den.
 */
export const SKIP_TEST1 = true

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
 * Intro-klippet (Ljud 1 + foton + undertext). Ljud + .vtt + cue-tidslinje är
 * per språk. Foton och ljud ligger i public/. Undertexten (.vtt) släpps in av
 * Josef i public/subtitles/ — saknas den visas ingen text (renderaren är tålig).
 */
export const INTRO_MEDIA = {
  audio: asset('/Sound/Ljud 1.mp3'),
  subtitles: asset('/subtitles/sv.vtt'),
  /** Foto-url för Bild N (1..10). Filnamn har mellanslag → encodeURI. */
  photo: (n: number) => asset(`/assets/Bild ${n}.png`),
} as const

/**
 * Lagen. Rollval/uppdelning sker UPPSTRÖMS i riggen — vi kommer rakt in i
 * dashboarden med lagen redan satta. Namn = A / B (visas som LAG A / LAG B).
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

/** vänster/höger-sida (för förhandlingsdemons talarmarkering). */
export const TEAM_SIDE: Record<TeamId, 'vanster' | 'hoger'> = {
  lag1: 'vanster', // sida A
  lag2: 'hoger', // sida B
}

/**
 * Deltagarnamn som visas på öppningens deltagarskärm. Mockup i piloten —
 * kommer från RFID-inloggningen i drift. Frikopplat från spelmotorns `members`
 * (som är 2 per lag: sändebud/rapportör), så antalet kan skilja.
 */
export const TEAM_PARTICIPANTS: Record<TeamId, string[]> = {
  lag1: ['Alva', 'Noah', 'Iris'],
  lag2: ['Ebba', 'Hugo', 'Milo'],
}

/**
 * SÖM: de incheckade deltagarna vid stationen (hela gruppen, båda valven).
 *
 * Används av väntläget (F1 "Vem sa det?") som namnlista. IDAG returnerar den
 * pilot-platshållarna i `TEAM_PARTICIPANTS` (båda valven ihop, ~6 namn). När
 * den riktiga incheckningen finns: byt BARA innehållet i den här funktionen
 * (t.ex. läs från identitetstjänsten/RFID-inloggningen) — allt UI och all
 * logik utgår från den och behöver inte röras. Returnerar unika, icke-tomma
 * namn i stabil ordning (sida A först, sedan B).
 */
export function checkedInParticipants(): string[] {
  const all = [...TEAM_PARTICIPANTS.lag1, ...TEAM_PARTICIPANTS.lag2]
  return all.map((n) => n.trim()).filter((n, i, a) => n.length > 0 && a.indexOf(n) === i)
}

/** Deterministisk pilot-roster (delas av alla fönster). */
export function defaultRoster(): Record<TeamId, Person[]> {
  return {
    lag1: TEAMS.lag1.members.map((m) => ({ ...m })),
    lag2: TEAMS.lag2.members.map((m) => ({ ...m })),
  }
}

/**
 * Riggens fulla rollflöde (två rollklipp → hemligt A/B-val → könskodad
 * presentation → ombalansering). Sker uppströms i riggen; här är rollerna
 * redan satta. Datamodellen bär ändå fälten från början.
 */
export const ROLE_FLOW_ENABLED = false

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

/* ------------------------------------------------------------------ *
 * ENTRÉN (station-kit/entre, gemensam för st1–3): attract med testgrupp +
 * sidindelning → rollval-klippen → valet (person för person / RFID) →
 * ombalansering → "gå till sida A/B". SIDA = ROLL, fast här (EN NUC, båda sidorna):
 *   sida A = lag1 (vänster) = Sändebud
 *   sida B = lag2 (höger)   = Rapportör
 * Röstläge: 'skarm' tills banden finns; ?rost=rfid|skarm i URL:en går före.
 * ------------------------------------------------------------------ */

export const ENTRE: EntreConfig = {
  stationTitle: 'Förhandlingen',
  roles: [
    { letter: 'A', rollvalRoleId: 'sandebud', name: 'Sändebud' },
    { letter: 'B', rollvalRoleId: 'rapportor', name: 'Rapportör' },
  ],
  voteMode: 'skarm',
  /** 3D-översikten från three.js-tråden (xy-entre-3d → public/entre/). Saknas → 2D-vyn. */
  illustrationUrl: `${import.meta.env.BASE_URL}entre/sidor-3d.html`,
  clips: ROLLVAL_ENABLED,
  clipSet: ROLLVAL_START_SET,
  clipSetCount: ROLLVAL.clipSets.length,
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
