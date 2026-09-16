import { describe, it, expect } from 'vitest'
import { reduce, initialState, hatchLights } from './gameEngine'
import type { Action } from './gameEngine'
import type { Dataset, GameState, Person, TeamId } from './types'

const dataset: Dataset = {
  id: 'test',
  kritisk_lag1: 'vatten',
  kritisk_lag2: 'medicin',
  ordning: ['metall', 'vatten', 'energi', 'medicin', 'sadesfro'],
  kapital: 100,
}

function person(band: string, team: TeamId, role: 'A' | 'B'): Person {
  return { band_id: band, team, chosen_role: role, assigned_role: role, role_presented_as: null }
}

const roster: Record<TeamId, Person[]> = {
  lag1: [person('f-a', 'lag1', 'A'), person('f-b', 'lag1', 'B')],
  lag2: [person('h-a', 'lag2', 'A'), person('h-b', 'lag2', 'B')],
}

function run(actions: Action[], from = initialState(roster)): GameState {
  return actions.reduce((s, a) => reduce(s, a), from)
}

/** Start + genomförd intro-popup → getready. */
function started(): GameState {
  return run([
    { type: 'start', dataset, negotiationSeconds: 30, getReadyFirstSeconds: 10, getReadySeconds: 10, revealSeconds: 11, now: 1000 },
    { type: 'finishReveal', now: 1000 },
  ])
}

/** En full köp-sekvens från getready. */
function buy(s: GameState, winner: TeamId, price: number, now = 2000): GameState {
  return run(
    [
      { type: 'beginNegotiation', now },
      { type: 'finishNegotiation', now },
      { type: 'chooseWinner', winner },
      { type: 'enterPrice', price },
      { type: 'confirmPurchase', now },
    ],
    s,
  )
}

/** Hoppa över en lucka från getready (ingen köpte). */
function skipHatch(s: GameState, now = 2000): GameState {
  return run(
    [
      { type: 'beginNegotiation', now },
      { type: 'finishNegotiation', now },
      { type: 'noBuy', now },
    ],
    s,
  )
}

describe('start', () => {
  it('startar med intro-popup (reveal), kapital, kritiska, ordning, aktiv lucka', () => {
    const s = run([
      { type: 'start', dataset, negotiationSeconds: 30, getReadyFirstSeconds: 10, getReadySeconds: 10, revealSeconds: 11, now: 1000 },
    ])
    expect(s.phase).toBe('bidding')
    expect(s.step).toBe('reveal')
    expect(s.capital).toEqual({ lag1: 100, lag2: 100 })
    expect(s.critical).toEqual({ lag1: 'vatten', lag2: 'medicin' })
    expect(s.currentHatch).toBe(0)
    expect(s.hatchTimerEndsAt).toBe(1000 + 11 * 1000) // revealSeconds
    expect(hatchLights(s)[0]).toEqual({ hatch: 1, state: 'active', winner: null })
  })

  it('finishReveal → getready med 10 s-nedräkning', () => {
    const s = started()
    expect(s.step).toBe('getready')
    expect(s.hatchTimerEndsAt).toBe(1000 + 10 * 1000)
  })

  it('beginNegotiation startar 30 s-timern', () => {
    const s = reduce(started(), { type: 'beginNegotiation', now: 12000 })
    expect(s.step).toBe('negotiating')
    expect(s.hatchTimerEndsAt).toBe(12000 + 30 * 1000)
  })
})

