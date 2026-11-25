import { beforeEach, describe, expect, it } from 'vitest'
import { allocate, normGender, normUid, place, seededRng, splitBySide, voteFromTopic } from './logic'
import { __resetEntreForTest, initEntre } from './entre'
import { __resetRotationForTest, initRotation } from '../rotation/rotation'
import type { RotationClient } from '../rotation/types'
import type { EntreConfig, EntreMember, EntrePerson, EntreRole, RoleLetter, SideId } from './types'

/* ---------------- stationernas regler (speglar config.ts i st1–3, XY-PLATSER 2026-11-18) ---------------- */

const FORH: Pick<EntreConfig, 'roles' | 'placement'> = {
  placement: 'roll-inom-sida',
  roles: [
    { letter: 'A', rollvalRoleId: 'sandebud', name: 'Sändebud', min: 1, plats: 'sandebud' },
    { letter: 'B', rollvalRoleId: 'rapportor', name: 'Rapportör', min: 1, plats: 'rapportor' },
  ],
}
const MINNE: Pick<EntreConfig, 'roles' | 'placement'> = {
  roles: [
    { letter: 'A', rollvalRoleId: 'akthet', name: 'Teleingenjör', titel: 'Människa eller maskin', max: 3, plats: 'A.lur' },
    {
      letter: 'B',
      rollvalRoleId: 'sanning',
      name: 'Systemutvecklare',
      subRoles: [
        { id: 'mikrofon', name: 'Vid mikrofonen', count: 1, plats: 'B.mikrofon' },
        { id: 'ko', name: 'I kö', plats: 'B.ko' },
      ],
    },
  ],
}
const UNDERS: Pick<EntreConfig, 'roles' | 'placement'> = {
  roles: [
    { letter: 'A', rollvalRoleId: 'metod', name: 'Metodspecialist', titel: 'Labbtekniker', min: 1, plats: 'A.labb' },
    {
      letter: 'B',
      rollvalRoleId: 'dokt',
      name: 'Doktorand',
      min: 1,
      subRoles: [
        { id: 'skannare', name: 'Skannare', count: 1, plats: 'B.skannare' },
        { id: 'lyspenna', name: 'Lyspenna', count: 1, plats: 'B.lyspenna' },
        { id: 'logg', name: 'Logggranskare', plats: 'B.logg' },
      ],
    },
  ],
}
const ROLES = UNDERS.roles as [EntreRole, EntreRole]

function group(n: number, genders = 'mfmfmfmfmf'): EntreMember[] {
  return Array.from({ length: n }, (_, i) => ({
    band_id: `04A2B3${String(i).padStart(2, '0')}`,
    name: `P${i}`,
    gender: genders[i % genders.length] === 'm' ? 'man' : 'kvinna',
  }))
}
const all = (g: EntreMember[], r: RoleLetter) => Object.fromEntries(g.map((m) => [m.band_id, r])) as Record<string, RoleLetter>
const count = (p: EntrePerson[], r: RoleLetter) => p.filter((x) => x.assigned_role === r).length
const onSide = (p: EntrePerson[], s: SideId) => p.filter((x) => x.side === s)

describe('startsidor (splitBySide)', () => {
  const sides = (g: EntreMember[], seed: string) => {
    const s = splitBySide(g, seed)
    const on = (side: SideId, k: 'm' | 'f') => g.filter((m) => s[m.band_id] === side && normGender(m.gender) === k).length
    return { s, on }
  }
  it('4 killar + 2 tjejer → 2+1 per sida', () => {
    const { on } = sides(group(6, 'mmmmff'), 'x')
    expect([on('A', 'm'), on('B', 'm')]).toEqual([2, 2])
    expect([on('A', 'f'), on('B', 'f')]).toEqual([1, 1])
  })
  it('3 killar + 3 tjejer → 3+3, könen ±1', () => {
    const g = group(6, 'mfmfmf')
    const { s, on } = sides(g, 'run-1')
    expect(Object.values(s).filter((v) => v === 'A')).toHaveLength(3)
    expect(Math.abs(on('A', 'm') - on('B', 'm'))).toBeLessThanOrEqual(1)
    expect(Math.abs(on('A', 'f') - on('B', 'f'))).toBeLessThanOrEqual(1)
  })
  it('deterministisk: samma seed → samma halvor oavsett medlemsordning', () => {
    const g = group(7, 'mmfmffm')
    expect(splitBySide(g, 's:2')).toEqual(splitBySide([...g].reverse(), 's:2'))
  })
  it('vill_ej_ange fördelas så sidorna blir lika stora', () => {
    const g = [...group(4, 'mmff'), { band_id: 'X1', name: 'X', gender: 'vill_ej_ange' }, { band_id: 'X2', name: 'Y', gender: null }]
    expect(Object.values(splitBySide(g, 'q')).filter((v) => v === 'A')).toHaveLength(3)
  })
  it('medlemmens startsida (klasslista-importen) går före', () => {
    const g = group(6).map((m, i) => ({ ...m, startsida: (i < 3 ? 'B' : 'A') as SideId }))
    const s = splitBySide(g, 'vad-som-helst')
    g.forEach((m) => expect(s[m.band_id]).toBe(m.startsida))
  })
  it('delvis startsida: resten balanseras runt de fasta', () => {
    const g = group(6).map((m, i) => (i < 2 ? { ...m, startsida: 'A' as SideId } : m))
    const s = splitBySide(g, 'z')
    expect(Object.values(s).filter((v) => v === 'A')).toHaveLength(3)
    expect(s[g[0].band_id]).toBe('A')
  })
})

