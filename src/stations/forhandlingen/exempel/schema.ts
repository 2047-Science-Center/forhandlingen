/**
 * Exempelförhandlingens tidslinje (docs/FORSLAG-EXEMPELFORHANDLING.md): manus.json + röstlängderna
 * (public/exempel/vo/langder.json) → ett schema med absoluta tider. `lageVid(t)` ger allt som ska synas vid t
 * (aktuell replik, overlaybild, HUD, stämpel) — en ren funktion, så båda skärmarna visar samma sak från samma
 * starttid utan att skicka något mer än epoch.
 */
import manus from './manus.json'
import langderJson from '../../../../public/exempel/vo/langder.json'

export type Vem = 'valdi' | 'sandebudA' | 'rapportorA' | 'sandebudB' | 'rapportorB'
export interface Replik {
  id: string
  vem: Vem
  text: string
  viskar?: boolean
  t: number
  slut: number
}
export interface Klubbslag {
  lucka: number
  vinnare: 'A' | 'B'
  pris: number
  t: number
}
export interface Block {
  bild: string
  t: number
  slut: number
}
export interface Schema {
  repliker: Replik[]
  luckor: { vara: string; oppnas: number }[]
  klubbslag: Klubbslag[]
  block: Block[]
  gissning: number
  utfall: number
  langd: number
}

const LANGDER = langderJson as Record<string, number>
const PAUS = 0.35
const LUCKA_IN = 0.9
const KLUBBA_HALL = 1.8
const UTFALL_HALL = 2.6

export function byggSchema(langder: Record<string, number> = LANGDER): Schema {
  const m = manus as unknown as {
    ram: { id: string; vem: Vem; text: string; bild?: string }[]
    luckor: { vara: string; bild: string; rader: { id: string; vem: Vem; text: string; viskar?: boolean }[]; klubba: { vinnare: 'A' | 'B'; pris: number } }[]
    gissning: { bild: string; rader: { id: string; vem: Vem; text: string }[] }
    slut: { id: string; vem: Vem; text: string }[]
  }
  const repliker: Replik[] = []
  const block: Block[] = []
  const luckor: Schema['luckor'] = []
  const klubbslag: Klubbslag[] = []
  let t = 0.4
  const sag = (r: { id: string; vem: Vem; text: string; viskar?: boolean }) => {
    const d = langder[r.id] ?? Math.max(1, r.text.split(/\s+/).length / 2.5)
    repliker.push({ ...r, t, slut: t + d })
    t += d + PAUS
  }
  // Ramen
  const ramStart = t
  m.ram.forEach(sag)
  block.push({ bild: m.ram[0]?.bild ?? 's1-oppning', t: ramStart, slut: t })
  // Luckorna
  m.luckor.forEach((l, i) => {
    const b0 = t
    luckor.push({ vara: l.vara, oppnas: t })
    t += LUCKA_IN
    l.rader.forEach(sag)
    klubbslag.push({ lucka: i, vinnare: l.klubba.vinnare, pris: l.klubba.pris, t })
    t += KLUBBA_HALL
    block.push({ bild: l.bild, t: b0, slut: t })
  })
  // Gissningen
  const gissning = t
  const g0 = t
  t += 0.5
  m.gissning.rader.forEach(sag)
  const utfall = t
  t += UTFALL_HALL
  block.push({ bild: m.gissning.bild, t: g0, slut: t })
  // Slutet
  const s0 = t
  m.slut.forEach(sag)
  block.push({ bild: 's1-oppning', t: s0, slut: t })
  return { repliker, luckor, klubbslag, block, gissning, utfall, langd: t + 0.8 }
}

export interface Lage {
  replik: Replik | null
  bild: string | null
  /** Index för aktuell lucka (-1 = ingen än), och om den är öppen just nu. */
  lucka: number
  oppen: boolean
  /** Klubbslag som skett (för luckväggen och mynten). */
  klubbat: Klubbslag[]
  /** Stämpeln visas en stund efter klubbslaget. */
  stampel: Klubbslag | null
  pengar: { A: number; B: number }
  gissar: boolean
  utfall: boolean
  klar: boolean
}

export function lageVid(s: Schema, t: number): Lage {
  const replik = s.repliker.find((r) => t >= r.t && t < r.slut) ?? null
  const bild = s.block.find((b) => t >= b.t && t < b.slut)?.bild ?? null
  let lucka = -1
  s.luckor.forEach((l, i) => {
    if (t >= l.oppnas) lucka = i
  })
  const klubbat = s.klubbslag.filter((k) => t >= k.t)
  const oppen = lucka >= 0 && !klubbat.some((k) => k.lucka === lucka) && t < s.gissning
  const senaste = klubbat[klubbat.length - 1] ?? null
  const stampel = senaste && t < senaste.t + KLUBBA_HALL - 0.2 ? senaste : null
  const pengar = { A: 100, B: 100 }
  klubbat.forEach((k) => (pengar[k.vinnare] -= k.pris))
  return {
    replik,
    bild,
    lucka,
    oppen,
    klubbat,
    stampel,
    pengar,
    gissar: t >= s.gissning && t < s.utfall + 2.6,
    utfall: t >= s.utfall && t < s.utfall + 2.6,
    klar: t >= s.langd,
  }
}