describe('stegvis avräkning', () => {
  it('KLAR → vem vann → slutpris → bekräfta drar kapital och tänder nästa lucka', () => {
    let s = reduce(started(), { type: 'beginNegotiation', now: 1200 })

    s = reduce(s, { type: 'finishNegotiation', now: 1500 })
    expect(s.step).toBe('entry_winner')
    expect(s.entryTeam).toBeTruthy() // slumpad rapportör
    expect(s.hatchTimerEndsAt).toBeNull() // timern stannar under avräkning

    s = reduce(s, { type: 'chooseWinner', winner: 'lag1' })
    expect(s.step).toBe('entry_price')
    expect(s.draftWinner).toBe('lag1')

    s = reduce(s, { type: 'enterPrice', price: 30 })
    expect(s.step).toBe('confirm')
    expect(s.pending).toMatchObject({ winner: 'lag1', price: 30, hatch: 1 })
    expect(s.capital.lag1).toBe(100) // ej draget innan bekräftelse

    s = reduce(s, { type: 'confirmPurchase', now: 5000 })
    expect(s.capital.lag1).toBe(70)
    expect(s.results[0]).toEqual({ resource: 'metall', winner: 'lag1', price: 30 })
    expect(s.currentHatch).toBe(1)
    expect(s.step).toBe('getready') // nästa lucka börjar med nedräkning
    expect(s.hatchTimerEndsAt).toBe(5000 + 10 * 1000) // getready-timern startar EFTER bekräftelse
    expect(hatchLights(s)[0]).toEqual({ hatch: 1, state: 'won', winner: 'lag1' })
    expect(hatchLights(s)[1].state).toBe('active')
  })

  it('"nej, ändra" tar tillbaka till "vem vann" utan att dra kapital', () => {
    let s = reduce(started(), { type: 'beginNegotiation', now: 1200 })
    s = run(
      [
        { type: 'finishNegotiation', now: 1500 },
        { type: 'chooseWinner', winner: 'lag1' },
        { type: 'enterPrice', price: 30 },
        { type: 'cancelEntry' },
      ],
      s,
    )
    expect(s.step).toBe('entry_winner')
    expect(s.pending).toBeNull()
    expect(s.draftWinner).toBeNull()
    expect(s.capital.lag1).toBe(100)
    expect(s.currentHatch).toBe(0)
  })

  it('avvisar slutpris som överstiger vinnarens kapital', () => {
    let s = reduce(started(), { type: 'beginNegotiation', now: 1200 })
    s = run(
      [
        { type: 'finishNegotiation', now: 1500 },
        { type: 'chooseWinner', winner: 'lag1' },
        { type: 'enterPrice', price: 200 },
      ],
      s,
    )
    expect(s.step).toBe('entry_price')
    expect(s.pending).toBeNull()
  })

  it('"ingen köpte" markerar luckan och går vidare', () => {
    const s = skipHatch(started(), 1600)
    expect(s.results[0]).toEqual({ resource: 'metall', winner: null, price: 0 })
    expect(s.currentHatch).toBe(1)
    expect(s.step).toBe('getready')
  })

  it('finishNegotiation alternerar inmatande lag', () => {
    let s = reduce(started(), { type: 'beginNegotiation', now: 1200 })
    s = reduce(s, { type: 'finishNegotiation', now: 1500 })
    const first = s.entryTeam
    s = reduce(s, { type: 'noBuy', now: 1600 })
    s = reduce(s, { type: 'beginNegotiation', now: 1650 })
    s = reduce(s, { type: 'finishNegotiation', now: 1700 })
    expect(s.entryTeam).not.toBe(first) // varannan gång
  })
})

describe('fasövergångar', () => {
  it('efter 5 luckor → gissningsfas', () => {
    let s = started()
    for (let i = 0; i < 5; i++) s = skipHatch(s, 1000 + i)
    expect(s.phase).toBe('guessing')
    expect(s.hatchTimerEndsAt).toBeNull()
  })

  it('båda gissningar → reveal', () => {
    let s = started()
    for (let i = 0; i < 5; i++) s = skipHatch(s, i)
    s = reduce(s, { type: 'submitGuess', team: 'lag1', resource: 'medicin' })
    expect(s.phase).toBe('guessing')
    s = reduce(s, { type: 'submitGuess', team: 'lag2', resource: 'vatten' })
    expect(s.phase).toBe('reveal')
  })
})

describe('sync (snapshot)', () => {
  it('adopterar högre version, ignorerar lägre', () => {
    const a = buy(started(), 'lag1', 10)
    const older = initialState(roster)
    expect(reduce(older, { type: 'sync', state: a }).version).toBe(a.version)
    expect(reduce(a, { type: 'sync', state: older }).version).toBe(a.version)
  })
})

describe('roster', () => {
  it('kommer rakt in i intro med lagen redan satta', () => {
    const s = initialState(roster)
    expect(s.phase).toBe('intro')
    expect(s.members.lag1).toHaveLength(2)
    expect(s.members.lag2).toHaveLength(2)
  })
})
