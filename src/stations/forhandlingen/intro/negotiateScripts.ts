/**
 * Manus för förhandlingsdemona (Block 1 & 2). Tider = sekunder RELATIVT
 * cue-starten (elapsed). `speakers` driver talarmarkeringen i bilden; `settle`
 * driver den skriptade settle-UI-kopian (förloraren matar in → vinnaren
 * bekräftar). Sidor: vanster = Valv Syd, hoger = Valv Nord.
 */
export type Side = 'vanster' | 'hoger'

export interface SettleScript {
  winnerSide: Side
  loserSide: Side
  price: number
  /** elapsed när förloraren börjar mata in — "Vem vann?" visas. */
  enterStart: number
  /** elapsed när vinnaren VALTS (klick) — därefter dras slidern. */
  chooseAt: number
  /** elapsed när slidern nått priset / skicka. */
  enterEnd: number
  /** elapsed när det andra valvet bekräftar. */
  confirmAt: number
}

export interface NegotiateScript {
  photo: number
  speakers: { at: number; side: Side }[]
  settle: SettleScript
}

export const NEGOTIATE_SCRIPTS: Record<string, NegotiateScript> = {
  // Block 1, Bild 5 (cue 9.24): Syd (vänster) vinner för 30.
  B1: {
    photo: 5,
    speakers: [
      { at: 0.0, side: 'hoger' },
      { at: 4.83, side: 'vanster' },
      { at: 5.86, side: 'hoger' },
      { at: 7.78, side: 'vanster' },
      { at: 12.76, side: 'hoger' },
      { at: 13.81, side: 'vanster' },
      { at: 14.78, side: 'vanster' },
      { at: 16.26, side: 'hoger' },
      { at: 17.9, side: 'vanster' },
    ],
    settle: { winnerSide: 'vanster', loserSide: 'hoger', price: 30, enterStart: 14.78, chooseAt: 15.4, enterEnd: 16.8, confirmAt: 17.9 },
  },
  // Block 2, Bild 9 (cue 32.18): Nord (höger) vinner för 95.
  B2: {
    photo: 9,
    speakers: [
      { at: 0.0, side: 'hoger' },
      { at: 1.94, side: 'vanster' },
      { at: 5.06, side: 'hoger' },
      { at: 6.98, side: 'vanster' },
      { at: 8.92, side: 'hoger' },
      { at: 9.93, side: 'vanster' },
      { at: 11.94, side: 'hoger' },
      { at: 13.11, side: 'vanster' },
      { at: 14.11, side: 'hoger' },
    ],
    settle: { winnerSide: 'hoger', loserSide: 'vanster', price: 95, enterStart: 9.93, chooseAt: 10.6, enterEnd: 13.0, confirmAt: 14.11 },
  },
}

export function speakerAt(script: NegotiateScript, elapsed: number): Side | null {
  let cur: Side | null = null
  for (const s of script.speakers) {
    if (elapsed >= s.at) cur = s.side
    else break
  }
  return cur
}
