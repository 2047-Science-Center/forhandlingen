/**
 * Entrén — ren logik (ingen Vue, ingen MQTT): startsidor, placering enligt XY-PLATSER.
 * Testas i entre.test.ts. IDENTISK i alla X&Y-stationer.
 */
import type {
  EntreConfig,
  EntreMember,
  EntrePerson,
  EntreSubRole,
  GenderKey,
  RoleLetter,
  SideId,
} from './types'

/** participants.gender → m/f/x ('man'/'kvinna' i DB; tål kille/tjej/m/f/k). */
export function normGender(g: string | null | undefined): GenderKey {
  const s = (g ?? '').trim().toLowerCase()
  if (['man', 'kille', 'pojke', 'm', 'male', 'boy'].includes(s)) return 'm'
  if (['kvinna', 'tjej', 'flicka', 'f', 'k', 'female', 'girl'].includes(s)) return 'f'
  return 'x'
}

/** UID/band_id i kanonisk form (hex VERSALER utan avgränsare, SOM regel 5). */
export function normUid(uid: string): string {
  return uid.trim().replace(/[^0-9a-z]/gi, '').toUpperCase()
}

/** FNV-1a 32-bit — stabil hash för deterministisk ordning. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Liten seedbar PRNG (mulberry32) → [0, 1). */
export function seededRng(seed: string | number): () => number {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(seed)
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * STARTSIDOR (XY-PLATSER): gruppens fasta halvor A/B, samma vid alla stationer.
 * Medlemmar med `startsida` (klasslista-importen) behåller den; övriga fördelas så att
 * varje sida får lika många killar och tjejer (±1) och sidorna blir lika stora (±1).
 * DETERMINISTISK ur `seed` (= session:grupp, utan runda) + band_id → samma tre står på
 * samma sida vid varje station, och stationens skärmar räknar fram samma indelning.
 */
export function splitBySide(members: readonly EntreMember[], seed: string): Record<string, SideId> {
  const out: Record<string, SideId> = {}
  const total = { A: 0, B: 0 }
  const byGender: Record<GenderKey, { A: number; B: number }> = { m: { A: 0, B: 0 }, f: { A: 0, B: 0 }, x: { A: 0, B: 0 } }
  const put = (m: EntreMember, side: SideId) => {
    out[m.band_id] = side
    total[side]++
    byGender[normGender(m.gender)][side]++
  }
  for (const m of members) if (m.startsida === 'A' || m.startsida === 'B') put(m, m.startsida)
  const order = (m: EntreMember) => hashStr(`${seed}|${m.band_id}`)
  for (const k of ['m', 'f', 'x'] as GenderKey[]) {
    const list = members
      .filter((m) => !out[m.band_id] && normGender(m.gender) === k)
      .sort((a, b) => order(a) - order(b) || a.band_id.localeCompare(b.band_id))
    for (const m of list) {
      const g = byGender[k]
      const side: SideId =
        k !== 'x' && g.A !== g.B ? (g.A < g.B ? 'A' : 'B') : total.A !== total.B ? (total.A < total.B ? 'A' : 'B') : 'A'
      put(m, side)
    }
  }
  return out
}

/**
 * Fördela `n` platser över hinkar med vikter (största-resten-metoden). Lika vikter →
 * hinkarna skiljer sig med högst en plats. Kvar som hjälpfunktion (används inte av place()).
 */
export function allocate(n: number, weights: readonly number[], prefer: readonly number[] = []): number[] {
  const total = weights.reduce((a, w) => a + Math.max(0, w), 0)
  if (n <= 0 || total <= 0) return weights.map(() => 0)
  const quotas = weights.map((w) => (n * Math.max(0, w)) / total)
  const out = quotas.map((q) => Math.floor(q))
  let left = n - out.reduce((a, b) => a + b, 0)
  const order = quotas
    .map((q, i) => ({ i, rest: q - Math.floor(q) }))
    .sort((a, b) => b.rest - a.rest || (prefer[b.i] ?? 0) - (prefer[a.i] ?? 0) || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    out[i]++
    left--
  }
  return out
}

const other = (l: RoleLetter): RoleLetter => (l === 'A' ? 'B' : 'A')

/**
 * Balansera ETT antal personer mellan roll A och B inom gränserna [lo, hi] för A.
 * Flyttar först dem som inte valt rollen de står i (de som inte röstat), sedan slump bland de andra.
 * Önskemålet (chosen) rörs aldrig — bara tilldelningen.
 */
function clampRoles(
  people: readonly EntreMember[],
  assigned: Record<string, RoleLetter>,
  chosen: (m: EntreMember) => RoleLetter | null,
  lo: number,
  hi: number,
  rng: () => number,
): void {
  const inRole = (l: RoleLetter) => people.filter((m) => assigned[m.band_id] === l)
  const move = (from: RoleLetter) => {
    const pool = shuffle(inRole(from), rng)
    const pick = pool.find((m) => chosen(m) !== from) ?? pool[0]
    if (pick) assigned[pick.band_id] = other(from)
  }
  let guard = people.length * 2
  while (inRole('A').length > hi && guard-- > 0) move('A')
  while (inRole('A').length < lo && guard-- > 0) move('B')
}

/**
 * PLACERING (XY-PLATSER): önskemål → roll + rollsida + 3D-plats + titel, enligt stationens regler.
 *  'roll-ar-sida':   rollen = sidan; 6 personer → 3+3; annars önskemålen inom min/max per roll.
 *  'roll-inom-sida': sidan = startsidan; inom varje sida minst `min` av varje roll (om sidan rymmer det).
 * Underroller slumpas inom rollen (fasta platser först, sedan resten). chosen_role sparas oförändrat.
 */
export function place(
  members: readonly EntreMember[],
  votes: Readonly<Record<string, RoleLetter>>,
  cfg: Pick<EntreConfig, 'roles' | 'placement'>,
  startSides: Readonly<Record<string, SideId>>,
  rng: () => number,
): EntrePerson[] {
  const roles = cfg.roles
  const role = (l: RoleLetter) => (roles[0].letter === l ? roles[0] : roles[1])
  const chosen = (m: EntreMember): RoleLetter | null => {
    const v = votes[m.band_id]
    return v === 'A' || v === 'B' ? v : null
  }
  const assigned: Record<string, RoleLetter> = {}
  const assignWishes = (people: readonly EntreMember[]) => {
    for (const m of people) {
      const c = chosen(m)
      if (c) assigned[m.band_id] = c
    }
    // De som inte valt fyller den roll som har minst folk.
    for (const m of shuffle(people.filter((x) => !chosen(x)), rng)) {
      const a = people.filter((x) => assigned[x.band_id] === 'A').length
      const b = people.filter((x) => assigned[x.band_id] === 'B').length
      assigned[m.band_id] = a <= b ? 'A' : 'B'
    }
  }
  const inomSida = cfg.placement === 'roll-inom-sida'
  const sideOf = (m: EntreMember): SideId => startSides[m.band_id] ?? 'A'

  if (inomSida) {
    for (const side of ['A', 'B'] as SideId[]) {
      const group = members.filter((m) => sideOf(m) === side)
      assignWishes(group)
      const minA = role('A').min ?? 0
      const minB = role('B').min ?? 0
      if (group.length >= minA + minB) {
        const hi = Math.min(role('A').max ?? group.length, group.length - minB)
        clampRoles(group, assigned, chosen, minA, hi, rng)
      }
    }
  } else {
    assignWishes(members)
    const n = members.length
    const A = role('A')
    const B = role('B')
    let lo = Math.max(A.min ?? 0, n - (B.max ?? n), 0)
    let hi = Math.min(A.max ?? n, n - (B.min ?? 0))
    if (n === 6) lo = hi = Math.min(Math.max(3, lo), hi) // 6 personer = alltid 3 per rollsida
    if (lo <= hi) clampRoles(members, assigned, chosen, lo, hi, rng)
  }

  // Underroller: slumpa inom rollen (per sida när rollerna ligger inom sidan).
  const sub: Record<string, EntreSubRole | null> = {}
  const groups = inomSida
    ? (['A', 'B'] as SideId[]).flatMap((side) => roles.map((r) => ({ r, people: members.filter((m) => sideOf(m) === side && assigned[m.band_id] === r.letter) })))
    : roles.map((r) => ({ r, people: members.filter((m) => assigned[m.band_id] === r.letter) }))
  for (const { r, people } of groups) {
    const subs = r.subRoles ?? []
    if (!subs.length) {
      people.forEach((m) => (sub[m.band_id] = null))
      continue
    }
    const fixed = subs.filter((x) => x.count != null)
    const rest = subs.find((x) => x.count == null) ?? subs[subs.length - 1]
    const drawn = shuffle(people, rng)
    let k = 0
    for (const s of fixed) for (let c = 0; c < s.count! && k < drawn.length; c++) sub[drawn[k++].band_id] = s
    for (; k < drawn.length; k++) sub[drawn[k].band_id] = rest
  }

  return members.map((m) => {
    const letter = assigned[m.band_id]
    const r = role(letter)
    const s = sub[m.band_id] ?? null
    const side: SideId = inomSida ? sideOf(m) : letter
    const rawPlats = s?.plats ?? r.plats ?? null
    return {
      band_id: m.band_id,
      name: m.name,
      gender: m.gender ?? null,
      side,
      vote_side: startSides[m.band_id] ?? null,
      chosen_role: chosen(m),
      assigned_role: letter,
      sub_role: s?.id ?? null,
      plats: rawPlats && inomSida && !rawPlats.includes('.') ? `${side}.${rawPlats}` : rawPlats,
      titel: s?.name ?? r.titel ?? r.name,
    }
  })
}

/** Rfid-signal → röst: NEJ (vänster läsare) = vänster bild = roll A, JA (höger) = roll B. */
export function voteFromTopic(stationN: number, topic: string): RoleLetter | null {
  if (topic === `station${stationN}/rfidnej`) return 'A'
  if (topic === `station${stationN}/rfidja`) return 'B'
  return null
}