describe('placering — Människa eller maskin (lurar max 3, överskott till lögndetektorn)', () => {
  it.each([
    [4, 'A', 3, 1],
    [4, 'B', 0, 4],
    [6, 'B', 3, 3],
    [6, 'A', 3, 3],
    [7, 'A', 3, 4],
    [7, 'B', 0, 7],
  ] as const)('%i personer som alla vill %s → %i lurar + %i lögndetektor', (n, wish, a, b) => {
    const g = group(n)
    const p = place(g, all(g, wish), MINNE, splitBySide(g, 's'), seededRng(1))
    expect([count(p, 'A'), count(p, 'B')]).toEqual([a, b])
    expect(p.every((x) => x.chosen_role === wish)).toBe(true) // önskemålet oförändrat
    if (b > 0) expect(p.filter((x) => x.plats === 'B.mikrofon')).toHaveLength(1)
    expect(p.filter((x) => x.assigned_role === 'A').every((x) => x.plats === 'A.lur' && x.titel === 'Människa eller maskin')).toBe(true)
  })
  it('5 personer: önskemålen följs inom max 3', () => {
    const g = group(5)
    const v: Record<string, RoleLetter> = {}
    g.forEach((m, i) => (v[m.band_id] = i < 2 ? 'A' : 'B'))
    const p = place(g, v, MINNE, splitBySide(g, 's'), seededRng(2))
    expect(p.every((x) => x.assigned_role === x.chosen_role)).toBe(true)
  })
})

describe('placering — Undersökningen (labb / fält med underroller, båda tar fler)', () => {
  it('6 personer → alltid 3+3; fält får 1 skannare, 1 lyspenna, 1 logggranskare', () => {
    const g = group(6)
    const p = place(g, all(g, 'B'), UNDERS, splitBySide(g, 's'), seededRng(3))
    expect([count(p, 'A'), count(p, 'B')]).toEqual([3, 3])
    const sub = (id: string) => p.filter((x) => x.sub_role === id)
    expect([sub('skannare').length, sub('lyspenna').length, sub('logg').length]).toEqual([1, 1, 1])
    expect(sub('skannare')[0].plats).toBe('B.skannare')
    expect(sub('lyspenna')[0].titel).toBe('Lyspenna')
    expect(onSide(p, 'A').every((x) => x.plats === 'A.labb' && x.titel === 'Labbtekniker')).toBe(true)
  })
  it('7 som alla vill fält → minst 1 i labbet, 6 i fält (skannare, lyspenna, 4 logg)', () => {
    const g = group(7)
    const p = place(g, all(g, 'B'), UNDERS, splitBySide(g, 's'), seededRng(4))
    expect([count(p, 'A'), count(p, 'B')]).toEqual([1, 6])
    expect(p.filter((x) => x.sub_role === 'logg')).toHaveLength(4)
  })
  it('4 som alla vill labbet → 3 labb + 1 fält (skannaren)', () => {
    const g = group(4)
    const p = place(g, all(g, 'A'), UNDERS, splitBySide(g, 's'), seededRng(5))
    expect([count(p, 'A'), count(p, 'B')]).toEqual([3, 1])
    expect(p.find((x) => x.assigned_role === 'B')!.sub_role).toBe('skannare')
  })
  it('de som inte valt fyller sidan med minst folk; chosen_role = null', () => {
    const g = group(5)
    const p = place(g, { [g[0].band_id]: 'A' }, UNDERS, splitBySide(g, 's'), seededRng(6))
    expect(p.filter((x) => x.chosen_role === null)).toHaveLength(4)
    expect(Math.abs(count(p, 'A') - count(p, 'B'))).toBeLessThanOrEqual(1)
  })
})

