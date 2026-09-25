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

export type Mode = 'pilot' | 'production'

/** Stationens nummer i riggen. Topic-namespace blir `station<N>/…`.
 *  ANTA ALDRIG ett faktiskt legacy-nummer — bekräfta mot riggen innan skarp koppling. */
export const STATION_N = 0

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

  /** MQTT/WS-adresser fylls i driftläget (miljövariabler, ej här). */
  production: {
    wsUrl: '',
    mqttUrl: '',
  },
} as const

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

// Valv Syd = vänster (lag1), Valv Nord = höger (lag2). Roll A/B (sändebud/
// rapportör) i X&Y-resultatet är oförändrat och sätts uppströms.
export const TEAMS: Record<TeamId, TeamConfig> = {
  lag1: {
    id: 'lag1',
    name: 'Syd',
    emoji: 'S',
    logo: asset('/teams/syd.png'),
    members: [
      { band_id: 'syd-a', name: 'Alva', team: 'lag1', chosen_role: 'A', assigned_role: 'A', role_presented_as: null },
      { band_id: 'syd-b', name: 'Noah', team: 'lag1', chosen_role: 'B', assigned_role: 'B', role_presented_as: null },
    ],
  },
  lag2: {
    id: 'lag2',
    name: 'Nord',
    emoji: 'N',
    logo: asset('/teams/nord.png'),
    members: [
      { band_id: 'nord-a', name: 'Ebba', team: 'lag2', chosen_role: 'A', assigned_role: 'A', role_presented_as: null },
      { band_id: 'nord-b', name: 'Hugo', team: 'lag2', chosen_role: 'B', assigned_role: 'B', role_presented_as: null },
    ],
  },
}

/** vänster/höger-sida (för förhandlingsdemons talarmarkering). */
export const TEAM_SIDE: Record<TeamId, 'vanster' | 'hoger'> = {
  lag1: 'vanster', // Valv Syd
  lag2: 'hoger', // Valv Nord
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
