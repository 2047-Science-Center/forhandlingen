import { beforeEach, describe, expect, it } from 'vitest'
import { allocate, normGender, normUid, rebalance, seededRng, splitBySide, voteFromTopic } from './logic'
import { __resetEntreForTest, initEntre } from './entre'
import type { EntreConfig, EntreMember, EntreRole, RoleLetter } from './types'

const ROLES: [EntreRole, EntreRole] = [
  { letter: 'A', rollvalRoleId: 'a', name: 'Sändebud' },
  { letter: 'B', rollvalRoleId: 'b', name: 'Rapportör' },
]

function group(n: number, genders = 'mfmfmfmfmf'): EntreMember[] {
  return Array.from({ length: n }, (_, i) => ({
    band_id: `04A2B3${String(i).padStart(2, '0')}`,
    name: `P${i}`,
    gender: genders[i % genders.length] === 'm' ? 'man' : 'kvinna',
  }))
}
const count = (p: { assigned_role: RoleLetter }[], r: RoleLetter) => p.filter((x) => x.assigned_role === r).length

describe('allocate (platser per roll)', () => {
  it('6 → 3+3, 5 → 3+2, 7 → 4+3', () => {
    expect(allocate(6, [3, 3])).toEqual([3, 3])
    expect(allocate(5, [3, 3])).toEqual([3, 2])
    expect(allocate(7, [3, 3])).toEqual([4, 3])
  })
  it('överskottsplatsen går till den roll flest valt', () => {
    expect(allocate(5, [3, 3], [1, 4])).toEqual([2, 3])
    expect(allocate(7, [3, 3], [2, 5])).toEqual([3, 4])
  })
  it('vikter skalas (stresstestet 2 + 4)', () => {
    expect(allocate(6, [2, 4])).toEqual([2, 4])
    expect(allocate(3, [1, 1])).toEqual([2, 1])
  })
})

describe('rebalance (ombalansering + lottning)', () => {
  it('6 personer, alla väljer A → 3 får A, 3 lottas till B; chosen_role behålls', () => {
    const g = group(6)
    const votes = Object.fromEntries(g.map((m) => [m.band_id, 'A' as RoleLetter]))
    const p = rebalance(g, votes, ROLES, seededRng(1))
    expect(count(p, 'A')).toBe(3)
    expect(count(p, 'B')).toBe(3)
    expect(p.every((x) => x.chosen_role === 'A')).toBe(true)
    expect(p.filter((x) => x.assigned_role === 'B').every((x) => x.side === 'B')).toBe(true)
  })
  it('inom platserna får alla det de valde', () => {
    const g = group(6)
    const votes: Record<string, RoleLetter> = {}
    g.forEach((m, i) => (votes[m.band_id] = i < 3 ? 'A' : 'B'))
    const p = rebalance(g, votes, ROLES, seededRng(2))
    expect(p.every((x) => x.assigned_role === x.chosen_role)).toBe(true)
  })
  it.each([
    [5, 3, 2],
    [7, 4, 3],
  ])('%i personer → %i+%i (rollerna skiljer högst en)', (n, a, b) => {
    const g = group(n)
    const votes = Object.fromEntries(g.map((m) => [m.band_id, 'A' as RoleLetter]))
    const p = rebalance(g, votes, ROLES, seededRng(3))
    expect([count(p, 'A'), count(p, 'B')]).toEqual([a, b])
  })
  it('5 personer där fler vill B → B får den extra platsen', () => {
    const g = group(5)
    const votes = Object.fromEntries(g.map((m) => [m.band_id, 'B' as RoleLetter]))
    const p = rebalance(g, votes, ROLES, seededRng(4))
    expect([count(p, 'A'), count(p, 'B')]).toEqual([2, 3])
  })
  it('de som inte valt fyller lediga platser och får chosen_role null', () => {
    const g = group(6)
    const p = rebalance(g, { [g[0].band_id]: 'B' }, ROLES, seededRng(5))
    expect(count(p, 'A')).toBe(3)
    expect(p.find((x) => x.band_id === g[0].band_id)!.assigned_role).toBe('B')
    expect(p.filter((x) => x.chosen_role === null)).toHaveLength(5)
  })
  it('underroller: stresstestet 2 drifttekniker + 4 expeditionsledare → 2 pulsvakter + 2 gyrostav', () => {
    const roles: [EntreRole, EntreRole] = [
      { letter: 'A', rollvalRoleId: 'drift', name: 'Drifttekniker', weight: 2, side: null },
      {
        letter: 'B',
        rollvalRoleId: 'exp',
        name: 'Expeditionsledare',
        weight: 4,
        subRoles: [
          { id: 'pulsvakt', name: 'Pulsvakt', weight: 2, side: 'A' },
          { id: 'gyrostav', name: 'Gyrostav', weight: 2, side: 'B' },
        ],
      },
    ]
    const g = group(6)
    const votes = Object.fromEntries(g.map((m) => [m.band_id, 'A' as RoleLetter]))
    const p = rebalance(g, votes, roles, seededRng(6))
    expect(count(p, 'A')).toBe(2)
    expect(count(p, 'B')).toBe(4)
    expect(p.filter((x) => x.sub_role === 'pulsvakt')).toHaveLength(2)
    expect(p.filter((x) => x.sub_role === 'gyrostav')).toHaveLength(2)
    expect(p.filter((x) => x.assigned_role === 'A').every((x) => x.sub_role === null && x.side === null)).toBe(true)
    expect(p.filter((x) => x.sub_role === 'pulsvakt').every((x) => x.side === 'A')).toBe(true)
  })
})

