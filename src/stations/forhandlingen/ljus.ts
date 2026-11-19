/**
 * Förhandlingens koppling till station-kit/ljus (XY-FEEDBACK-LJUS-LJUD §5.1).
 *
 *  - `spela`: kanoniska ljudnamn → appens AudioEngine-Sfx.
 *  - Rena hjälpare (testbara utan Vue/MQTT): vilket fönster som är skrivare, vilka
 *    segment ett fönster/lag äger, stationens läge, tidsvarning och resultatets utfall.
 *
 * Segment: sida A = vänster (#lag1) = 'A', sida B = höger (#lag2) = 'B' (config LJUS).
 * Skrivare = ledarfönstret (lag1 eller delad vy) — samma regel som entrén/leken/idle-reset.
 * Händelser i SYNKAT state (båda fönstren ser dem) → gest bara i skrivaren; ljudet spelas
 * ändå i varje fönster (varje sida har egen högtalare/headset).
 */
import { audio, type Sfx } from '@/station-kit/audio/AudioEngine'
import type { Lage, LjudNamn } from '@/station-kit/ljus'
import type { TeamId } from './engine/types'

export type Sida = 'A' | 'B'
export type Vy = 'lag1' | 'lag2' | 'shared'

/**
 * Kanon-ljud → appens Sfx. Saknade kanon-ljud går till närmaste befintliga Sfx.
 * TODO P1–P6 i XY-FEEDBACK-LJUS-LJUD §8: inom, over, forlust, klar, sista, stanger
 * ska produceras/lyftas in — byt då fallbacken mot den nya filen.
 * (`resultat` = d10-klar-resultat och `neutral` = l9-stinger-neutral finns i xy-ljud men
 * inte i appens public/Sound/sfx än → närmaste Sfx: popup resp. nobuy.)
 */
export const LJUD_TILL_SFX: Record<LjudNamn, Sfx> = {
  kvitto: 'bipstart',
  'kvitto-fel': 'deny',
  ratt: 'confirm',
  fel: 'deny',
  inom: 'confirm', // TODO P1 (§8)
  over: 'deny', // TODO P2 (§8)
  varning: 'tick',
  sista: 'tickfinal', // TODO P5 (§8)
  start: 'live',
  vinst: 'win',
  forlust: 'nobuy', // TODO P3 (§8)
  neutral: 'nobuy',
  klar: 'positive', // TODO P4 (§8)
  resultat: 'popup',
  oppnar: 'hatch',
  stanger: 'deny', // TODO P6 (§8)
}

/** Spela ett kanon-ljud via appens ljudmotor (lokalt i det här fönstret). */
export function spela(ljud: LjudNamn): void {
  audio.play(LJUD_TILL_SFX[ljud])
}

export const SIDA_FOR_LAG: Record<TeamId, Sida> = { lag1: 'A', lag2: 'B' }

/** Ledarfönstret publicerar basen + gester för synkade händelser. */
export function arSkrivare(vy: Vy): boolean {
  return vy !== 'lag2'
}

/** Segmenten det här fönstret visar (delad vy = båda). */
export function egnaSidor(vy: Vy): Sida[] {
  return vy === 'lag1' ? ['A'] : vy === 'lag2' ? ['B'] : ['A', 'B']
}

/**
 * Stationens läge (bas). Rotationen på → dess fas/läge (lageFranRotation, skickas in).
 * Rotationen av (pilot) → appens egna faser: attract/reset = null (vila/regi),
 * entré + onboarding = tutorial, skarpt spel = skarp.
 */
export function appLage(o: {
  rotationPa: boolean
  franRotation: Lage | null
  entered: boolean
  onboarded: boolean
}): Lage | null {
  if (o.rotationPa) return o.franRotation
  if (!o.entered) return null
  return o.onboarded ? 'skarp' : 'tutorial'
}

/** Förhandlingstimern: sista 5 s → varning 2 (blink), annars 0. */
export function timerVarning(step: string, sekunderKvar: number | null): 0 | 2 {
  return step === 'negotiating' && sekunderKvar != null && sekunderKvar > 0 && sekunderKvar <= 5 ? 2 : 0
}

export interface UtfallSteg {
  utfall: 'vinst' | 'forlorarsida' | 'oavgjort'
  ids: Sida[]
}

/** Resultatets utfall per segment: vinnarsidan antänds, den andra dimmas (aldrig rött). */
export function utfallForResultat(vinnare: TeamId | 'draw'): UtfallSteg[] {
  if (vinnare === 'draw') return [{ utfall: 'oavgjort', ids: ['A', 'B'] }]
  const v = SIDA_FOR_LAG[vinnare]
  return [
    { utfall: 'vinst', ids: [v] },
    { utfall: 'forlorarsida', ids: [v === 'A' ? 'B' : 'A'] },
  ]
}

/** Ljudet i det här fönstret när vinnaren visas: egen sida vann → vinst, annars neutral. */
export function resultatLjud(vinnare: TeamId | 'draw', vy: Vy): LjudNamn {
  if (vinnare === 'draw') return 'neutral'
  return egnaSidor(vy).includes(SIDA_FOR_LAG[vinnare]) ? 'vinst' : 'neutral'
}
