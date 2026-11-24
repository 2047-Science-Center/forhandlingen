/**
 * Ren spelmotor för Förhandlingen — ramverksoberoende, testbar.
 *
 * Reducer-mönster: `reduce(state, action) -> nyState`. State är serialiserbart
 * (kan skickas rakt genom transporten som snapshot). All UI ligger som ett
 * tunt lager ovanpå detta. Inga sidoeffekter här — timers/ljus/ljud hanteras
 * av storet/adaptrarna utifrån state.
 *
 * Budgivningen av en lucka går i STEG (types.BiddingStep): getready →
 * negotiating → klubba → sald → nästa lucka. "Klubban": när tiden är ute visar
 * båda skärmarna samma ruta (vem fick den + pris → KLUBBA). Köpet bokförs först
 * när ångra-fönstret (undoSeconds) gått ut, så ett feltryck rättas med ÅNGRA
 * i stället för ett eget bekräftelsesteg på andra skärmen.
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
      /** null = getready startar pausad (armas med armGetReady). */
      getReadyFirstSeconds: number | null
      getReadySeconds: number | null
      undoSeconds: number
      guessSeconds: number | null
      now: number
    }
  | { type: 'armGetReady'; seconds: number; now: number } // starta pausad getready-nedräkning
  | { type: 'shiftTimer'; deltaMs: number } // förskjut aktiv nedräkning (facilitator-paus)
  | { type: 'beginNegotiation'; now: number } // getready-nedräkning klar
  | { type: 'finishNegotiation'; now: number } // KLAR eller timer 0
  | { type: 'klubba'; winner: TeamId | null; price: number; by: TeamId; now: number }
  | { type: 'angra' } // ångra klubbslaget (inom ångra-fönstret)
  | { type: 'commitSale'; now: number } // ångra-fönstret ute → bokför, nästa lucka
  | { type: 'submitGuess'; team: TeamId; resource: string }
  | { type: 'guessTimeout' } // gissningstiden ute → avslöjande (ej gissat = fel)
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
    results: {},
    pending: null,
    guesses: { lag1: null, lag2: null },
    negotiationSeconds: null,
    getReadyFirstSeconds: null,
    getReadySeconds: null,
    undoSeconds: 5,
    guessSeconds: null,
    hatchTimerEndsAt: null,
    members,
    version: 0,
  }
}

/** Djupkopiera state (rent JSON; läser igenom ev. reaktiva proxies). */
function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}

/** Gå vidare till nästa lucka, eller in i gissningsfasen om alla är klara. */
function advance(state: GameState, now: number): void {
  state.currentHatch += 1
  state.pending = null
  if (state.currentHatch >= state.order.length) {
    state.phase = 'guessing'
    state.currentHatch = state.order.length
    state.hatchTimerEndsAt = state.guessSeconds != null ? now + state.guessSeconds * 1000 : null
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
      next.step = 'getready'
      next.results = {}
      next.pending = null
      next.guesses = { lag1: null, lag2: null }
      next.negotiationSeconds = action.negotiationSeconds
      next.getReadyFirstSeconds = action.getReadyFirstSeconds
      next.getReadySeconds = action.getReadySeconds
      next.undoSeconds = action.undoSeconds
      next.guessSeconds = action.guessSeconds
      // getReadyFirst null = PAUSAD (armas senare via armGetReady).
      next.hatchTimerEndsAt =
        action.getReadyFirstSeconds != null ? action.now + action.getReadyFirstSeconds * 1000 : null
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

    case 'shiftTimer': {
      if (state.hatchTimerEndsAt == null || action.deltaMs === 0) return state
      const next = clone(state)
      next.hatchTimerEndsAt = state.hatchTimerEndsAt + action.deltaMs
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
      next.step = 'klubba'
      next.hatchTimerEndsAt = null // ingen tidsgräns: gruppen står vid skärmen och bestämmer
      next.version += 1
      return next
    }

    case 'klubba': {
      if (state.phase !== 'bidding' || state.step !== 'klubba') return state
      const price = action.winner ? Math.round(action.price) : 0
      if (action.winner && (price < 0 || price > state.capital[action.winner])) return state
      const next = clone(state)
      next.pending = {
        hatch: state.currentHatch + 1,
        resource: state.order[state.currentHatch],
        winner: action.winner,
        price,
        by: action.by,
      }
      next.step = 'sald'
      next.hatchTimerEndsAt = action.now + state.undoSeconds * 1000
      next.version += 1
      return next
    }

    case 'angra': {
      if (state.phase !== 'bidding' || state.step !== 'sald') return state
      const next = clone(state)
      next.pending = null
      next.step = 'klubba'
      next.hatchTimerEndsAt = null
      next.version += 1
      return next
    }

    case 'commitSale': {
      if (state.phase !== 'bidding' || state.step !== 'sald' || !state.pending) return state
      const next = clone(state)
      const p = next.pending!
      if (p.winner) next.capital[p.winner] -= p.price
      next.results[next.currentHatch] = { resource: p.resource, winner: p.winner, price: p.winner ? p.price : 0 }
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
        next.hatchTimerEndsAt = null
      }
      next.version += 1
      return next
    }

    case 'guessTimeout': {
      if (state.phase !== 'guessing') return state
      const next = clone(state)
      // Den som inte hann gissa har gissat fel (null räknas inte som rätt).
      next.phase = 'reveal'
      next.hatchTimerEndsAt = null
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