describe('splitBySide (könsbalanserad röstnings-sidindelning)', () => {
  const sides = (g: EntreMember[], seed: string) => {
    const s = splitBySide(g, seed)
    const on = (side: 'A' | 'B', k: 'm' | 'f') => g.filter((m) => s[m.band_id] === side && normGender(m.gender) === k).length
    return { s, on }
  }
  it('4 killar + 2 tjejer → 2+1 per sida', () => {
    const { on } = sides(group(6, 'mmmmff'), 'x')
    expect([on('A', 'm'), on('B', 'm')]).toEqual([2, 2])
    expect([on('A', 'f'), on('B', 'f')]).toEqual([1, 1])
  })
  it('3 killar + 3 tjejer → sidorna lika stora, könen ±1', () => {
    const g = group(6, 'mfmfmf')
    const { s, on } = sides(g, 'run-1')
    expect(Object.values(s).filter((v) => v === 'A')).toHaveLength(3)
    expect(Math.abs(on('A', 'm') - on('B', 'm'))).toBeLessThanOrEqual(1)
    expect(Math.abs(on('A', 'f') - on('B', 'f'))).toBeLessThanOrEqual(1)
  })
  it('deterministisk: samma seed → samma delning oavsett medlemsordning', () => {
    const g = group(7, 'mmfmffm')
    expect(splitBySide(g, 's:1:2')).toEqual(splitBySide([...g].reverse(), 's:1:2'))
  })
  it('vill_ej_ange fördelas så sidorna blir lika stora', () => {
    const g = [...group(4, 'mmff'), { band_id: 'X1', name: 'X', gender: 'vill_ej_ange' }, { band_id: 'X2', name: 'Y', gender: null }]
    const s = splitBySide(g, 'q')
    expect(Object.values(s).filter((v) => v === 'A')).toHaveLength(3)
  })
})

describe('rfid', () => {
  it('NEJ = vänster bild = roll A, JA = höger = roll B', () => {
    expect(voteFromTopic(3, 'station3/rfidnej')).toBe('A')
    expect(voteFromTopic(3, 'station3/rfidja')).toBe('B')
    expect(voteFromTopic(3, 'station2/rfidja')).toBeNull()
    expect(normUid(' 04:a2:b3:c4 ')).toBe('04A2B3C4')
  })
})

/* ---------------- tillståndsmaskinen (två skärmar över en delad "transport") ---------------- */

function bus() {
  const subs = new Set<(m: { kind: string; payload: unknown }) => void>()
  return {
    endpoint() {
      const mine = (m: { kind: string; payload: unknown }) => void m
      return {
        send: (m: { kind: string; payload: unknown }) => {
          for (const s of subs) if (s !== mine) s(JSON.parse(JSON.stringify(m)))
        },
        subscribe: (h: (m: { kind: string; payload: unknown }) => void) => {
          subs.add(h)
          return () => subs.delete(h)
        },
      }
    },
  }
}

const CONFIG: EntreConfig = { stationTitle: 'Test', roles: ROLES, pilotRoster: group(6), clips: false }

