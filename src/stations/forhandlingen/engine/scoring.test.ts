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
    { type: 'klubba', winner, price, by: winner, now: 0 },
    { type: 'commitSale', now: 0 },
  ]
}
const skip: Action[] = [
  { type: 'beginNegotiation', now: 0 },
  { type: 'finishNegotiation', now: 0 },
  { type: 'klubba', winner: null, price: 0, by: 'lag1', now: 0 },
  { type: 'commitSale', now: 0 },
]

/** lag1 köper vatten (sin kritiska) för 40 + medicin för 20; lag2 köper energi 10. */
function fullGame(): GameState {
  return run([
    { type: 'start', dataset, negotiationSeconds: null, getReadyFirstSeconds: null, getReadySeconds: null, undoSeconds: 5, guessSeconds: null, now: 0 },
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

describe('personResults — VALdi-mått (SOM.md 2026-11-20)', () => {
  it('sidan säkrade sin kritiska och gissade rätt', () => {
    let s = fullGame()
    s = reduce(s, { type: 'submitGuess', team: 'lag1', resource: 'medicin' }) // rätt
    s = reduce(s, { type: 'submitGuess', team: 'lag2', resource: 'sadesfro' })
    const pr = personResults(s)
    const a1 = pr.lag1.find((p) => p.assigned_role === 'A')!
    const b1 = pr.lag1.find((p) => p.assigned_role === 'B')!
    expect(a1.plats).toBe('sandebud')
    expect(b1.plats).toBe('rapportor')
    const want = { lagpoang: 80, sakrad: 1, gissade_ratt: 1, vunna_luckor: 2, kapital_kvar: 40 }
    expect(a1.matt).toEqual(want)
    expect(b1.matt).toEqual(want)
    // Additivt: result_value oförändrat.
    expect(a1.result_value).toBe(40)
    expect(b1.result_value).toBe(40)
    expect(a1).not.toHaveProperty('utdrag')
  })

  it('sidan säkrade inte sin kritiska och gissade fel', () => {
    let s = fullGame()
    s = reduce(s, { type: 'submitGuess', team: 'lag1', resource: 'medicin' })
    s = reduce(s, { type: 'submitGuess', team: 'lag2', resource: 'sadesfro' }) // fel (lag1:s är vatten)
    const pr = personResults(s)
    for (const p of pr.lag2) {
      expect(p.matt).toEqual({ lagpoang: 0, sakrad: 0, gissade_ratt: 0, vunna_luckor: 1, kapital_kvar: 90 })
      for (const v of Object.values(p.matt!)) expect(typeof v).toBe('number')
    }
    expect(pr.lag2.find((p) => p.assigned_role === 'B')!.result_value).toBe(0)
  })

  it('utelämnar gissade_ratt när sidan inte gissat', () => {
    const pr = personResults(fullGame())
    expect(pr.lag1[0].matt).not.toHaveProperty('gissade_ratt')
    expect(pr.lag1[0].matt).toHaveProperty('lagpoang')
  })
})
