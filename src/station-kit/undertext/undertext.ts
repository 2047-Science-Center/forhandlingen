/**
 * Undertext — tidskodad text ovanpå ljud/klipp, som data per språk (XY-TEXTLAGER §2, overlay.json).
 * Samma format för VO-intron (röst) och textfria klipp (video): klockan kommer utifrån, lagret
 * ritar bara vad som gäller vid tiden t. Ingen ny topic.
 */

export type Sprak = 'sv' | 'no'

export interface UndertextRad {
  /** Start (s) på klippets/ljudets klocka. */
  t: number
  /** Slut (s). Saknas → raden står kvar till nästa rads t (eller klippets slut). */
  slut?: number
  sv: string
  no?: string
  /** Fria fält (id, kapitel, beat …) som stationen kan använda för att tajma bild mot text. */
  [extra: string]: unknown
}

export interface OverlayData {
  klipp: string
  duration_s: number
  sprak: Sprak[]
  titel?: Partial<Record<Sprak, string>>
  undertext: UndertextRad[]
}

/** Raden som gäller vid tiden t, eller null (paus mellan repliker). Raderna antas sorterade på t. */
export function radVid(rader: readonly UndertextRad[], t: number): UndertextRad | null {
  for (let i = rader.length - 1; i >= 0; i--) {
    const r = rader[i]
    if (t < r.t) continue
    const slut = r.slut ?? rader[i + 1]?.t ?? Infinity
    return t < slut ? r : null
  }
  return null
}

/** Radens text på valt språk; saknas översättningen → svenska. */
export function textPa(r: UndertextRad | null, sprak: Sprak): string {
  if (!r) return ''
  return (sprak === 'no' ? r.no : undefined) || r.sv
}

/** Språk ur URL:en (?sprak=no), samma väljare som reveal-filmen. Standard sv. */
export function sprakFranUrl(): Sprak {
  try {
    return new URLSearchParams(window.location.search).get('sprak') === 'no' ? 'no' : 'sv'
  } catch {
    return 'sv'
  }
}
