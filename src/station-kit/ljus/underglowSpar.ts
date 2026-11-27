/**
 * Underglow-spåren (XY-UNDERGLOW-MANUS §3, SOM.md "Underglow-spåren") — ren logik, ingen MQTT/DOM.
 * IDENTISK i alla X&Y-stationsappar.
 *
 * Ett spår = nyckelrutor (deltan) som stationen själv spelar mot filmens/ljudets klocka, så att vagnen
 * "hänger med" som portalerna gör (regel 2: centralen tänder aldrig underglow). Filerna bor bredvid
 * portalernas ljusspår i regi: `xy-regi/film/<spår>/underglow.json`.
 *
 *   {"namn": "trailer", "forskjut_ms": -60, "slut_s": 90,
 *    "rader": [{"t": 0.46, "mal": "alla", "gest": "blixt"},
 *              {"t": 37.37, "valv": "teknolog", "mal": "runt", "color": "valv", "effekt": "static"}]}
 *
 * Rad: `t` (s från spårets start) · `mal` (`alla` · `A` · `B` · `A.1`–`B.3` · `runt` · ett eget segment-id ·
 * lista) · `color` (hex · `valv` · `valvDim` · ett FARG-namn) · `effekt` (av|static|blink|puls|chase) ·
 * `gest` (kanon-gest, `{color,tempo,antal}` → station<N>/feedback) · `bas: true` (målen tillbaka till fasens
 * bas) · `valv` (raden gäller bara stationen med det valvet).
 *
 * Bilden ("ramen") = en ordnad lista pixelintervall med var sitt utseende; senare vinner (som firmwaren).
 * En ny ruta tar bort äldre delar som ligger helt inom den.
 */
import { FARG, GEST, RUNT, STANDARDSLINGA, VALVDIM, VALVFARG, type Effekt, type Gest, type Look, type Valv } from './kanon'

export interface SparRad {
  t: number
  mal?: string | string[]
  color?: string
  effekt?: Effekt
  gest?: string | { color: string; tempo?: number; antal?: number }
  bas?: boolean
  valv?: Valv | Valv[]
}

export interface Spar {
  namn: string
  forskjut_ms?: number
  /** Spåret slutar (bilden släpps → fasens bas) efter så här många sekunder. Saknas = tills fasen byts. */
  slut_s?: number | null
  rader: SparRad[]
}

/** En del av bilden: pixelintervall (inklusivt) + utseende. */
export interface Del {
  id: string
  from: number
  to: number
  look: Look
}

export interface SparKontext {
  valv: Valv
  /** Stationens egna segment (delad station: bara den här sidans) → pixelintervall. */
  segment: Record<string, [number, number]>
  /** Fasens bas (det spåret ligger ovanpå, och `bas: true`). */
  fasLook: Look
  /**
   * Delad station (firmwaren slår ihop per id): rita bara på egna segment-id:n (aldrig extra delar
   * som skulle bli kvar). Annars ritas standardslingans delar som extra segment ovanpå.
   */
  delad: boolean
}

/** Ett tidsatt steg för just den här stationen (efter `valv`-filter och `runt`-expansion). */
export interface Steg {
  ms: number
  rad: SparRad
}

const RUNT_STEG_MS = 30
const EFFEKTER: readonly Effekt[] = ['av', 'static', 'blink', 'puls', 'chase']

/** Läs/validera en spårfil. Ogiltig → null (stationen ligger kvar på fasens bas). */
export function lasSpar(d: unknown, namn = ''): Spar | null {
  if (!d || typeof d !== 'object') return null
  const o = d as Record<string, unknown>
  const raw = Array.isArray(o.rader) ? o.rader : Array.isArray(o.spar) ? o.spar : null
  if (!raw) return null
  const rader = raw.filter(
    (r): r is SparRad => !!r && typeof r === 'object' && Number.isFinite(Number((r as SparRad).t)),
  )
  return {
    namn: typeof o.namn === 'string' ? o.namn : namn,
    forskjut_ms: Number.isFinite(Number(o.forskjut_ms)) ? Number(o.forskjut_ms) : 0,
    slut_s: Number.isFinite(Number(o.slut_s)) && o.slut_s !== null ? Number(o.slut_s) : null,
    rader: rader.map((r) => ({ ...r, t: Number(r.t) })).sort((a, b) => a.t - b.t),
  }
}

/** Gäller raden den här stationen? */
function forMig(rad: SparRad, valv: Valv): boolean {
  if (!rad.valv) return true
  return Array.isArray(rad.valv) ? rad.valv.includes(valv) : rad.valv === valv
}

