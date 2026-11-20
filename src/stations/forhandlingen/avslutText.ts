/**
 * Förhandlingens avslut (XY-RESULTAT-OCH-VINST §2.3). Ren — testbar utan Vue.
 * Lag mot lag: "SIDA A VANN!" + poängen + en mening om varför. Sidorna heter alltid
 * Sida A / Sida B (Josef 2026-11-19). Nämner aldrig sortering, valv-tilldelning eller roller.
 */
import type { TeamId } from './engine/types'
import type { TeamScore } from './engine/scoring'
import type { UtfallTyp } from '@/station-kit/resultat'

export const SIDA_NAMN: Record<TeamId, string> = { lag1: 'Sida A', lag2: 'Sida B' }

/** Vinnaren: högst lagpoäng. Lika (även 0–0) = 'draw'. */
export function vinnare(s: Record<TeamId, TeamScore>): TeamId | 'draw' {
  const a = s.lag1.teamScore
  const b = s.lag2.teamScore
  if (a === b) return 'draw'
  return a > b ? 'lag1' : 'lag2'
}

/** Ingen sida fick poäng (ingen säkrade sin livsviktiga). */
export function ingenVann(s: Record<TeamId, TeamScore>): boolean {
  return s.lag1.teamScore === 0 && s.lag2.teamScore === 0
}

const OTHER: Record<TeamId, TeamId> = { lag1: 'lag2', lag2: 'lag1' }

export function rubrik(s: Record<TeamId, TeamScore>): string {
  if (ingenVann(s)) return 'INGEN VANN'
  const v = vinnare(s)
  if (v === 'draw') return 'OAVGJORT'
  return `${SIDA_NAMN[v].toUpperCase()} VANN!`
}

/** En mening om varför det gick som det gick. */
export function varfor(s: Record<TeamId, TeamScore>): string {
  if (ingenVann(s)) return 'Ingen sida fick tag på sin livsviktiga resurs.'
  const v = vinnare(s)
  if (v === 'draw') return 'Lika många poäng — förhandlingen slutade jämnt.'
  const w = s[v]
  const l = s[OTHER[v]]
  let text = `${SIDA_NAMN[v]} säkrade sin livsviktiga resurs`
  text += w.guessedRight ? ' och gissade rätt — poängen dubblades' : ''
  text += l.securedCritical ? ` och hade ${w.teamScore - l.teamScore} poäng mer.` : `, det gjorde inte ${SIDA_NAMN[OTHER[v]]}.`
  return text
}

/** Utfallstypen i den här sidans fönster (delad vy: vinst om någon vann). */
export function utfallTypFor(s: Record<TeamId, TeamScore>, egna: TeamId[]): UtfallTyp {
  if (ingenVann(s)) return 'missat'
  const v = vinnare(s)
  if (v === 'draw') return 'oavgjort'
  return egna.includes(v) ? 'vinst' : 'oavgjort'
}
