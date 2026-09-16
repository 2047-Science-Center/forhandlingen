import { describe, it, expect } from 'vitest'
import { reduce, initialState } from './gameEngine'
import type { Action } from './gameEngine'
import { scoreTeam, scoreAll, personResults, securedCritical } from './scoring'
import type { Dataset, GameState, Person, TeamId } from './types'

const dataset: Dataset = {
  id: 'test',
  kritisk_lag1: 'vatten',
  kritisk_lag2: 'medicin',
  ordning: ['metall', 'vatten', 'energi', 'medicin', 'sadesfro'],
  kapital: 100,
}

const roster: Record<TeamId, Person[]> = {
  lag1: [
    { band_id: 'f-a', team: 'lag1', chosen_role: 'A', assigned_role: 'A', role_presented_as: null },
    { band_id: 'f-b', team: 'lag1', chosen_role: 'B', assigned_role: 'B', role_presented_as: null },
  ],
  lag2: [
    { band_id: 'h-a', team: 'lag2', chosen_role: 'A', assigned_role: 'A', role_presented_as: null },
    { band_id: 'h-b', team: 'lag2', chosen_role: 'B', assigned_role: 'B', role_presented_as: null },
  ],
}

function run(actions: Action[]): GameState {
  return actions.reduce((s, a) => reduce(s, a), initialState(roster))
}

function buy(winner: TeamId, price: number): Action[] {
  return [
    { type: 'beginNegotiation', now: 0 },
    { type: 'finishNegotiation', now: 0 },
    { type: 'chooseWinner', winner },
    { type: 'enterPrice', price },
    { type: 'confirmPurchase', now: 0 },
  ]
}
const skip: Action[] = [
  { type: 'beginNegotiation', now: 0 },
  { type: 'finishNegotiation', now: 0 },
  { type: 'noBuy', now: 0 },
]

/** lag1 köper vatten (sin kritiska) för 40 + medicin för 20; lag2 köper energi 10. */
function fullGame(): GameState {
  return run([
    { type: 'start', dataset, negotiationSeconds: null, getReadyFirstSeconds: null, getReadySeconds: null, revealSeconds: null, now: 0 },
    { type: 'finishReveal', now: 0 },
    ...skip, // metall
    ...buy('lag1', 40), // vatten (lag1:s kritiska)
    ...buy('lag2', 10), // energi
    ...buy('lag1', 20), // medicin (lag2:s kritiska)
    ...skip, // sadesfro
  ])
}

describe('securedCritical', () => {
  it('lag1 säkrade sin kritiska (vatten), lag2 inte (medicin togs av lag1)', () => {
    const s = fullGame()
    expect(securedCritical(s, 'lag1')).toBe(true)
    expect(securedCritical(s, 'lag2')).toBe(false)
  })
})

describe('scoreTeam', () => {
  it('poäng = kapital kvar utan rätt gissning', () => {
    const s = fullGame()
    expect(scoreTeam(s, 'lag1').capitalLeft).toBe(40) // 100 - 40 - 20
    expect(scoreTeam(s, 'lag1').teamScore).toBe(40)
    expect(scoreTeam(s, 'lag2').capitalLeft).toBe(90) // 100 - 10
  })

  it('rätt gissning dubblar lagets poäng', () => {
    let s = fullGame()
    s = reduce(s, { type: 'submitGuess', team: 'lag1', resource: 'medicin' }) // rätt
    s = reduce(s, { type: 'submitGuess', team: 'lag2', resource: 'sadesfro' }) // fel
    const scores = scoreAll(s)
    expect(scores.lag1.guessedRight).toBe(true)
    expect(scores.lag1.teamScore).toBe(80) // säkrad + rätt gissning → 40*2
    expect(scores.lag2.guessedRight).toBe(false)
    expect(scores.lag2.teamScore).toBe(0) // ej säkrad livsviktig → 0 poäng
  })
})

describe('personResults', () => {
  it('förhandlare får kapital kvar, rapportör teamBase vid rätt gissning; bär X&Y-fält', () => {
    let s = fullGame()
    s = reduce(s, { type: 'submitGuess', team: 'lag1', resource: 'medicin' })
    s = reduce(s, { type: 'submitGuess', team: 'lag2', resource: 'sadesfro' })
    const pr = personResults(s)
    const a1 = pr.lag1.find((p) => p.assigned_role === 'A')!
    const b1 = pr.lag1.find((p) => p.assigned_role === 'B')!
    expect(a1.result_value).toBe(40)
    expect(b1.result_value).toBe(40)
    expect(pr.lag2.find((p) => p.assigned_role === 'B')!.result_value).toBe(0)
    expect(a1).toHaveProperty('chosen_role')
    expect(a1).toHaveProperty('role_presented_as')
  })
})