/** Spåret → stationens steg i tidsordning: `valv`-filtrerat, `runt` utvecklat till sex delar (30 ms isär). */
export function kompilera(spar: Spar, valv: Valv): Steg[] {
  const ut: Steg[] = []
  for (const rad of spar.rader) {
    if (!forMig(rad, valv)) continue
    const ms = rad.t * 1000
    if (rad.mal === 'runt') {
      RUNT.forEach((del, i) => ut.push({ ms: ms + i * RUNT_STEG_MS, rad: { ...rad, mal: del } }))
    } else ut.push({ ms, rad })
  }
  return ut.sort((a, b) => a.ms - b.ms)
}

/** Stationens eget pixelintervall (delad station: bara sidans). */
function egetIntervall(seg: Record<string, [number, number]>): [number, number] | null {
  const v = Object.values(seg)
  if (!v.length) return null
  return [Math.min(...v.map(([f]) => f)), Math.max(...v.map(([, t]) => t))]
}

/** Ett mål → pixelintervall att rita, klippta till stationens eget intervall. */
export function malIntervall(mal: SparRad['mal'], ctx: SparKontext): Array<{ id: string; from: number; to: number }> {
  const lista = mal === undefined ? ['alla'] : Array.isArray(mal) ? mal : [mal]
  const eget = egetIntervall(ctx.segment)
  if (!eget) return []
  const ut: Array<{ id: string; from: number; to: number }> = []
  for (const m of lista) {
    let r: [number, number] | undefined
    if (m === 'alla') r = eget
    else if (m in ctx.segment) r = ctx.segment[m]
    else if (m in STANDARDSLINGA) r = STANDARDSLINGA[m]
    if (!r) continue
    const from = Math.max(r[0], eget[0])
    const to = Math.min(r[1], eget[1])
    if (from > to) continue
    // Egna segment som ligger helt inom målet. Täcker de målet helt → rita på dem (inga extra segment).
    const inom = Object.entries(ctx.segment).filter(([, [f, t]]) => f >= from && t <= to)
    if (inom.length && (ctx.delad || tacker(inom.map(([, r]) => r), from, to))) {
      for (const [id, [f, t]] of inom) ut.push({ id, from: f, to: t })
      continue
    }
    if (!ctx.delad) {
      // Ingen egen motsvarighet (t.ex. `A.1` på en station som bara har `A`/`B`) → extra segment ovanpå.
      ut.push({ id: m, from, to })
      continue
    }
    // Delad station: bara egna id:n — det minsta som täcker målet.
    const minsta = Object.entries(ctx.segment)
      .filter(([, [f, t]]) => f <= from && t >= to)
      .sort((a, b) => a[1][1] - a[1][0] - (b[1][1] - b[1][0]))[0]
    if (minsta) ut.push({ id: minsta[0], from: minsta[1][0], to: minsta[1][1] })
  }
  return ut
}

/** Täcker intervallen [from, to] utan lucka? */
function tacker(r: Array<[number, number]>, from: number, to: number): boolean {
  let nasta = from
  for (const [f, t] of r.slice().sort((a, b) => a[0] - b[0])) {
    if (f > nasta) return false
    nasta = Math.max(nasta, t + 1)
  }
  return nasta > to
}

/** Radens färg → hex (`valv`, `valvDim`, FARG-namn eller hex). */
export function radFarg(color: string | undefined, valv: Valv): string {
  if (!color) return FARG.amber
  if (color === 'valv') return VALVFARG[valv]
  if (color === 'valvDim') return VALVDIM[valv]
  if (color in FARG) return FARG[color as keyof typeof FARG]
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : FARG.amber
}

/** Radens utseende (för en bas-rad). */
function radLook(rad: SparRad, ctx: SparKontext): Look {
  if (rad.bas) return { ...ctx.fasLook }
  const effekt = rad.effekt && EFFEKTER.includes(rad.effekt) ? rad.effekt : 'static'
  if (effekt === 'av') return { color: '#000000', effekt: 'av' }
  return { color: radFarg(rad.color, ctx.valv), effekt }
}

/** Ändrar raden basen (inte bara en gest)? */
export function arBasRad(rad: SparRad): boolean {
  return !!rad.bas || rad.effekt !== undefined || rad.color !== undefined
}

