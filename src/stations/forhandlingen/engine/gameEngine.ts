/**
 * Ren spelmotor för Förhandlingen — ramverksoberoende, testbar.
 *
 * Reducer-mönster: `reduce(state, action) -> nyState`. State är serialiserbart
 * (kan skickas rakt genom transporten som snapshot). All UI ligger som ett
 * tunt lager ovanpå detta. Inga sidoeffekter här — timers/ljus/ljud hanteras
 * av storet/adaptrarna utifrån state.
 *
 * Budgivningen av en lucka går i STEG (types.BiddingStep) så det alltid är
 * självklart vad man ska göra: negotiating → entry_winner → entry_price →
 * confirm. Timern är knuten till varje förhandling (räknar ner från
 * negotiationSeconds) och startar först när föregående köp är bekräftat.
 */

import type {
  Dataset,
  GameState,
  HatchLight,
  Person,
  TeamId,
} from './types'

const OTHER: Record<TeamId, TeamId> = { lag1: 'lag2', lag2: 'lag1' }

function emptyMembers(): Record<TeamId, Person[]> {
  return { lag1: [], lag2: [] }
}

export type Action =
  | { type: 'setMembers'; members: Record<TeamId, Person[]> }
  | {
      type: 'start'
      dataset: Dataset
      negotiationSeconds: number | null
      getReadyFirstSeconds: number | null
      getReadySeconds: number | null
      revealSeconds: number | null
      now: number
    }
  | { type: 'finishReveal'; now: number } // intro-popup (kritisk → pengar) klar
  | { type: 'armGetReady'; seconds: number; now: number } // starta pausad getready-nedräkning
  | { type: 'beginNegotiation'; now: number } // getready-nedräkning klar
  | { type: 'finishNegotiation'; now: number } // KLAR eller timer 0
  | { type: 'chooseWinner'; winner: TeamId }
  | { type: 'enterPrice'; price: number } // "skicka till vinnaren"
  | { type: 'noBuy'; now: number } // ingen köpte
  | { type: 'cancelEntry' } // "nej, ändra"
  | { type: 'confirmPurchase'; now: number }
  | { type: 'submitGuess'; team: TeamId; resource: string }
  | { type: 'reset'; members?: Record<TeamId, Person[]> }
  /** Adoptera en snapshot från en annan skärm (transport). */
  | { type: 'sync'; state: GameState }

export function initialState(members: Record<TeamId, Person[]> = emptyMembers()): GameState {
  return {
    phase: 'intro', // rollval sker uppströms — vi kommer rakt in i dashboarden
    datasetId: '',
    capital: { lag1: 0, lag2: 0 },
    critical: { lag1: '', lag2: '' },
    order: [],
    currentHatch: -1,
    step: 'getready',
    entryTeam: null,
    lastEntryTeam: null,
    draftWinner: null,
    results: {},
    pending: null,
    guesses: { lag1: null, lag2: null },
    negotiationSeconds: null,
    getReadyFirstSeconds: null,
    getReadySeconds: null,
    hatchTimerEndsAt: null,
    members,
    version: 0,
  }
}

/** Djupkopiera state (rent JSON; läser igenom ev. reaktiva proxies). */
function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}

/** Vem gör nästa inmatning? Slumpa först, alternera sedan (varannan gång). */
function nextEntryTeam(last: TeamId | null): TeamId {
  if (last == null) return Math.random() < 0.5 ? 'lag1' : 'lag2'
  return OTHER[last]
}

