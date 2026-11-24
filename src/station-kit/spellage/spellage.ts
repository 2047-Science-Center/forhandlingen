/**
 * Spellägeskortet (xy-produktion/spellage/FORSLAG.md ②, Josefs beslut 2026-11-20 §9):
 * spelas efter rollvalets utfall, precis före stationens tutorial, på båda skärmarna i takt.
 * Korten är förrenderade HyperFrames-filmer med VALdis röst (public/media/spellage/<fran>-st<N>.mp4).
 *
 * Förra stationen räknas lokalt ur rotationens ordning (FORSLAG §6 alternativ A; regi skickar
 * inget `fran` än): runda 1 → "er första station"; runda ≥ 2 → stationen före i ordningen.
 * Runda 0 (rotationen av, pilot) → som runda 1.
 */
export type Lage = 'tavling' | 'samarbete' | 'motValdi'

/** Stationen före `stationN` i ordningen, eller null i runda 0/1 (första stationen). */
export function forraStation(stationN: number, round: number, order: readonly number[]): number | null {
  if (round <= 1) return null
  const i = order.indexOf(stationN)
  if (i < 0) return null
  return order[(i - 1 + order.length) % order.length]
}

/** Filnamnet (utan katalog) för kortet: `forsta-st1.mp4`, `st2-st1.mp4` … */
export function kortFil(stationN: number, round: number, order: readonly number[]): string {
  const fran = forraStation(stationN, round, order)
  return `${fran == null ? 'forsta' : `st${fran}`}-st${stationN}.mp4`
}
