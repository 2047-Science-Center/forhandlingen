/**
 * Poängberäkning — ren funktion av sluttillståndet.
 *
 * Regler (4.3):
 *  - Förhandlaren (roll A): poäng = kapital kvar ("spendera minst").
 *  - Rapportören (roll B): gissar motståndarens kritiska. Rätt gissning
 *    DUBBLAR lagets poäng.
 *  - Säkrad kritisk: laget måste ha vunnit (köpt) sin egen kritiska resurs.
 *    Säkras den inte = förlorad omgång.
 *
 * AI-rubrik / tier-bracket (system 1) läggs på SENARE — därför exponeras
 * `result_value` per person redan nu, men lämnas som enkel placeholder.
 */

import type { GameState, TeamId, Role } from './types'

export interface TeamScore {
  team: TeamId
  capitalLeft: number
  /** Gissade laget motståndarens kritiska rätt? */
  guessedRight: boolean
  /** Vann laget sin egen kritiska resurs? */
  securedCritical: boolean
  /** Lagets slutpoäng: kapital kvar, dubblat vid rätt gissning. */
  teamScore: number
}

export interface PersonResult {
  band_id: string
  chosen_role: Role
  assigned_role: Role
  role_presented_as: 'manlig' | 'kvinnlig' | null
  result_value: number
}

const OTHER: Record<TeamId, TeamId> = { lag1: 'lag2', lag2: 'lag1' }

const TEAMS: TeamId[] = ['lag1', 'lag2']

/** Vann `team` sin egen kritiska resurs i auktionen? */
export function securedCritical(state: GameState, team: TeamId): boolean {
  const crit = state.critical[team]
  return Object.values(state.results).some(
    (r) => r.winner === team && r.resource === crit,
  )
}

export function scoreTeam(state: GameState, team: TeamId): TeamScore {
  const capitalLeft = state.capital[team]
  const guessedRight = state.guesses[team] === state.critical[OTHER[team]]
  const secured = securedCritical(state, team)
  // 0 poäng om livsviktig resurs ej säkrats; annars kapital kvar, dubblat vid
  // rätt gissning.
  const teamScore = !secured ? 0 : guessedRight ? capitalLeft * 2 : capitalLeft
  return { team, capitalLeft, guessedRight, securedCritical: secured, teamScore }
}

export function scoreAll(state: GameState): Record<TeamId, TeamScore> {
  return {
    lag1: scoreTeam(state, 'lag1'),
    lag2: scoreTeam(state, 'lag2'),
  }
}

/**
 * Per-person result_value (placeholder tills system 1 kopplas):
 *  - Roll A (förhandlare): kapital kvar.
 *  - Roll B (rapportör): teamBase om rätt gissning, annars 0 (bidraget = dubblingen).
 */
export function personResults(state: GameState): Record<TeamId, PersonResult[]> {
  const out = {} as Record<TeamId, PersonResult[]>
  for (const team of TEAMS) {
    const s = scoreTeam(state, team)
    out[team] = state.members[team].map((p) => ({
      band_id: p.band_id,
      chosen_role: p.chosen_role,
      assigned_role: p.assigned_role,
      role_presented_as: p.role_presented_as,
      result_value:
        p.assigned_role === 'A'
          ? s.capitalLeft
          : s.guessedRight
            ? s.capitalLeft
            : 0,
    }))
  }
  return out
}
