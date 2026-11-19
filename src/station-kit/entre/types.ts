/**
 * Entrén — stationens gemensamma första-lager (Lager A, IDENTISK i alla X&Y-stationer).
 *
 *   ATTRACT  "STÄLL ER PÅ RÄTT SIDA" (Ankomst.vue): tredelad sida A | stationen | sida B med namnen
 *            per fast startsida (entre-v2 2026-11-19: ersätter den gamla förskärmen + ankomst-steget)
 *   INTRO    stationens hype-klipp ~5–6 s (config.introClip), hoppas över om filen saknas / vid tryck
 *   ROLLVAL  rollval/RoleSelect.vue: intro → klipp roll A → klipp roll B
 *   VALET    en bild per roll sida vid sida (roll A vänster, roll B höger)
 *              skärm: en person i taget — JÄTTESTORT namn → "Vilken roll vill du ha?"
 *              rfid:  station<N>/rfidnej = vänster bild (roll A), station<N>/rfidja = höger (roll B)
 *   UTFALL   ledarskärmen placerar (kapacitet per station) → 3D (lage=platser) namn + titel + plats
 *   (klar)   appens eget flöde: tutorial → skarp → done → lek (rotationen)
 *
 * Kontrakt: xy-rigg/SOM.md (`station<N>/group` med gender, rfidja/rfidnej-tillägget 2026-11-17).
 * Modulen beror INTE på appens @/config — allt kommer in via EntreConfig/EntreOptions,
 * så filerna kan kopieras byte-identiskt mellan stationsrepona.
 *
 * PLATSER (xy-arkitektur/XY-PLATSER.md, Josefs beslut 2026-11-18):
 *  - STARTSIDA A/B = gruppens fasta halvor (3+3), samma vid alla stationer (seed session:grupp,
 *    eller medlemmens `startsida` från klasslista-importen). Där man står vid ankomsten och ser klippen.
 *  - ROLLPLATS = var man står efter valet. Två modeller (`placement`):
 *      'roll-ar-sida'   rollen ÄR sidan (Människotestet A=lurar max 3 / B=lögndetektorn;
 *                       Undersökningen A=labb / B=fält med underroller skannare, lyspenna, logggranskare)
 *      'roll-inom-sida' sidan = startsidan (lag A / lag B), rollerna fördelas inom varje sida
 *                       (Förhandlingen: minst 1 sändebud + 1 rapportör per sida)
 *  - 6 personer = alltid 3 per rollsida. Annars följs önskemålen så långt reglerna (min/max) tillåter;
 *    överskott slumpas. Önskemålet (`chosen_role`) sparas ALLTID oförändrat.
 *
 * Reaktorkärnan (stresstestet, st4) — INTE inkopplad än (byggs efter Borlänge); zonerna heter efter
 * rollen (Pulsvakt, Gyro, Fälttekniker) och modellen behöver en tredje zon — se XY-PLATSER.
 * OBS: results.assigned_role är ENUM('A','B') — underrollen (sub_role) får inte plats i DB:n.
 */

/** Roll-bokstav i X&Y-resultatet (DB: results.chosen_role / assigned_role = ENUM('A','B')). */
export type RoleLetter = 'A' | 'B'
/** Stationens sida (startsida eller rollsida). */
export type SideId = RoleLetter

/** Hur gruppen röstar. */
export type VoteMode = 'skarm' | 'rfid'

/** Kön normaliserat för sidindelningen: m = kille, f = tjej, x = annat/okänt. */
export type GenderKey = 'm' | 'f' | 'x'

/** En medlem i testgruppen (station<N>/group members[] eller pilot-roster). */
export interface EntreMember {
  /** = bandets UID (hex VERSALER), samma som participants.band_id. */
  band_id: string
  name: string
  /** participants.gender: 'man' | 'kvinna' | 'vill_ej_ange' (tål även kille/tjej/m/f). */
  gender?: string | null
  /** Fast startsida från klasslista-importen (går före den seedade indelningen). */
  startsida?: SideId | null
  /** Samma sak som regi skickar den (SOM: station<N>/group members[].halva). Normaliseras till startsida. */
  halva?: SideId | null
}

/** En underroll inom en roll (slumpas). Fasta platser först i ordning, sedan `rest`-underrollen. */
export interface EntreSubRole {
  id: string
  /** Titel på namnskylten/utfallet, t.ex. "Skannare". */
  name: string
  /** Antal platser (t.ex. 1 skannare). Utelämnad = tar resten. */
  count?: number
  /** 3D-plats-id (xy-entre-3d/README), t.ex. 'B.skannare'. */
  plats?: string
}

/** En av stationens två roller. Ordningen i EntreConfig.roles = [roll A, roll B]. */
export interface EntreRole {
  letter: RoleLetter
  /** Rollvalets roll-id (nyckel i RollvalConfig.roles / klippseten). */
  rollvalRoleId: string
  /** Visningsnamn i valet/utfallet (oftast rollvalets namn, t.ex. "Sändebud"). */
  name: string
  /** Kort rad under namnet på rollbilden. */
  tagline?: string
  /** Rollbild (url). Saknas → stillbild ur rollens klipp i aktivt klippset. */
  image?: string
  /** Titel på namnskylten (default = name), t.ex. "Labbtekniker". */
  titel?: string
  /** Minsta antal ('roll-ar-sida': totalt; 'roll-inom-sida': per sida, om sidan har plats). */
  min?: number
  /** Högsta antal (t.ex. Människotestets 3 telefonlurar). */
  max?: number
  /** 3D-plats-id. 'roll-ar-sida': fullt id ('A.lur'); 'roll-inom-sida': utan sida ('sandebud' → 'A.sandebud'). */
  plats?: string
  /** Underroller (slumpas inom rollen). */
  subRoles?: EntreSubRole[]
}

