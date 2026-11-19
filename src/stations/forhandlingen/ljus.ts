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
 * Kanon-ljud med egen fil i public/Sound/sfx/ — P1–P6 i XY-FEEDBACK-LJUS-LJUD §8 plus
 * `resultat` (d10-klar-resultat). Källa: xy-simulator/media/ljud/xy-ljud/sfx/feedback/
 * (README där: prompt, längd, LUFS). `neutral` = l9 finns redan som Sfx 'positive'.
 */
export const LJUD_FIL: Partial<Record<LjudNamn, string>> = {
  inom: 'sfx-inom.mp3',
  over: 'sfx-over.mp3',
  forlust: 'sfx-forlust.mp3',
  klar: 'sfx-klar-lek.mp3',
  sista: 'sfx-sista.mp3',
  stanger: 'sfx-stanger.mp3',
  resultat: 'sfx-resultat.mp3',
}

/** Kanon-ljud → appens Sfx (för ljud med LJUD_FIL: reserv om filen inte kan spelas). */
export const LJUD_TILL_SFX: Record<LjudNamn, Sfx> = {
  kvitto: 'bipstart',
  'kvitto-fel': 'deny',
  ratt: 'confirm',
  fel: 'deny',
  inom: 'confirm',
  over: 'deny',
  varning: 'tick',
  sista: 'tickfinal',
  start: 'live',
  vinst: 'win',
  forlust: 'nobuy',
  neutral: 'positive', // = l9-stinger-neutral
  klar: 'positive',
  resultat: 'popup',
  oppnar: 'hatch',
  stanger: 'deny',
}

const filer = new Map<string, HTMLAudioElement>()

/** Spela en fil ur public/Sound/sfx/ på motorns volym; nekas/saknas den → reserv-Sfx. */
function spelaFil(fil: string, reserv: Sfx): void {
  if (audio.muted) return
  try {
    let el = filer.get(fil)
    if (!el) {
      el = new Audio(import.meta.env.BASE_URL + 'Sound/sfx/' + fil)
      el.preload = 'auto'
      filer.set(fil, el)
    }
    const kopia = el.cloneNode() as HTMLAudioElement
    kopia.volume = audio.volume
    const p = kopia.play()
    if (p) p.catch(() => audio.play(reserv))
  } catch {
    audio.play(reserv)
  }
}

/** Spela ett kanon-ljud lokalt i det här fönstret (egen fil om den finns, annars Sfx). */
export function spela(ljud: LjudNamn): void {
  const fil = LJUD_FIL[ljud]
  if (fil) spelaFil(fil, LJUD_TILL_SFX[ljud])
  else audio.play(LJUD_TILL_SFX[ljud])
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