describe('placering — Förhandlingen (lag = startsida; minst 1 sändebud + 1 rapportör per sida)', () => {
  it.each([4, 6, 7])('%i personer som alla vill vara sändebud → varje lag har minst en rapportör', (n) => {
    const g = group(n)
    const starts = splitBySide(g, 'sess:3')
    const p = place(g, all(g, 'A'), FORH, starts, seededRng(n))
    for (const side of ['A', 'B'] as SideId[]) {
      const lag = onSide(p, side)
      expect(lag.length).toBeGreaterThanOrEqual(2)
      expect(lag.filter((x) => x.assigned_role === 'B').length).toBeGreaterThanOrEqual(1)
      expect(lag.filter((x) => x.assigned_role === 'A').length).toBeGreaterThanOrEqual(1)
      expect(lag.every((x) => x.vote_side === side)).toBe(true) // man står kvar på sin startsida
      expect(lag.every((x) => x.plats === `${side}.${x.assigned_role === 'A' ? 'sandebud' : 'rapportor'}`)).toBe(true)
    }
    expect(p.every((x) => x.chosen_role === 'A')).toBe(true)
  })
  it('inget sändebud valt i ett lag → ett slumpas fram', () => {
    const g = group(6)
    const p = place(g, all(g, 'B'), FORH, splitBySide(g, 's'), seededRng(9))
    for (const side of ['A', 'B'] as SideId[]) expect(onSide(p, side).filter((x) => x.assigned_role === 'A')).toHaveLength(1)
  })
  it('blandade önskemål inom reglerna följs', () => {
    const g = group(6)
    const starts = splitBySide(g, 's')
    const v: Record<string, RoleLetter> = {}
    for (const side of ['A', 'B'] as SideId[]) g.filter((m) => starts[m.band_id] === side).forEach((m, i) => (v[m.band_id] = i === 0 ? 'A' : 'B'))
    const p = place(g, v, FORH, starts, seededRng(10))
    expect(p.every((x) => x.assigned_role === x.chosen_role)).toBe(true)
  })
})

describe('hjälp', () => {
  it('allocate: 5 → 3+2, 7 → 4+3', () => {
    expect(allocate(5, [3, 3])).toEqual([3, 2])
    expect(allocate(7, [3, 3])).toEqual([4, 3])
  })
  it('rfid: NEJ = vänster bild = roll A, JA = höger = roll B', () => {
    expect(voteFromTopic(3, 'station3/rfidnej')).toBe('A')
    expect(voteFromTopic(3, 'station3/rfidja')).toBe('B')
    expect(voteFromTopic(3, 'station2/rfidja')).toBeNull()
    expect(normUid(' 04:a2:b3:c4 ')).toBe('04A2B3C4')
  })
})

/* ---------------- tillståndsmaskinen ---------------- */