describe('entrén (skärm-läget, en skärm)', () => {
  beforeEach(() => __resetEntreForTest(() => seededRng(42)))

  it('attract → valet person för person → utfall med chosen/assigned per band_id', () => {
    const e = initEntre({ stationN: 1, config: CONFIG })
    e.setScreen({ side: null, leader: true })
    e.start()
    expect(e.state.step).toBe('valet')
    const picks: RoleLetter[] = ['A', 'A', 'A', 'A', 'B', 'B']
    const order = e.myVoters.value.map((m) => m.band_id)
    for (const r of picks) {
      expect(e.state.turnStage).toBe('namn')
      e.showQuestion()
      e.vote(r)
    }
    expect(e.state.step).toBe('utfall')
    const p = e.personer.value
    expect(p).toHaveLength(6)
    expect(count(p, 'A')).toBe(3)
    for (const x of p) expect(x.chosen_role).toBe(picks[order.indexOf(x.band_id)])
    expect(p.filter((x) => x.chosen_role === 'B').every((x) => x.assigned_role === 'B')).toBe(true)
    e.finish()
    expect(e.state.step).toBe('klar')
  })

  it('rfid: rfidnej/rfidja → röster, senaste bippet gäller, okänt band ignoreras', () => {
    const e = initEntre({ stationN: 2, config: { ...CONFIG, voteMode: 'rfid' } })
    let onMsg: (t: string, p: { toString(): string }) => void = () => {}
    e.attachMqtt({ subscribe: () => {}, on: (_ev, cb) => (onMsg = cb) })
    e.start()
    const g = CONFIG.pilotRoster
    onMsg('station2/rfidja', { toString: () => 'FFFFFFFF' })
    expect(e.state.unknownBeep?.uid).toBe('FFFFFFFF')
    onMsg('station2/rfidja', { toString: () => g[0].band_id.toLowerCase() })
    onMsg('station2/rfidnej', { toString: () => g[0].band_id })
    expect(e.state.votes[g[0].band_id]).toBe('A')
    for (const m of g.slice(1)) onMsg('station2/rfidja', { toString: () => m.band_id })
    expect(e.state.step).toBe('utfall')
    const p = e.personer.value
    expect(p.find((x) => x.band_id === g[0].band_id)!.chosen_role).toBe('A')
    expect(p.every((x) => x.vote_side === null)).toBe(true)
  })
})

describe('entrén — två skärmar (sida A leder, sida B följer)', () => {
  it('varje sida röstar på sina egna; ledaren lottar och båda får samma utfall', () => {
    // Modulen är en singleton per flik → den andra skärmen simuleras som en annan
    // ändpunkt på samma transport (skärm B:s röster kommer in som entre:vote).
    __resetEntreForTest(() => seededRng(7))
    const b = bus()
    const e = initEntre({ stationN: 1, config: CONFIG })
    e.setScreen({ side: 'A', leader: true })
    e.attachTransport(b.endpoint())
    const other = b.endpoint()
    const got: unknown[] = []
    other.subscribe((m) => got.push(m))
    e.start()
    const mine = e.myVoters.value
    const theirs = CONFIG.pilotRoster.filter((m) => !mine.includes(m))
    expect(mine.length + theirs.length).toBe(6)
    for (const _ of mine) {
      e.showQuestion()
      e.vote('A')
    }
    expect(e.state.step).toBe('vantar')
    for (const m of theirs) other.send({ kind: 'entre:vote', payload: { run: 'pilot', band_id: m.band_id, role: 'B' } })
    expect(e.state.step).toBe('utfall')
    const result = got.find((m) => (m as { kind: string }).kind === 'entre:result') as { payload: { personer: unknown[] } }
    expect(result.payload.personer).toEqual(JSON.parse(JSON.stringify(e.personer.value)))
    expect(e.personer.value.every((x) => x.assigned_role === x.chosen_role)).toBe(true)
    expect(e.personer.value.every((x) => x.vote_side === (mine.some((m) => m.band_id === x.band_id) ? 'A' : 'B'))).toBe(true)
  })

  it('följarskärmen tar emot ledarens resultat', () => {
    __resetEntreForTest(() => seededRng(8))
    const b = bus()
    const e = initEntre({ stationN: 1, config: CONFIG })
    e.setScreen({ side: 'B', leader: false })
    e.attachTransport(b.endpoint())
    e.start()
    for (const _ of e.myVoters.value) {
      e.showQuestion()
      e.vote('B')
    }
    expect(e.state.step).toBe('vantar')
    expect(e.state.result).toBeNull()
    const personer = rebalance(CONFIG.pilotRoster, {}, ROLES, seededRng(1))
    b.endpoint().send({ kind: 'entre:result', payload: { run: 'pilot', personer } })
    expect(e.state.step).toBe('utfall')
    expect(e.personer.value).toEqual(personer)
    // Fel körning ignoreras
    e.reset()
    b.endpoint().send({ kind: 'entre:result', payload: { run: 'gammal', personer } })
    expect(e.state.result).toBeNull()
  })
})