/** Gå vidare till nästa lucka, eller in i gissningsfasen om alla är klara. */
function advance(state: GameState, now: number): void {
  state.currentHatch += 1
  state.pending = null
  state.draftWinner = null
  state.entryTeam = null
  if (state.currentHatch >= state.order.length) {
    state.phase = 'guessing'
    state.currentHatch = state.order.length
    state.hatchTimerEndsAt = null
    state.step = 'getready'
    return
  }
  // Ny lucka: "gör er redo"-nedräkning först (startar NU, dvs. efter föregående
  // bekräftats). Efter den → beginNegotiation → 30 s förhandling.
  state.step = 'getready'
  state.hatchTimerEndsAt =
    state.getReadySeconds != null ? now + state.getReadySeconds * 1000 : now
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'sync': {
      return action.state.version >= state.version ? clone(action.state) : state
    }

    case 'reset': {
      return initialState(action.members ?? emptyMembers())
    }

    case 'setMembers': {
      const next = clone(state)
      next.members = action.members
      next.version += 1
      return next
    }

    case 'start': {
      const next = clone(state)
      const d = action.dataset
      next.phase = 'bidding'
      next.datasetId = d.id
      next.capital = { lag1: d.kapital, lag2: d.kapital }
      next.critical = { lag1: d.kritisk_lag1, lag2: d.kritisk_lag2 }
      next.order = [...d.ordning]
      next.currentHatch = 0
      // Intro-popup (kritisk resurs → flyger → pengar) innan första luckan.
      next.step = 'reveal'
      next.entryTeam = null
      next.lastEntryTeam = null
      next.draftWinner = null
      next.results = {}
      next.pending = null
      next.guesses = { lag1: null, lag2: null }
      next.negotiationSeconds = action.negotiationSeconds
      next.getReadyFirstSeconds = action.getReadyFirstSeconds
      next.getReadySeconds = action.getReadySeconds
      if (action.revealSeconds === 0) {
        // Ingen reveal-popup → rakt till getready. getReadyFirst null = PAUSAD
        // (t.ex. medan test-popupar visas) → armas senare via armGetReady.
        next.step = 'getready'
        next.hatchTimerEndsAt =
          action.getReadyFirstSeconds != null
            ? action.now + action.getReadyFirstSeconds * 1000
            : null
      } else {
        // reveal-popup: timad (>0) eller klick-igenom (null).
        next.step = 'reveal'
        next.hatchTimerEndsAt =
          action.revealSeconds != null ? action.now + action.revealSeconds * 1000 : null
      }
      next.version += 1
      return next
    }

    case 'finishReveal': {
      if (state.phase !== 'bidding' || state.step !== 'reveal') return state
      const next = clone(state)
      next.step = 'getready'
      next.hatchTimerEndsAt =
        state.getReadyFirstSeconds != null
          ? action.now + state.getReadyFirstSeconds * 1000
          : action.now
      next.version += 1
      return next
    }

    case 'armGetReady': {
      if (state.phase !== 'bidding' || state.step !== 'getready') return state
      const next = clone(state)
      next.hatchTimerEndsAt = action.now + action.seconds * 1000
      next.version += 1
      return next
    }

    case 'beginNegotiation': {
      if (state.phase !== 'bidding' || state.step !== 'getready') return state
      const next = clone(state)
      next.step = 'negotiating'
      next.hatchTimerEndsAt =
        state.negotiationSeconds != null
          ? action.now + state.negotiationSeconds * 1000
          : null
      next.version += 1
      return next
    }

    case 'finishNegotiation': {
      if (state.phase !== 'bidding' || state.step !== 'negotiating') return state
      const next = clone(state)
      next.step = 'entry_winner'
      next.entryTeam = nextEntryTeam(state.lastEntryTeam)
      next.lastEntryTeam = next.entryTeam
      next.hatchTimerEndsAt = null // timern stannar under avräkningen
      next.version += 1
      return next
    }

    case 'chooseWinner': {
      if (state.phase !== 'bidding' || state.step !== 'entry_winner') return state
      const next = clone(state)
      next.draftWinner = action.winner
      next.step = 'entry_price'
      next.version += 1
      return next
    }

    case 'enterPrice': {
      if (state.phase !== 'bidding' || state.step !== 'entry_price') return state
      if (!state.draftWinner) return state
      if (action.price < 0) return state
      if (action.price > state.capital[state.draftWinner]) return state
      const next = clone(state)
      next.pending = {
        hatch: state.currentHatch + 1,
        resource: state.order[state.currentHatch],
        winner: state.draftWinner,
        price: action.price,
        enteredBy: state.entryTeam!,
      }
      next.step = 'confirm'
      next.version += 1
      return next
    }

    case 'noBuy': {
      if (state.phase !== 'bidding') return state
      if (state.step !== 'entry_winner' && state.step !== 'entry_price') return state
      const next = clone(state)
      next.results[next.currentHatch] = {
        resource: state.order[state.currentHatch],
        winner: null,
        price: 0,
      }
      advance(next, action.now)
      next.version += 1
      return next
    }

    case 'cancelEntry': {
      if (state.phase !== 'bidding') return state
      if (state.step !== 'entry_price' && state.step !== 'confirm') return state
      const next = clone(state)
      next.pending = null
      next.draftWinner = null
      next.step = 'entry_winner' // tillbaka till "vem vann" (behåll entryTeam)
      next.version += 1
      return next
    }

    case 'confirmPurchase': {
      if (state.phase !== 'bidding' || state.step !== 'confirm' || !state.pending) return state
      const next = clone(state)
      const p = next.pending!
      next.capital[p.winner] -= p.price
      next.results[next.currentHatch] = {
        resource: p.resource,
        winner: p.winner,
        price: p.price,
      }
      advance(next, action.now)
      next.version += 1
      return next
    }

    case 'submitGuess': {
      if (state.phase !== 'guessing') return state
      const next = clone(state)
      next.guesses[action.team] = action.resource
      if (next.guesses.lag1 && next.guesses.lag2) {
        next.phase = 'reveal'
      }
      next.version += 1
      return next
    }

    default:
      return state
  }
}

/**
 * Härled luckradens ljus-tillstånd ur state. Enda källan för BÅDE
 * skärm-luckraden (pilot) och MQTT-ljuset (drift) — samma meddelanden.
 */
export function hatchLights(state: GameState): HatchLight[] {
  const lights: HatchLight[] = []
  for (let i = 0; i < state.order.length; i++) {
    const hatch = i + 1
    const result = state.results[i]
    if (result && result.winner) {
      lights.push({ hatch, state: 'won', winner: result.winner })
    } else if (state.phase === 'bidding' && i === state.currentHatch && !result) {
      lights.push({ hatch, state: 'active', winner: null })
    } else {
      lights.push({ hatch, state: 'off', winner: null })
    }
  }
  return lights
}

/** Motståndarlaget. */
export function opponentOf(team: TeamId): TeamId {
  return OTHER[team]
}

export { OTHER }