/** En bas-rad på bilden → ny bild. Äldre delar helt inom ett nytt mål tas bort; målet läggs sist. */
export function tillampa(ram: Del[], rad: SparRad, ctx: SparKontext): Del[] {
  if (!arBasRad(rad)) return ram
  const look = radLook(rad, ctx)
  let ny = ram.slice()
  for (const m of malIntervall(rad.mal, ctx)) {
    ny = ny.filter((d) => !(d.from >= m.from && d.to <= m.to))
    ny.push({ ...m, look: { ...look } })
  }
  return konsolidera(ny, ctx)
}

const sammaLook = (a: Look, b: Look) => a.color === b.color && a.effekt === b.effekt

/**
 * Delar som tillsammans täcker ett eget segment med samma utseende (t.ex. `runt` som tänt A.1–A.3)
 * slås ihop till segmentet — så att segmentets eget utseende stämmer och inga onödiga extra segment skickas.
 */
function konsolidera(ram: Del[], ctx: SparKontext): Del[] {
  let ny = ram
  for (const [id, [from, to]] of Object.entries(ctx.segment)) {
    // De nyaste delarna inom segmentet, efter den senaste delen som täcker hela segmentet.
    let i = ny.length - 1
    while (i >= 0 && !(ny[i].from <= from && ny[i].to >= to)) i--
    const inom = ny.slice(i + 1).filter((d) => d.from >= from && d.to <= to)
    if (!inom.length || !inom.every((d) => sammaLook(d.look, inom[0].look))) continue
    if (!tacker(inom.map((d) => [d.from, d.to]), from, to)) continue
    // Ingen nyare del utanför får delvis överlappa (då ändras ordningen).
    if (ny.slice(i + 1).some((d) => !inom.includes(d) && d.from <= to && d.to >= from)) continue
    ny = [...ny.filter((d) => !inom.includes(d)), { id, from, to, look: { ...inom[0].look } }]
  }
  return ny
}

/** Utseendet på ett pixelintervall enligt bilden: sista delen som täcker hela intervallet (null = ingen). */
export function lookPa(ram: Del[], from: number, to: number): Look | null {
  for (let i = ram.length - 1; i >= 0; i--) {
    const d = ram[i]
    if (d.from <= from && d.to >= to) return d.look
  }
  return null
}

/**
 * Bilden → segment att publicera: stationens egna segment (i sin ordning, med bildens utseende) +
 * (ej delad station) bildens extra delar ovanpå. Delar som exakt motsvarar ett eget segment hoppas över.
 */
export function ramTillSegment(
  ram: Del[],
  ctx: SparKontext,
): Array<{ id: string; from: number; to: number } & Look> {
  const egna = Object.entries(ctx.segment).map(([id, [from, to]]) => ({
    id,
    from,
    to,
    ...(lookPa(ram, from, to) ?? ctx.fasLook),
  }))
  if (ctx.delad) return egna
  const extra = ram
    .filter((d) => !(d.id in ctx.segment) && !Object.values(ctx.segment).some(([f, t]) => f === d.from && t === d.to))
    .map((d) => ({ id: d.id, from: d.from, to: d.to, ...d.look }))
  return [...egna, ...extra]
}

/** Radens gest → {color, tempo, antal} (null = ingen gest). */
export function radGest(rad: SparRad, valv: Valv): { namn: string; color: string; tempo: number; antal: number } | null {
  const g = rad.gest
  if (!g) return null
  if (typeof g === 'string') {
    const def = GEST[g as Gest]
    if (!def) return null
    return { namn: g, color: rad.color ? radFarg(rad.color, valv) : def.color, tempo: def.tempo, antal: def.antal }
  }
  return { namn: 'spar', color: radFarg(g.color, valv), tempo: g.tempo ?? 300, antal: Math.max(1, Math.min(9, g.antal ?? 1)) }
}

/**
 * VALdi-ringens analys-snurr (xy-firmware XyValdi `chaseValv`, samma formel som vyn): 20 steg genom
 * valvordningen med inbromsning, landar på `mal` vid 92 % av `ms`. → valvindex 0–3.
 */
export function chaseValv(t: number, ms: number, mal: number): number {
  const STEG = 20
  let x = t / (0.92 * ms)
  if (x < 0) x = 0
  if (x > 1) x = 1
  const p = 1 - (1 - x) * (1 - x)
  const steg = Math.floor(p * STEG)
  return (((mal - STEG + steg) % 4) + 4) % 4
}

/** Attract-vågen: nästa tillfälle (epoch-ms, regi-klockan) då den här stationens våg ska gå. */
export function nastaVag(nuMs: number, index: number, periodMs = 20000, steg = 500): number {
  const off = index * steg
  return Math.ceil((nuMs - off + 1) / periodMs) * periodMs + off
}
