/**
 * Entrén — stationens gemensamma första-lager (Lager A, IDENTISK i alla X&Y-stationer).
 *
 *   ATTRACT  "Testgrupp X · runda Y — tryck för att börja" (+ sidindelning i skärm-läge)
 *   ROLLVAL  rollval/RoleSelect.vue: intro → klipp roll A → klipp roll B
 *   VALET    en bild per roll sida vid sida (roll A vänster, roll B höger)
 *              skärm: en person i taget — JÄTTESTORT namn → "Vilken roll vill du ha?"
 *              rfid:  station<N>/rfidnej = vänster bild (roll A), station<N>/rfidja = höger (roll B)
 *   UTFALL   ledarskärmen ombalanserar/lottar → "Liam → Sändebud → gå till sida B"
 *   (klar)   appens eget flöde: tutorial → skarp → done → lek (rotationen)
 *
 * Kontrakt: xy-rigg/SOM.md (`station<N>/group` med gender, rfidja/rfidnej-tillägget 2026-11-17).
 * Modulen beror INTE på appens @/config — allt kommer in via EntreConfig/EntreOptions,
 * så filerna kan kopieras byte-identiskt mellan stationsrepona.
 *
 * SIDA = ROLL, fast per station: den som får roll A går till sida A, roll B → sida B.
 * Underroller (stresstestet) lottas inom sin roll och kan ha en egen sida.
 *
 * Reaktorkärnan (stresstestet, st4) — INTE inkopplad än; så här ser dess roller ut
 * när Josef kopplar in den (en NUC; config anger vilken sida som är pulsvakt/gyrostav):
 *   roles: [
 *     { letter: 'A', rollvalRoleId: 'drifttekniker', name: 'Drifttekniker', weight: 2, side: null },
 *     { letter: 'B', rollvalRoleId: 'expeditionsledare', name: 'Expeditionsledare', weight: 4,
 *       subRoles: [ { id: 'pulsvakt', name: 'Pulsvakt', weight: 2, side: 'A' },
 *                   { id: 'gyrostav', name: 'Gyrostav', weight: 2, side: 'B' } ] },
 *   ]
 * OBS: results.assigned_role är ENUM('A','B') — underrollen (sub_role) får inte plats i DB:n.
 */

/** Roll-bokstav i X&Y-resultatet (DB: results.chosen_role / assigned_role = ENUM('A','B')). */
export type RoleLetter = 'A' | 'B'
/** Stationens sida. Sida = roll → samma bokstav. */
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
}

/** En underroll med egna platser (lottas inom huvudrollen). Bara stresstestet än så länge. */
export interface EntreSubRole {
  id: string
  name: string
  /** Platser i en 6-personersgrupp; skalas för andra gruppstorlekar. */
  weight: number
  /** Sidan den här underrollen står på (om den har en egen sida). */
  side?: SideId
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
  /** Platser i en 6-personersgrupp (default 3). Skalas för andra storlekar. */
  weight?: number
  /** Underroller (lottas vidare inom rollen). */
  subRoles?: EntreSubRole[]
  /** Sidan rollen står på (default = letter). null = ingen egen sida (t.ex. underrollerna har sidorna). */
  side?: SideId | null
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
  /** Röstläge innan ?rost= / facilitator-växeln. Default 'skarm'. */
  voteMode?: VoteMode
  /** Visa rollvalets klipp (RoleSelect) före valet. */
  clips?: boolean
  /** Aktivt klippset: fast index, eller 'alternate' = växla per körning (sparas i localStorage). */
  clipSet?: number | 'alternate'
  /** Antal klippset (för 'alternate'). */
  clipSetCount?: number
  /** Grupp när regi inte skickat någon (pilot / manuellt gruppval). */
  pilotRoster: EntreMember[]
  /** Raden om att man inte säkert får rollen man väljer. */
  notGuaranteed?: string
  /** 3D-översikten (three.js-sidan `sidor-3d.html`, kontrakt: ?a=&b=&me=&la=&lb= / postMessage 'xy-sidor').
   *  Saknas sidan → 2D-illustrationen i utfallet. */
  illustrationUrl?: string
}

/** En person efter entrén — det appen får (`personer[]`). */
export interface EntrePerson {
  band_id: string
  name: string
  gender: string | null
  /** Sidan personen ska till under stationen (efter ombalanseringen). null = ingen egen sida. */
  side: SideId | null
  /** Sidan personen röstade på i skärm-läget (sidindelningen); null i rfid-läget. */
  vote_side: SideId | null
  /** Vad personen valde. null = valde inte (lottades). */
  chosen_role: RoleLetter | null
  /** Rollen efter ombalanseringen. */
  assigned_role: RoleLetter
  /** Underroll efter lottningen inom rollen (stresstestet), annars null. */
  sub_role: string | null
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
}