function bus() {
  const subs = new Set<(m: { kind: string; payload: unknown }) => void>()
  return {
    endpoint() {
      return {
        send: (m: { kind: string; payload: unknown }) => {
          for (const s of subs) s(JSON.parse(JSON.stringify(m)))
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
  beforeEach(() => {
    __resetRotationForTest()
    __resetEntreForTest(() => seededRng(42))
  })

  it('attract → (intro) → valet person för person → utfall med chosen/assigned/plats', () => {
    const e = initEntre({ stationN: 3, config: CONFIG })
    e.setScreen({ side: null, leader: true })
    e.setIntroAvailable(true)
    e.start()
    expect(e.state.step).toBe('intro')
    e.introDone()
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
    expect([count(p, 'A'), count(p, 'B')]).toEqual([3, 3])
    for (const x of p) expect(x.chosen_role).toBe(picks[order.indexOf(x.band_id)])
    expect(p.every((x) => x.plats)).toBe(true)
    e.finish()
    expect(e.state.step).toBe('klar')
  })

  it('rfid: rfidnej/rfidja → röster, senaste bippet gäller, okänt band ignoreras', () => {
    const e = initEntre({ stationN: 2, config: { ...CONFIG, voteMode: 'rfid' } })
    let onMsg: (t: string, p: { toString(): string }) => void = () => {}
    e.attachMqtt({ subscribe: () => {}, on: (_ev, cb) => (onMsg = cb) })
    e.start()
    e.arrived()
    const g = CONFIG.pilotRoster
    onMsg('station2/rfidja', { toString: () => 'FFFFFFFF' })
    expect(e.state.unknownBeep?.uid).toBe('FFFFFFFF')
    onMsg('station2/rfidja', { toString: () => g[0].band_id.toLowerCase() })
    onMsg('station2/rfidnej', { toString: () => g[0].band_id })
    expect(e.state.votes[g[0].band_id]).toBe('A')
    for (const m of g.slice(1)) onMsg('station2/rfidja', { toString: () => m.band_id })
    expect(e.state.step).toBe('utfall')
    expect(e.personer.value.find((x) => x.band_id === g[0].band_id)!.chosen_role).toBe('A')
  })
})

describe('entrén — startsidorna är samma i varje runda (seed session:grupp)', () => {
  it('runda 1 och runda 3 för samma grupp ger samma halvor', () => {
    __resetRotationForTest()
    __resetEntreForTest(() => seededRng(1))
    let deliver: (t: string, p: { toString(): string }) => void = () => {}
    const client: RotationClient = {
      publish: () => {},
      subscribe: () => {},
      on: ((ev: string, cb: (...a: never[]) => void) => {
        if (ev === 'message') deliver = cb as unknown as typeof deliver
      }) as RotationClient['on'],
    }
    initRotation({ stationN: 3, enabled: true, mqttUrl: '' }, client)
    const e = initEntre({ stationN: 3, config: CONFIG })
    const members = group(6, 'mmfmff').map((m) => ({ band_id: m.band_id, name: m.name, gender: m.gender }))
    const send = (round: number) =>
      deliver('station3/group', { toString: () => JSON.stringify({ session_id: 21826, round, group: 2, members }) })
    send(1)
    const r1 = { ...e.voteSides.value }
    send(3)
    expect(e.voteSides.value).toEqual(r1)
    expect(Object.values(r1).filter((v) => v === 'A')).toHaveLength(3)
  })
})

describe('entrén — två skärmar (sida A leder, sida B följer)', () => {
  it('varje startsida röstar på sina egna; ledaren placerar och båda får samma utfall', () => {
    __resetRotationForTest()
    __resetEntreForTest(() => seededRng(7))
    const b = bus()
    const e = initEntre({ stationN: 1, config: CONFIG })
    e.setScreen({ side: 'A', leader: true })
    e.attachTransport(b.endpoint())
    const other = b.endpoint()
    const got: unknown[] = []
    other.subscribe((m) => got.push(m))
    e.start()
    e.arrived()
    const mine = e.myVoters.value
    const theirs = CONFIG.pilotRoster.filter((m) => !mine.some((x) => x.band_id === m.band_id))
    expect(mine).toHaveLength(3)
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
  })

  it('följarskärmen tar emot ledarens resultat; fel körning ignoreras', () => {
    __resetRotationForTest()
    __resetEntreForTest(() => seededRng(8))
    const b = bus()
    const e = initEntre({ stationN: 1, config: CONFIG })
    e.setScreen({ side: 'B', leader: false })
    e.attachTransport(b.endpoint())
    e.start()
    e.arrived()
    for (const _ of e.myVoters.value) {
      e.showQuestion()
      e.vote('B')
    }
    expect(e.state.step).toBe('vantar')
    expect(e.state.result).toBeNull()
    const personer = place(CONFIG.pilotRoster, {}, CONFIG, {}, seededRng(1))
    b.endpoint().send({ kind: 'entre:result', payload: { run: 'pilot', personer } })
    expect(e.state.step).toBe('utfall')
    expect(e.personer.value).toEqual(personer)
    e.reset()
    b.endpoint().send({ kind: 'entre:result', payload: { run: 'gammal', personer } })
    expect(e.state.result).toBeNull()
  })
})

describe('entrén — bandlöst läge (station-kit/band, v49)', () => {
  function rotationWith(stationN: number) {
    __resetRotationForTest()
    let deliver: (t: string, p: { toString(): string }) => void = () => {}
    const client: RotationClient = {
      publish: () => {},
      subscribe: () => {},
      on: ((ev: string, cb: (...a: never[]) => void) => {
        if (ev === 'message') deliver = cb as unknown as typeof deliver
      }) as RotationClient['on'],
    }
    initRotation({ stationN, enabled: true, mqttUrl: '' }, client)
    return (payload: object) => deliver(`station${stationN}/group`, { toString: () => JSON.stringify(payload) })
  }
  // Som regi skickar en klasslista utan namn incheckad med bandlost.py: virtuella band + halva.
  const VIRTUELLA = [
    { band_id: 'V2A1', name: null, gender: 'kvinna', halva: 'A' },
    { band_id: 'V2A2', name: null, gender: 'man', halva: 'A' },
    { band_id: 'V2A3', name: 'Alma', gender: 'kvinna', halva: 'A' },
    { band_id: 'V2B1', name: null, gender: 'man', halva: 'B' },
    { band_id: 'V2B2', name: 'Fredrik', gender: 'man', halva: 'B' },
    { band_id: 'V2B3', name: null, gender: 'kvinna', halva: 'B' },
  ]

  it('regi:s halva blir startsidan; namnlösa visas med plats-koden', () => {
    __resetEntreForTest(() => seededRng(3))
    const send = rotationWith(3)
    const e = initEntre({ stationN: 3, config: CONFIG, bandlost: true })
    send({ session_id: 21826, round: 1, group: 2, members: VIRTUELLA })
    expect(e.voteSides.value).toEqual({ V2A1: 'A', V2A2: 'A', V2A3: 'A', V2B1: 'B', V2B2: 'B', V2B3: 'B' })
    expect(e.members.value.map((m) => m.name)).toEqual(['2A1', '2A2', 'Alma', '2B1', 'Fredrik', '2B3'])
  })

  it('bandlöst → skärm-läget en i taget per startsida; resultatet bär de virtuella banden', () => {
    __resetEntreForTest(() => seededRng(5))
    const send = rotationWith(3)
    const e = initEntre({ stationN: 3, config: { ...CONFIG, voteMode: 'rfid' }, bandlost: true })
    expect(e.state.voteMode).toBe('skarm')
    expect(e.state.bandlost).toBe(true)
    send({ session_id: 21826, round: 1, group: 2, members: VIRTUELLA })
    e.setScreen({ side: 'B', leader: true })
    expect(e.myVoters.value.map((m) => m.band_id)).toEqual(['V2B1', 'V2B2', 'V2B3'])
    e.setScreen({ side: null, leader: true })
    e.start()
    e.arrived()
    while (e.state.step === 'valet') {
      e.showQuestion()
      e.vote(e.currentVoter.value!.band_id.includes('A') ? 'A' : 'B')
    }
    expect(e.state.step).toBe('utfall')
    expect(e.personer.value.map((p) => p.band_id).sort()).toEqual(VIRTUELLA.map((m) => m.band_id).sort())
  })

  it('band (bandlost=false) → rfid-läget, även om stationens config säger skärm', () => {
    __resetRotationForTest()
    __resetEntreForTest()
    const e = initEntre({ stationN: 3, config: { ...CONFIG, voteMode: 'skarm' }, bandlost: false })
    expect(e.state.voteMode).toBe('rfid')
    expect(e.state.bandlost).toBe(false)
  })
})

describe('entrén v2 — attract = "ställ er på rätt sida" → stationsintro → rollval', () => {
  beforeEach(() => {
    __resetRotationForTest()
    __resetEntreForTest(() => seededRng(2))
  })

  it('utan intro-fil: start går direkt till rollvalet/valet (inget ankomst-steg)', () => {
    const e = initEntre({ stationN: 3, config: { ...CONFIG, clips: true } })
    e.start()
    expect(e.state.step).toBe('rollval')
  })

  it('med intro: start → intro → introDone → rollval; introDone utanför introt gör inget', () => {
    const e = initEntre({ stationN: 3, config: { ...CONFIG, clips: true, introClip: '/media/stationsintro/x.mp4' } })
    e.setIntroAvailable(true)
    e.introDone()
    expect(e.state.step).toBe('attract')
    e.start()
    expect(e.state.step).toBe('intro')
    e.introDone()
    expect(e.state.step).toBe('rollval')
  })

  it('med intro och clips:false → valet; facilitatorns "lotta nu" fungerar under introt', () => {
    const e = initEntre({ stationN: 3, config: CONFIG })
    e.setIntroAvailable(true)
    e.start()
    e.introDone()
    expect(e.state.step).toBe('valet')
    e.reset()
    e.start()
    expect(e.state.step).toBe('intro')
    e.skipVote()
    expect(e.state.step).toBe('utfall')
  })
})

describe('entrén — klippset per grupp ur DB (station<N>/group set_id + female_role)', () => {
  function rot(stationN: number) {
    __resetRotationForTest()
    let deliver: (t: string, p: { toString(): string }) => void = () => {}
    const client: RotationClient = {
      publish: () => {},
      subscribe: () => {},
      on: ((ev: string, cb: (...a: never[]) => void) => {
        if (ev === 'message') deliver = cb as unknown as typeof deliver
      }) as RotationClient['on'],
    }
    initRotation({ stationN, enabled: true, mqttUrl: '' }, client)
    return (p: object) => deliver(`station${stationN}/group`, { toString: () => JSON.stringify(p) })
  }
  const members = group(6).map((m) => ({ band_id: m.band_id, name: m.name, gender: m.gender }))
  const cfg2 = { ...CONFIG, clipSet: 0 as const, clipSetCount: 2, clipSetIds: [2, 1] }

  it('grupp 1 och 2 får olika klippset enligt DB; config-mappningen set_id → index följs', () => {
    __resetEntreForTest(() => seededRng(4))
    const send = rot(3)
    const e = initEntre({ stationN: 3, config: cfg2 })
    send({ session_id: 5, round: 1, group: 1, members, set_id: 1, female_role: 'A' })
    e.start()
    expect(e.state.clipSet).toBe(1) // set_id 1 = index 1 i [2, 1]
    e.reset()
    send({ session_id: 5, round: 2, group: 2, members, set_id: 2, female_role: 'B' })
    e.start()
    expect(e.state.clipSet).toBe(0)
  })

  it('role_presented_as följer den valda rollen och DB:ns female_role; lottad utan val → tilldelad roll', () => {
    __resetEntreForTest(() => seededRng(4))
    const send = rot(3)
    const e = initEntre({ stationN: 3, config: cfg2 })
    send({ session_id: 5, round: 1, group: 2, members, set_id: 2, female_role: 'B' })
    e.start()
    expect(e.presentedAs({ chosen_role: 'B', assigned_role: 'A' })).toBe('kvinnlig')
    expect(e.presentedAs({ chosen_role: 'A', assigned_role: 'B' })).toBe('manlig')
    expect(e.presentedAs({ chosen_role: null, assigned_role: 'B' })).toBe('kvinnlig')
  })

  it('utan set från regi (pilot/ingen DB): stationens config och role_presented_as null', () => {
    __resetEntreForTest(() => seededRng(4))
    const send = rot(3)
    const e = initEntre({ stationN: 3, config: { ...cfg2, clipSet: 1 } })
    send({ session_id: 5, round: 1, group: 1, members, set_id: null, female_role: null })
    e.start()
    expect(e.state.clipSet).toBe(1)
    expect(e.presentedAs({ chosen_role: 'A', assigned_role: 'A' })).toBeNull()
  })

  it('okänt set_id (inte i clipSetIds) → config, och role_presented_as null (vi vet inte vem som syntes)', () => {
    __resetEntreForTest(() => seededRng(4))
    const send = rot(3)
    const e = initEntre({ stationN: 3, config: cfg2 })
    send({ session_id: 5, round: 1, group: 1, members, set_id: 7, female_role: 'A' })
    e.start()
    expect(e.state.clipSet).toBe(0)
    expect(e.presentedAs({ chosen_role: 'A', assigned_role: 'A' })).toBeNull()
  })
})

describe('entrén — synkIntro (två skärmar väntar in varandra och spelar sekvensen i takt)', () => {
  const SYNK: EntreConfig = {
    ...CONFIG,
    clips: true,
    synkIntro: true,
    introClip: '/media/stationsintro/x.mp4',
    rollkort: { A: 'LABBTEKNIKER', B: 'FORENSIKER' },
  }
  /** Två entré-instanser går inte (singleton) → ledaren testas mot en "följare" som bara är bussen. */
  function ledare() {
    __resetRotationForTest()
    __resetEntreForTest(() => seededRng(3))
    const b = bus()
    const e = initEntre({ stationN: 3, config: SYNK })
    e.setScreen({ side: 'A', leader: true })
    e.attachTransport(b.endpoint())
    e.setIntroAvailable(true)
    const fran: { kind: string; payload: Record<string, unknown> }[] = []
    const foljare = b.endpoint()
    foljare.subscribe((m) => fran.push(m as (typeof fran)[number]))
    return { e, foljare, fran }
  }

  it('ledaren väntar på andra sidan; när båda står rätt startar sekvensen med introt', () => {
    const { e, foljare, fran } = ledare()
    e.start()
    expect(e.state.step).toBe('redo')
    expect(fran.some((m) => m.kind === 'entre:redo' && m.payload.side === 'A')).toBe(true)
    foljare.send({ kind: 'entre:redo', payload: { run: 'pilot', side: 'B' } })
    expect(e.state.step).toBe('sekvens')
    expect(e.state.seq?.steg).toBe('intro')
    expect(fran.some((m) => m.kind === 'entre:seq' && m.payload.steg === 'intro')).toBe(true)
  })

  it('andra sidan redo först → sekvensen startar när ledaren trycker', () => {
    const { e, foljare } = ledare()
    foljare.send({ kind: 'entre:redo', payload: { run: 'pilot', side: 'B' } })
    expect(e.state.step).toBe('attract')
    e.start()
    expect(e.state.seq?.steg).toBe('intro')
  })

  it('ledaren går igenom stegen; följarens "nästa" för fel steg ignoreras; sist → valet', () => {
    const { e, foljare, fran } = ledare()
    e.start()
    foljare.send({ kind: 'entre:redo', payload: { run: 'pilot', side: 'B' } })
    const ordning = ['intro', 'brygga1', 'kortA', 'klippA', 'brygga2', 'kortB', 'klippB'] as const
    for (const [i, s] of ordning.entries()) {
      expect(e.state.seq?.steg).toBe(s)
      if (i > 0) foljare.send({ kind: 'entre:seqNext', payload: { run: 'pilot', steg: ordning[i - 1] } }) // gammalt steg
      expect(e.state.seq?.steg).toBe(s)
      if (i % 2) e.seqNext(s) // ledarens eget "klart"
      else foljare.send({ kind: 'entre:seqNext', payload: { run: 'pilot', steg: s } }) // tryck på följaren
    }
    expect(e.state.step).toBe('valet')
    expect(fran.some((m) => m.kind === 'entre:seq' && m.payload.steg === 'klar')).toBe(true)
  })

  it('lotta nu medan skärmen väntar → utfall', () => {
    const { e } = ledare()
    e.start()
    e.skipVote()
    expect(e.state.step).toBe('utfall')
  })

  it('följaren: väntar, följer ledarens steg och klippset, och ber ledaren om nästa', () => {
    __resetRotationForTest()
    __resetEntreForTest(() => seededRng(4))
    const b = bus()
    const e = initEntre({ stationN: 3, config: SYNK })
    e.setScreen({ side: 'B', leader: false })
    e.attachTransport(b.endpoint())
    const led = b.endpoint()
    const fran: { kind: string; payload: Record<string, unknown> }[] = []
    led.subscribe((m) => fran.push(m as (typeof fran)[number]))
    e.start()
    expect(e.state.step).toBe('redo')
    led.send({ kind: 'entre:seq', payload: { run: 'pilot', steg: 'brygga1', at: 123, clipSet: 1 } })
    expect(e.state.step).toBe('sekvens')
    expect(e.state.seq).toEqual({ steg: 'brygga1', at: 123 })
    expect(e.state.clipSet).toBe(1)
    e.seqNext('brygga1')
    expect(e.state.seq?.steg).toBe('brygga1') // följaren går inte själv
    expect(fran.some((m) => m.kind === 'entre:seqNext' && m.payload.steg === 'brygga1')).toBe(true)
    led.send({ kind: 'entre:seq', payload: { run: 'pilot', steg: 'klar', at: 456 } })
    expect(e.state.step).toBe('valet')
  })

  it('utan synkIntro (eller en delad skärm) beter sig entrén som förut', () => {
    __resetRotationForTest()
    __resetEntreForTest(() => seededRng(5))
    const e = initEntre({ stationN: 3, config: SYNK })
    e.setScreen({ side: null, leader: true })
    e.attachTransport(bus().endpoint())
    e.setIntroAvailable(true)
    e.start()
    expect(e.state.step).toBe('intro')
  })
})
