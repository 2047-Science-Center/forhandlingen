/**
 * Lek-läget — delad synk mellan stationens skärmar (Lager A, IDENTISK i alla X&Y-stationer).
 *
 * Ett litet ledar-styrt tillstånd: ledarskärmen äger lekens state och kör reducern;
 * följarskärmar skickar sina handlingar till ledaren och får snapshots tillbaka.
 * Går över stationens befintliga skärm↔skärm-transport (BroadcastChannel / WS-relä)
 * med egna meddelandetyper `lek:<kanal>:*` → krockar inte med spelets meddelanden.
 *
 * Utan transport (en skärm) kör allt lokalt. Tillståndet lever bara i RAM och
 * nollställs när lek-komponenten avmonteras (ny grupp / byte) → inget sparas.
 *
 * Regler för leken: XY-VANTUPPGIFTER.md §0 (mikrorundor, hårt stopp, inget till sorteringen).
 */
import { reactive, type UnwrapRef } from 'vue'

/** Minsta transport-yta (station-kit/adapters/transport/Transport uppfyller den). */
export interface LekTransport {
  send(msg: { kind: string; payload: unknown }): void
  subscribe(handler: (msg: { kind: string; payload: unknown }) => void): () => void
}

export interface LekAction {
  type: string
  [k: string]: unknown
}

export interface LekSyncOptions<S> {
  /** Kanalnamn (t.ex. 'vemdar'). Meddelanden heter lek:<kanal>:state|act|hello. */
  channel: string
  /** Starttillstånd (klonas). */
  initial: S
  /** Ren reducer — körs bara på ledaren. `now` = ledarens klocka (ms). */
  reduce: (state: S, action: LekAction, now: number) => S
  /** Den här skärmen äger tillståndet. */
  leader: boolean
  /** Skärm↔skärm-transport. Saknas → bara lokalt. */
  transport?: LekTransport | null
}

export interface LekSync<S> {
  /** Reaktivt tillstånd (läs i mallen). */
  readonly state: UnwrapRef<S>
  /** Skicka en handling (ledaren reducerar direkt, följaren skickar till ledaren). */
  act(action: LekAction): void
  /** Koppla ner (anropa i onUnmounted). */
  dispose(): void
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function createLekSync<S extends object>(o: LekSyncOptions<S>): LekSync<S> {
  const state = reactive(clone(o.initial)) as UnwrapRef<S>
  const k = (s: string) => `lek:${o.channel}:${s}`
  let rev = 0

  function current(): S {
    return clone(state as unknown as S)
  }
  function replace(next: S): void {
    const target = state as unknown as Record<string, unknown>
    for (const key of Object.keys(target)) if (!(key in (next as object))) delete target[key]
    Object.assign(target, next)
  }
  function broadcast(): void {
    o.transport?.send({ kind: k('state'), payload: { rev, state: current() } })
  }
  function apply(action: LekAction): void {
    const next = o.reduce(current(), action, Date.now())
    rev += 1
    replace(next)
    broadcast()
  }

  const unsub = o.transport?.subscribe((msg) => {
    if (msg.kind === k('state') && !o.leader) {
      const p = msg.payload as { rev: number; state: S }
      if (!p || typeof p !== 'object') return
      rev = p.rev
      replace(p.state)
    } else if (msg.kind === k('act') && o.leader) {
      apply(msg.payload as LekAction)
    } else if (msg.kind === k('hello') && o.leader) {
      broadcast()
    }
  })
  // Följaren ber om aktuellt läge (sen anslutning / omladdning).
  if (!o.leader) o.transport?.send({ kind: k('hello'), payload: null })
  else broadcast()

  return {
    state,
    act(action: LekAction): void {
      if (o.leader || !o.transport) apply(action)
      else o.transport.send({ kind: k('act'), payload: action })
    },
    dispose(): void {
      unsub?.()
    },
  }
}

/** Förhandsvisning: `?lek=1` i URL:en visar leken direkt (pilot/test), utan rotationen. */
export function lekPreviewFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('lek') === '1'
}

/** Slumpa ett index i [0, n) som inte är `avoid` (om möjligt). */
export function pickIndex(n: number, avoid: number | null = null, rnd: () => number = Math.random): number {
  if (n <= 1) return 0
  let i = Math.floor(rnd() * n)
  if (i === avoid) i = (i + 1 + Math.floor(rnd() * (n - 1))) % n
  return i
}
