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

const START: Action = {
  type: 'start',
  dataset,
  negotiationSeconds: 30,
  getReadyFirstSeconds: 10,
  getReadySeconds: 5,
  undoSeconds: 5,
  guessSeconds: 20,
  now: 1000,
}

/** Start → getready. */
function started(): GameState {
  return run([START])
}

/** Förhandling till klubb-rutan. */
function toKlubba(s: GameState, now = 2000): GameState {
  return run([{ type: 'beginNegotiation', now }, { type: 'finishNegotiation', now }], s)
}

/** En full lucka: förhandla → klubba → ångra-fönstret ute. */
function buy(s: GameState, winner: TeamId | null, price: number, now = 2000): GameState {
  return run(
    [
      { type: 'klubba', winner, price, by: 'lag2', now },
      { type: 'commitSale', now: now + 5000 },
    ],
    toKlubba(s, now),
  )
}

describe('start', () => {
  it('sätter kapital, kritiska, ordning och getready-nedräkning', () => {
    const s = started()
    expect(s.phase).toBe('bidding')
    expect(s.step).toBe('getready')
    expect(s.capital).toEqual({ lag1: 100, lag2: 100 })
    expect(s.critical).toEqual({ lag1: 'vatten', lag2: 'medicin' })
    expect(s.currentHatch).toBe(0)
    expect(s.hatchTimerEndsAt).toBe(1000 + 10 * 1000)
  })

  it('getReadyFirst null = pausad tills armGetReady', () => {
    let s = run([{ ...START, getReadyFirstSeconds: null } as Action])
    expect(s.hatchTimerEndsAt).toBeNull()
    s = reduce(s, { type: 'armGetReady', seconds: 5, now: 3000 })
    expect(s.hatchTimerEndsAt).toBe(8000)
  })
})

describe('förhandling', () => {
  it('getready → negotiating med 30 s-timer', () => {
    const s = reduce(started(), { type: 'beginNegotiation', now: 1500 })
    expect(s.step).toBe('negotiating')
    expect(s.hatchTimerEndsAt).toBe(1500 + 30 * 1000)
  })

  it('finishNegotiation → klubba utan tidsgräns', () => {
    const s = toKlubba(started())
    expect(s.step).toBe('klubba')
    expect(s.hatchTimerEndsAt).toBeNull()
  })
})

describe('Klubban', () => {
  it('klubba → sald med ångra-fönster; inget dras förrän commitSale', () => {
    let s = toKlubba(started())
    s = reduce(s, { type: 'klubba', winner: 'lag1', price: 30, by: 'lag2', now: 4000 })
    expect(s.step).toBe('sald')
    expect(s.pending).toEqual({ hatch: 1, resource: 'metall', winner: 'lag1', price: 30, by: 'lag2' })
    expect(s.hatchTimerEndsAt).toBe(4000 + 5000)
    expect(s.capital.lag1).toBe(100)
    s = reduce(s, { type: 'commitSale', now: 9000 })
    expect(s.capital.lag1).toBe(70)
    expect(s.results[0]).toEqual({ resource: 'metall', winner: 'lag1', price: 30 })
    expect(s.currentHatch).toBe(1)
    expect(s.step).toBe('getready')
    expect(s.hatchTimerEndsAt).toBe(9000 + 5000) // getReadySeconds
    expect(s.pending).toBeNull()
  })

  it('ÅNGRA → tillbaka till klubb-rutan, inget bokfört', () => {
    let s = toKlubba(started())
    s = reduce(s, { type: 'klubba', winner: 'lag1', price: 30, by: 'lag1', now: 4000 })
    s = reduce(s, { type: 'angra' })
    expect(s.step).toBe('klubba')
    expect(s.pending).toBeNull()
    expect(s.hatchTimerEndsAt).toBeNull()
    expect(s.results).toEqual({})
    expect(reduce(s, { type: 'commitSale', now: 9000 })).toBe(s) // inget att bokföra
  })

  it('ingen köpte → resultat utan vinnare, kapital orört', () => {
    const s = buy(started(), null, 40)
    expect(s.results[0]).toEqual({ resource: 'metall', winner: null, price: 0 })
    expect(s.capital).toEqual({ lag1: 100, lag2: 100 })
  })

  it('pris över vinnarens kapital eller negativt avvisas', () => {
    const s = toKlubba(started())
    expect(reduce(s, { type: 'klubba', winner: 'lag1', price: 200, by: 'lag1', now: 0 })).toBe(s)
    expect(reduce(s, { type: 'klubba', winner: 'lag1', price: -5, by: 'lag1', now: 0 })).toBe(s)
  })

  it('klubba utanför klubb-steget gör inget', () => {
    const s = started()
    expect(reduce(s, { type: 'klubba', winner: 'lag1', price: 10, by: 'lag1', now: 0 })).toBe(s)
  })

  it('luckljuset: vunna luckor won, aktiv lucka active', () => {
    const s = buy(started(), 'lag2', 10)
    const l = hatchLights(s)
    expect(l[0]).toEqual({ hatch: 1, state: 'won', winner: 'lag2' })
    expect(l[1]).toEqual({ hatch: 2, state: 'active', winner: null })
    expect(l[2].state).toBe('off')
  })
})

describe('gissningen', () => {
  function allaLuckor(): GameState {
    let s = started()
    for (let i = 0; i < 5; i++) s = buy(s, null, 0, 2000 + i)
    return s
  }

  it('efter 5 luckor → gissning med 20 s-timer', () => {
    const s = allaLuckor()
    expect(s.phase).toBe('guessing')
    expect(s.hatchTimerEndsAt).toBe(2004 + 5000 + 20 * 1000)
  })

  it('båda gissningar → reveal', () => {
    let s = allaLuckor()
    s = reduce(s, { type: 'submitGuess', team: 'lag1', resource: 'medicin' })
    expect(s.phase).toBe('guessing')
    s = reduce(s, { type: 'submitGuess', team: 'lag2', resource: 'vatten' })
    expect(s.phase).toBe('reveal')
    expect(s.hatchTimerEndsAt).toBeNull()
  })

  it('tiden ute → reveal, den som inte gissat har null (räknas som fel)', () => {
    let s = allaLuckor()
    s = reduce(s, { type: 'submitGuess', team: 'lag1', resource: 'medicin' })
    s = reduce(s, { type: 'guessTimeout' })
    expect(s.phase).toBe('reveal')
    expect(s.guesses).toEqual({ lag1: 'medicin', lag2: null })
  })

  it('guessSeconds null = ingen timer', () => {
    let s = run([{ ...START, guessSeconds: null } as Action])
    for (let i = 0; i < 5; i++) s = buy(s, null, 0)
    expect(s.phase).toBe('guessing')
    expect(s.hatchTimerEndsAt).toBeNull()
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
  })
})

describe('shiftTimer (facilitator-paus)', () => {
  it('förskjuter aktiv nedräkning framåt', () => {
    const s = started()
    const shifted = reduce(s, { type: 'shiftTimer', deltaMs: 5000 })
    expect(shifted.hatchTimerEndsAt).toBe(s.hatchTimerEndsAt! + 5000)
  })

  it('gör inget när ingen nedräkning är igång eller delta = 0', () => {
    const idle = initialState(roster)
    expect(reduce(idle, { type: 'shiftTimer', deltaMs: 5000 })).toBe(idle)
    const s = started()
    expect(reduce(s, { type: 'shiftTimer', deltaMs: 0 })).toBe(s)
  })
})
