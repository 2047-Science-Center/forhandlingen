/**
 * Entrén — ren logik (ingen Vue, ingen MQTT): sidindelning, platser, ombalansering.
 * Testas i entre.test.ts. IDENTISK i alla X&Y-stationer.
 */
import type {
  EntreMember,
  EntrePerson,
  EntreRole,
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
 * Röstnings-sidindelning (bara skärm-läget): dela gruppen på sida A/B så att
 * varje sida får lika många killar och lika många tjejer (±1), och sidorna lika
 * stora (±1). DETERMINISTISK ur `seed` + band_id → stationens båda skärmar räknar
 * fram exakt samma delning utan att prata med varandra.
 */
export function splitBySide(members: readonly EntreMember[], seed: string): Record<string, SideId> {
  const order = (m: EntreMember) => hashStr(`${seed}|${m.band_id}`)
  const bucket = (k: GenderKey) =>
    members
      .filter((m) => normGender(m.gender) === k)
      .sort((a, b) => order(a) - order(b) || a.band_id.localeCompare(b.band_id))
  const out: Record<string, SideId> = {}
  const count = { A: 0, B: 0 }
  // Killar och tjejer turas om mellan sidorna; varje könsgrupp börjar på den sida
  // som just nu är minst (så en udda kille vägs upp av en udda tjej på andra sidan).
  for (const k of ['m', 'f', 'x'] as GenderKey[]) {
    const list = bucket(k)
    let side: SideId = count.A <= count.B ? 'A' : 'B'
    if (k === 'x') {
      for (const m of list) {
        side = count.A <= count.B ? 'A' : 'B'
        out[m.band_id] = side
        count[side]++
      }
      continue
    }
    for (const m of list) {
      out[m.band_id] = side
      count[side]++
      side = side === 'A' ? 'B' : 'A'
    }
  }
  return out
}

/**
 * Fördela `n` platser över hinkar med vikter (största-resten-metoden).
 * Lika vikter → hinkarna skiljer sig med högst en plats (5 → 3+2, 7 → 4+3).
 * Ett överskott vid lika rest går till hinken med flest `prefer` (t.ex. röster),
 * sedan till den första.
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

function roleSide(role: EntreRole): SideId | null {
  return role.side === undefined ? role.letter : role.side
}

/**
 * Ombalansering + lottning. Varje roll har platser (vikt, default 3 av 6, skalat
 * till gruppstorleken). Väljer fler en roll än det finns platser lottas
 * överskottet till den andra rollen; de som inte valt fyller lediga platser.
 * Underroller lottas sedan inom sin roll. Resultatet i medlemmarnas ordning.
 */
export function rebalance(
  members: readonly EntreMember[],
  votes: Readonly<Record<string, RoleLetter>>,
  roles: readonly [EntreRole, EntreRole],
  rng: () => number,
  voteSides: Readonly<Record<string, SideId>> = {},
): EntrePerson[] {
  const letters: RoleLetter[] = [roles[0].letter, roles[1].letter]
  const chosen = (m: EntreMember): RoleLetter | null => {
    const v = votes[m.band_id]
    return v === 'A' || v === 'B' ? v : null
  }
  const voters = letters.map((l) => members.filter((m) => chosen(m) === l))
  const slots = allocate(
    members.length,
    roles.map((r) => r.weight ?? 3),
    voters.map((v) => v.length),
  )

  const assigned: Record<string, RoleLetter> = {}
  const pool: EntreMember[] = members.filter((m) => chosen(m) === null)
  letters.forEach((l, i) => {
    const lucky = shuffle(voters[i], rng)
    lucky.slice(0, slots[i]).forEach((m) => (assigned[m.band_id] = l))
    pool.push(...lucky.slice(slots[i]))
  })
  const free = letters.map((l, i) => slots[i] - Object.values(assigned).filter((a) => a === l).length)
  for (const m of shuffle(pool, rng)) {
    const i = free[0] > 0 ? 0 : 1
    assigned[m.band_id] = letters[i]
    free[i]--
  }

  // Underroller: lotta inom rollen enligt underrollernas vikter.
  const sub: Record<string, string | null> = {}
  const subSide: Record<string, SideId | undefined> = {}
  roles.forEach((role) => {
    const inRole = members.filter((m) => assigned[m.band_id] === role.letter)
    if (!role.subRoles?.length) {
      inRole.forEach((m) => (sub[m.band_id] = null))
      return
    }
    const subSlots = allocate(inRole.length, role.subRoles.map((s) => s.weight))
    let k = 0
    const drawn = shuffle(inRole, rng)
    role.subRoles.forEach((s, si) => {
      for (let c = 0; c < subSlots[si]; c++, k++) {
        sub[drawn[k].band_id] = s.id
        subSide[drawn[k].band_id] = s.side
      }
    })
  })

  return members.map((m) => {
    const letter = assigned[m.band_id]
    const role = roles[letters.indexOf(letter)]
    return {
      band_id: m.band_id,
      name: m.name,
      gender: m.gender ?? null,
      side: subSide[m.band_id] ?? roleSide(role),
      vote_side: voteSides[m.band_id] ?? null,
      chosen_role: chosen(m),
      assigned_role: letter,
      sub_role: sub[m.band_id] ?? null,
    }
  })
}

/** Rfid-signal → röst: NEJ (vänster läsare) = vänster bild = roll A, JA (höger) = roll B. */
export function voteFromTopic(stationN: number, topic: string): RoleLetter | null {
  if (topic === `station${stationN}/rfidnej`) return 'A'
  if (topic === `station${stationN}/rfidja`) return 'B'
  return null
}
