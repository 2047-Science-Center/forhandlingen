/**
 * Datamodell för Förhandlingens spelmotor. Ren TypeScript, inga UI-beroenden.
 *
 * Datamodellen bär `chosen_role`, `assigned_role`, `role_presented_as` från
 * början (A2) även om rollflödet är avstängt i piloten — så att X&Y-sömmens
 * per-person-rader (system 1 & 2) kan fyllas utan omskrivning.
 */

export type TeamId = 'lag1' | 'lag2'

/** Roll A = förhandlare (rösten), roll B = rapportör (skärmoperatör). */
export type Role = 'A' | 'B'

export type Phase =
  | 'login' // deltagare taggar band, roller tilldelas
  | 'intro' // kapital satt, kritisk visad — väntar på start av budgivning
  | 'bidding' // resurser auktioneras en i taget
  | 'guessing' // rapportörer gissar motståndarens kritiska
  | 'reveal' // avslöjande & resultat

/**
 * Steg inom budgivningen av EN lucka (ett läge i taget):
 *  - getready: "Nu ska ni förhandla om X" + kort nedräkning innan start.
 *  - negotiating: budgivning pågår (headset), nedräkning. KLAR avslutar i förtid.
 *  - klubba: BÅDA skärmarna visar samma ruta — vem fick den (A/B/ingen) + pris
 *    → KLUBBA. Den som står närmast trycker, på vilken skärm som helst.
 *  - sald: klubbat. Stämpeln syns på båda skärmarna och ÅNGRA gäller några
 *    sekunder; sedan bokförs köpet och nästa lucka öppnas.
 */
export type BiddingStep = 'getready' | 'negotiating' | 'klubba' | 'sald'

/** Ett förbestämt dataset (config). */
export interface Dataset {
  id: string
  kritisk_lag1: string
  kritisk_lag2: string
  ordning: string[] // resurs-id i auktionsordning
  kapital: number
}

/** En deltagare, kopplad till sitt eget band (A4). */
export interface Person {
  band_id: string
  /** Visningsnamn (från riggens identitet). Endast för UI — ej i §5.3-payloaden. */
  name?: string
  team: TeamId
  /** Vad personen själv valde (riggens hemliga A/B-val) — = assigned i piloten. */
  chosen_role: Role
  /** Vad personen faktiskt spelar. */
  assigned_role: Role
  /** Könskodad presentation från riggen. null i piloten (rollflöde av). */
  role_presented_as: 'manlig' | 'kvinnlig' | null
}

/** Ett klubbat köp som väntar ut ångra-fönstret. winner=null = "ingen köpte". */
export interface PendingSale {
  hatch: number // 1..5
  resource: string
  winner: TeamId | null
  price: number
  /** Skärmen (sidan) som klubbade. */
  by: TeamId
}

/** Utfall per lucka. winner=null = "ingen köpte". */
export interface HatchResult {
  resource: string
  winner: TeamId | null
  price: number
}

export interface GameState {
  phase: Phase
  datasetId: string
  capital: Record<TeamId, number>
  /** Hemlig kritisk resurs per lag (resurs-id). */
  critical: Record<TeamId, string>
  /** Auktionsordning (5 resurs-id). */
  order: string[]
  /** 0-baserat index i `order`. -1 innan start / efter sista. */
  currentHatch: number
  /** Steg inom aktuell luckas budgivning. */
  step: BiddingStep
  /** Utfall per lucka-index (0..4). */
  results: Record<number, HatchResult>
  /** Klubbat köp under ångra-fönstret (step 'sald'), annars null. */
  pending: PendingSale | null
  /** Rapportörens gissning av motståndarens kritiska (resurs-id). */
  guesses: Record<TeamId, string | null>
  /** Sekunder per förhandling (från config vid start). */
  negotiationSeconds: number | null
  /** "Gör er redo"-nedräkning innan FÖRSTA förhandlingen. */
  getReadyFirstSeconds: number | null
  /** "Gör er redo"-nedräkning mellan efterföljande förhandlingar. */
  getReadySeconds: number | null
  /** Sekunder som ÅNGRA gäller efter KLUBBA. */
  undoSeconds: number
  /** Sekunder för gissningen (null = ingen tidsgräns). */
  guessSeconds: number | null
  /** Epoch-ms när aktuell nedräkning går ut: getready, förhandling, ångra-fönstret
   *  eller gissningen. null = ingen nedräkning. */
  hatchTimerEndsAt: number | null
  members: Record<TeamId, Person[]>
  /** Ökar vid varje ändring — används för snapshot-synk (högst vinner). */
  version: number
}

/** Ljus-kontraktets luck-tillstånd (delas av ScreenLights och MqttLights). */
export type HatchLightState = 'active' | 'won' | 'off'

export interface HatchLight {
  hatch: number // 1..5
  state: HatchLightState
  winner: TeamId | null
}