/** Vad stationens sida heter i spelet (t.ex. "Labbtekniker", "Lögndetektorn"). */
export interface EntreSideInfo {
  id: SideId
  /** Visas i utfallet: "gå till sida B · Lögndetektorn". */
  label?: string
}

/** Stationens entré-data (bor i stationens config.ts). */
export interface EntreConfig {
  stationTitle: string
  /** [roll A, roll B] — roll A ritas till VÄNSTER, roll B till HÖGER (= NEJ- resp. JA-läsaren). */
  roles: [EntreRole, EntreRole]
  /** Sidornas spel-namn. */
  sides?: Partial<Record<SideId, EntreSideInfo>>
  /** Placeringsmodell (se ovan). Default 'roll-ar-sida'. */
  placement?: 'roll-ar-sida' | 'roll-inom-sida'
  /** 3D-stationsmodell i xy-entre-3d: 'forh' | 'minne' | 'unders'. */
  station3d?: string
  /** Röstläge innan ?rost= / facilitator-växeln. Default 'skarm'. */
  voteMode?: VoteMode
  /** Visa rollvalets klipp (RoleSelect) före valet. */
  clips?: boolean
  /** Aktivt klippset: fast index, eller 'alternate' = växla per körning (sparas i localStorage). */
  clipSet?: number | 'alternate'
  /** Antal klippset (för 'alternate'). */
  clipSetCount?: number
  /**
   * DB:ns set_id (datasets, 1-baserat) för varje klippset-index i ROLLVAL.clipSets. Default [1, 2, …].
   * När regi skickar gruppens set_id (station<N>/group, SOM.md "Klippset per grupp") spelas det klippset
   * vars id matchar — då visar skärm och DB alltid samma set. Ska följa vem som syns i klippen
   * (rollen som presentation_sets kallar kvinnlig spelas av en kvinna).
   */
  clipSetIds?: number[]
  /** Grupp när regi inte skickat någon (pilot / manuellt gruppval). */
  pilotRoster: EntreMember[]
  /** Raden om att man inte säkert får rollen man väljer. */
  notGuaranteed?: string
  /** 3D-bilden (xy-entre-3d `sidor-3d.html`; kontrakt i dess README: a/b, me, station, lage, figurer).
   *  Saknas sidan → 2D-vyn. */
  illustrationUrl?: string
  /**
   * STATIONSINTRO (hype-klipp ~5–6 s) som spelas när gruppen tryckt på "Ställ er på rätt sida",
   * före rollvalet. Konvention: `<BASE_URL>media/stationsintro/<station>.mp4` (H.264/AAC, 1920×1080).
   * Saknas filen (eller fältet) hoppas introt över. Ett tryck hoppar över det.
   */
  introClip?: string
  /**
   * ROLLSEKVENSEN efter introt (Josef 2026-11-19, inga klick): brygga1 → kort A → rollklipp A → brygga2 →
   * kort B → rollklipp B → valet (entre/RollSekvens.vue + station-kit/stationsintro/BryggKort.vue).
   * Saknas → rollvalets gamla klippsteg (RoleSelect clipsOnly). Kräver clips !== false.
   */
  /**
   * Attract-bild bakom "Ställ er på rätt sida" (xy-produktion/attract, 1920×1080, mörka sidor + tomt band upptill).
   * Per NUC/sida väljs i stationens config (st2: Människotestet = valvdörren, Lögndetektorn = konsolen).
   * Saknas → ingen bild (som förut).
   */
  attractBild?: string | null
  rollkort?: {
    /** Rollnamnen på korten, [roll A, roll B] (t.ex. "Labbtekniker", "Forensiker"). */
    A: string
    B: string
    /** Valvfärgen på tejpen (SYV-låsningen), t.ex. '#4aa3ff'. */
    valvfarg?: string
    sprak?: 'sv' | 'no'
  }
}

/** En person efter entrén — det appen får (`personer[]`). */
export interface EntrePerson {
  band_id: string
  name: string
  gender: string | null
  /** Rollsidan personen står på under stationen (efter placeringen). */
  side: SideId | null
  /** Startsidan (fasta halvan vid ankomsten, där man röstade). */
  vote_side: SideId | null
  /** Önskemålet, oförändrat. null = valde inte (facilitatorns "Lotta nu"). */
  chosen_role: RoleLetter | null
  /** Rollen efter placeringen. */
  assigned_role: RoleLetter
  /** Underroll (t.ex. 'skannare'), annars null. */
  sub_role: string | null
  /** 3D-plats-id (xy-entre-3d), t.ex. 'A.sandebud'. */
  plats: string | null
  /** Titel på namnskylten, t.ex. "Sändebud". */
  titel: string
}

/** Minimal MQTT-yta (mqtt.js-klienten uppfyller den; injicerbar i test). */
export interface EntreMqttClient {
  subscribe(topic: string): unknown
  on(event: 'message', cb: (topic: string, payload: { toString(): string }) => void): unknown
  end?(force?: boolean): unknown
}

/** Skärm↔skärm-synk (station-kit/adapters/transport/Transport uppfyller den). */
export interface EntreTransport {
  send(msg: { kind: string; payload: unknown }): void
  subscribe(handler: (msg: { kind: string; payload: unknown }) => void): () => void
}

export interface EntreOptions {
  stationN: number
  config: EntreConfig
  /** Broker (WebSocket) för rfidja/rfidnej. Tom → rfid-läget får inga bipp. */
  mqttUrl?: string
  /**
   * Bandlöst läge (station-kit/band, v49): true → rollvalet på skärmen, false → läsarna (rfid).
   * Utelämnad → config.voteMode. ?rost=rfid|skarm går alltid före (en enskild skärm).
   */
  bandlost?: boolean
}
