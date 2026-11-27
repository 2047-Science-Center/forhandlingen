import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initLjus, __resetLjusForTest, type LjusClient } from './stationLjus'
import { FARG, VALVDIM, VALVFARG, dampa } from './kanon'
import { chaseValv, kompilera, lasSpar, malIntervall, nastaVag, ramTillSegment, tillampa, type SparKontext } from './underglowSpar'

type Msg = { topic: string; payload: any; retain: boolean }

function fakeClient() {
  const sent: Msg[] = []
  const handlers: Record<string, (...a: any[]) => void> = {}
  const subs: string[] = []
  const c: LjusClient = {
    publish: (topic, payload, o) => sent.push({ topic, payload: JSON.parse(payload), retain: !!o?.retain }),
    subscribe: (t) => subs.push(t),
    on: (ev: string, cb: any) => {
      handlers[ev] = cb
    },
  }
  return {
    c,
    sent,
    subs,
    connect: () => handlers.connect?.(),
    msg: (topic: string, obj: object | string) =>
      handlers.message?.(topic, { toString: () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) }),
  }
}

/** Standardslingan som st1/st3 har den (sidorna, utan delar). */
const SEG: Record<string, [number, number]> = { A: [0, 69], B: [70, 140] }
const ST4: Record<string, [number, number]> = {
  'falt.1a': [0, 23],
  gyro: [24, 45],
  'falt.2a': [46, 69],
  'falt.2b': [70, 94],
  puls: [95, 116],
  'falt.1b': [117, 140],
}

const flush = () => vi.advanceTimersByTimeAsync(0)

describe('underglow-spåren: ren logik', () => {
  const ctx = (segment = SEG, delad = false): SparKontext => ({
    valv: 'teknolog',
    segment,
    fasLook: { color: FARG.amberDim, effekt: 'static' },
    delad,
  })

  it('dampa: linjärt per kanal (#ff9500 × 0,35 ≈ #5a3400, samma ton)', () => {
    expect(dampa('#ff9500')).toBe('#593400')
    expect(VALVDIM.teknolog).toBe(dampa(VALVFARG.teknolog))
  })

  it('kompilera: valv-filter + runt = sex delar 30 ms isär', () => {
    const spar = lasSpar({ rader: [{ t: 1, valv: 'diplomat', mal: 'alla', effekt: 'av' }, { t: 2, mal: 'runt', color: 'valv' }] })!
    const steg = kompilera(spar, 'teknolog')
    expect(steg.map((s) => [s.ms, s.rad.mal])).toEqual([
      [2000, 'A.1'],
      [2030, 'A.2'],
      [2060, 'A.3'],
      [2090, 'B.1'],
      [2120, 'B.2'],
      [2150, 'B.3'],
    ])
  })

  it('delar ritas ovanpå sidorna; en större ruta tar bort delarna inom sig', () => {
    let ram = tillampa([], { t: 0, mal: 'alla', color: 'amberDim' }, ctx())
    ram = tillampa(ram, { t: 1, mal: ['A.1', 'B.1'], color: 'amber' }, ctx())
    const seg = ramTillSegment(ram, ctx())
    expect(seg.map((s) => [s.id, s.from, s.to, s.color])).toEqual([
      ['A', 0, 69, FARG.amberDim],
      ['B', 70, 140, FARG.amberDim],
      ['A.1', 0, 23, FARG.amber],
      ['B.1', 70, 94, FARG.amber],
    ])
    ram = tillampa(ram, { t: 2, mal: 'alla', color: 'valv', effekt: 'puls' }, ctx())
    expect(ramTillSegment(ram, ctx())).toEqual([
      { id: 'A', from: 0, to: 69, color: VALVFARG.teknolog, effekt: 'puls' },
      { id: 'B', from: 70, to: 140, color: VALVFARG.teknolog, effekt: 'puls' },
    ])
  })

  it('st4: standardslingans delar = stationens sex sidor (inga extra segment)', () => {
    const ram = tillampa([], { t: 0, mal: 'A.2', color: '#ff0000' }, ctx(ST4))
    const seg = ramTillSegment(ram, ctx(ST4))
    expect(seg).toHaveLength(6)
    expect(seg.find((s) => s.id === 'gyro')).toMatchObject({ color: '#ff0000' })
    expect(seg.find((s) => s.id === 'puls')).toMatchObject({ color: FARG.amberDim })
  })

  it('delad station (st2): bara egna id:n, klippt till sidan', () => {
    const sidaA: Record<string, [number, number]> = { A: [0, 69], 'A.lur1': [0, 23], 'A.lur2': [24, 45], 'A.lur3': [46, 69] }
    expect(malIntervall('A.2', ctx(sidaA, true))).toEqual([{ id: 'A.lur2', from: 24, to: 45 }])
    expect(malIntervall('B.2', ctx(sidaA, true))).toEqual([])
    expect(malIntervall('B.2', ctx({ B: [70, 140] }, true))).toEqual([{ id: 'B', from: 70, to: 140 }])
    const ram = tillampa([], { t: 0, mal: 'A.1', color: '#ff0000' }, ctx(sidaA, true))
    expect(ramTillSegment(ram, ctx(sidaA, true)).map((s) => [s.id, s.color])).toEqual([
      ['A', FARG.amberDim],
      ['A.lur1', '#ff0000'],
      ['A.lur2', FARG.amberDim],
      ['A.lur3', FARG.amberDim],
    ])
  })

  it('chaseValv = ringens formel: landar på mal', () => {
    expect(chaseValv(0, 5000, 2)).toBe(2) // (2 − 20) mod 4
    expect(chaseValv(5000, 5000, 3)).toBe(3)
  })

  it('attract-vågen: var 20:e s, 0,5 s isär i gångordningen', () => {
    expect(nastaVag(1_000_000, 0)).toBe(1_020_000)
    expect(nastaVag(1_000_000, 3)).toBe(1_001_500)
    expect(nastaVag(1_001_500, 3)).toBe(1_021_500)
  })
})

describe('underglow-spåren: stationen spelar', () => {
  beforeEach(() => {
    __resetLjusForTest()
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => vi.useRealTimers())

  const TRAILER = {
    namn: 'trailer',
    forskjut_ms: 0,
    rader: [
      { t: 0, mal: 'alla', effekt: 'av' },
      { t: 0.46, mal: 'alla', gest: 'blixt' },
      { t: 2, valv: 'teknolog', mal: 'runt', color: 'valv', effekt: 'static' },
      { t: 3, valv: 'forskning', mal: 'alla', color: 'valv', effekt: 'static' },
    ],
  }

  function start(o: { valv?: any; segment?: Record<string, [number, number]>; sida?: 'A' | 'B'; egna?: string[] } = {}) {
    const f = fakeClient()
    const hamtaSpar = vi.fn(async (namn: string) => (namn === 'trailer' ? TRAILER : null))
    initLjus(
      {
        stationN: 2,
        enabled: true,
        mqttUrl: '',
        valv: o.valv ?? 'teknolog',
        segment: o.segment ?? SEG,
        sida: o.sida ?? null,
        egna: o.egna ?? [],
        hamtaSpar,
      },
      f.c,
    )
    f.connect()
    const topic = o.sida ? `station2/underglow/${o.sida}` : 'station2/underglow'
    const bas = () => f.sent.filter((m) => m.topic === topic).at(-1)!.payload
    const fb = () => f.sent.filter((m) => m.topic === 'station2/feedback')
    return { f, bas, fb, hamtaSpar }
  }

  it('prenumererar på filmernas startsignaler (ingen ny topic)', () => {
    const { f } = start()
    for (const t of ['film/start', 'film/stop', 'reveal/film/start', 'reveal/film/stop', 'regi/round']) expect(f.subs).toContain(t)
  })

  it('trailern: spåret följer film/start, valvets rader bara på rätt station, gesten på feedback', async () => {
    const { f, bas, fb } = start()
    f.msg('regi/phase', { phase: 'trailer' })
    expect(bas().segments[0]).toMatchObject({ color: FARG.amberDim, effekt: 'static' })
    f.msg('film/start', { film: 'trailer', fas: 'trailer', start_at_ms: 1_005_000 })
    await flush()
    vi.advanceTimersByTime(5000) // t = 0
    expect(bas().lage).toBe('spar:trailer')
    expect(bas().segments.map((s: any) => s.effekt)).toEqual(['av', 'av'])
    vi.advanceTimersByTime(460)
    expect(fb().at(-1)!.payload).toMatchObject({ gest: 'blixt', segments: [{ id: 'A', from: 0, to: 69, color: FARG.blixt }, { id: 'B', from: 70, to: 140 }] })
    vi.advanceTimersByTime(2000 - 460 + 150) // runt klart
    const seg = bas().segments
    expect(seg.map((s: any) => s.id)).toEqual(['A', 'B'])
    expect(seg.every((s: any) => s.color === VALVFARG.teknolog && s.effekt === 'static')).toBe(true)
    vi.advanceTimersByTime(1000) // forskning-raden gäller inte st2
    expect(bas().segments[0].color).toBe(VALVFARG.teknolog)
    // Fasbyte → spåret släpps, stationens eget läge gäller igen.
    f.msg('regi/phase', { phase: 'intro' })
    expect(bas().lage).toBe('intro')
    expect(bas().segments[0]).toMatchObject({ color: FARG.amberDim, effekt: 'static' })
  })

  it('kommer in sent: passerade rader läggs på direkt, passerade gester spelas inte', async () => {
    const { f, bas, fb } = start()
    f.msg('regi/phase', { phase: 'trailer' })
    f.msg('film/start', { film: 'trailer', fas: 'trailer', start_at_ms: 1_000_000 - 2500 })
    await flush()
    expect(bas().segments[0]).toMatchObject({ color: VALVFARG.teknolog })
    expect(fb()).toHaveLength(0)
    // Samma retained signal igen (återanslutning) startar inte om spåret.
    const n = f.sent.length
    f.msg('film/start', { film: 'trailer', fas: 'trailer', start_at_ms: 1_000_000 - 2500 })
    await flush()
    expect(f.sent.length).toBe(n)
  })

  it('saknat spår → fasens bas (inget händer)', async () => {
    const { f, bas, hamtaSpar } = start()
    f.msg('regi/phase', { phase: 'intro' })
    f.msg('film/start', { film: 'intro', fas: 'intro', start_at_ms: 1_000_000 })
    await flush()
    expect(hamtaSpar).toHaveBeenCalledWith('intro')
    expect(bas().lage).toBe('intro')
  })

  it('st2 sida A: spåret ritar bara sidans egna segment på station2/underglow/A', async () => {
    const seg = { A: [0, 69], 'A.lur1': [0, 23], 'A.lur2': [24, 45], 'A.lur3': [46, 69], B: [70, 140] } as Record<string, [number, number]>
    const { f, bas } = start({ segment: seg, sida: 'A', egna: ['A', 'A.lur1', 'A.lur2', 'A.lur3'] })
    f.msg('regi/phase', { phase: 'trailer' })
    f.msg('film/start', { film: 'trailer', fas: 'trailer', start_at_ms: 1_000_000 - 2010 })
    await flush()
    // Vid t = 2,01 har bara A.1 hunnit tändas (runt, 30 ms isär).
    expect(bas().segments.map((s: any) => [s.id, s.effekt])).toEqual([
      ['A', 'av'],
      ['A.lur1', 'static'],
      ['A.lur2', 'av'],
      ['A.lur3', 'av'],
    ])
    expect(f.sent.some((m) => m.topic === 'station2/underglow')).toBe(false)
  })

  it('bron startar vid LIVE-bytet till sortering och hjärtslagen väntar tills den är slut', async () => {
    const f = fakeClient()
    const bron = { namn: 'bron', slut_s: 10.5, rader: [{ t: 0, mal: 'alla', effekt: 'av' }, { t: 2.5, mal: 'runt', color: 'valv' }] }
    initLjus({ stationN: 3, enabled: true, mqttUrl: '', valv: 'forskning', segment: SEG, hamtaSpar: async (n) => (n === 'bron' ? bron : null) }, f.c)
    f.connect()
    f.msg('regi/phase', { phase: 'reveal' })
    f.msg('regi/phase', { phase: 'sortering' })
    await flush()
    const bas = () => f.sent.filter((m) => m.topic === 'station3/underglow').at(-1)!.payload
    expect(bas().segments[0].effekt).toBe('av')
    f.msg('station3/valdi', { lage: 'hjarta' })
    expect(f.sent.filter((m) => m.topic === 'station3/feedback')).toHaveLength(0)
    vi.advanceTimersByTime(3000)
    expect(bas().segments[0]).toMatchObject({ color: VALVFARG.forskning, effekt: 'static' })
    vi.advanceTimersByTime(8000) // slut_s → sorteringens bas
    expect(bas().segments[0]).toMatchObject({ color: FARG.amberDim, effekt: 'static' })
    f.msg('station3/valdi', { lage: 'hjarta' })
    expect(f.sent.filter((m) => m.topic === 'station3/feedback')).toHaveLength(1)
  })

  it('retained sortering vid anslutning startar INTE bron', async () => {
    const f = fakeClient()
    const hamtaSpar = vi.fn(async () => null)
    initLjus({ stationN: 3, enabled: true, mqttUrl: '', valv: 'forskning', segment: SEG, hamtaSpar }, f.c)
    f.connect()
    f.msg('regi/phase', { phase: 'sortering' })
    await flush()
    expect(hamtaSpar).not.toHaveBeenCalled()
  })

  it('VALdi analyserar: vagnen snurrar valvfärgerna (≤ 3 byten/s) och landar på mal', () => {
    const f = fakeClient()
    initLjus({ stationN: 3, enabled: true, mqttUrl: '', valv: 'forskning', segment: SEG, hamtaSpar: async () => null }, f.c)
    f.connect()
    f.msg('regi/phase', { phase: 'sortering' })
    const bas = () => f.sent.filter((m) => m.topic === 'station3/underglow')
    const fore = bas().length
    f.msg('station3/valdi', { lage: 'chase', mal: 1, ms: 6000 })
    vi.advanceTimersByTime(1000)
    expect(bas().length - fore).toBeLessThanOrEqual(4) // 0 ms + högst var 340:e ms
    vi.advanceTimersByTime(6000)
    expect(bas().at(-1)!.payload.segments[0]).toMatchObject({ color: VALVFARG.diplomat, effekt: 'static' })
    f.msg('station3/valdi', { lage: 'paus' }) // handen ut ändrar inget
    expect(bas().at(-1)!.payload.segments[0].color).toBe(VALVFARG.diplomat)
    f.msg('station3/valdi', { lage: 'vila' })
    expect(bas().at(-1)!.payload.segments[0]).toMatchObject({ color: FARG.amberDim })
  })

  it('idle: bärnsten andas och vågen går i egen valvfärg var 20:e s (st2 sist i gångordningen)', () => {
    const { f, bas, fb } = start()
    f.msg('regi/phase', { phase: 'idle' })
    expect(bas().segments[0]).toMatchObject({ color: FARG.amber, effekt: 'puls' })
    vi.advanceTimersByTime(1500) // 1_001_500 = st2:s plats (index 3 × 0,5 s)
    expect(fb()).toHaveLength(1)
    expect(fb()[0].payload).toMatchObject({ gest: 'vag', segments: [{ id: 'A', color: VALVFARG.teknolog, tempo: 1200, antal: 1 }, { id: 'B' }] })
    vi.advanceTimersByTime(20000)
    expect(fb()).toHaveLength(2)
    f.msg('regi/phase', { phase: 'incheckning' })
    vi.advanceTimersByTime(40000)
    expect(fb()).toHaveLength(2)
  })

  it('bytet: live regi/round byte → spårets kvitto', async () => {
    const f = fakeClient()
    const byte = { namn: 'byte', rader: [{ t: 0, mal: 'alla', gest: 'kvitto' }] }
    initLjus({ stationN: 1, enabled: true, mqttUrl: '', valv: 'diplomat', segment: SEG, hamtaSpar: async (n) => (n === 'byte' ? byte : null) }, f.c)
    f.connect()
    f.msg('regi/phase', { phase: 'rotation' })
    f.msg('regi/round', { round: 1, state: 'runda' })
    f.msg('regi/round', { round: 2, state: 'byte' })
    await flush()
    vi.advanceTimersByTime(10)
    expect(f.sent.filter((m) => m.topic === 'station1/feedback').at(-1)!.payload).toMatchObject({ gest: 'kvitto' })
  })

  it('?spar=0 / spar:false → inga spår, ingen våg', async () => {
    const f = fakeClient()
    const hamtaSpar = vi.fn(async () => TRAILER)
    initLjus({ stationN: 2, enabled: true, mqttUrl: '', valv: 'teknolog', segment: SEG, spar: false, hamtaSpar }, f.c)
    f.connect()
    f.msg('regi/phase', { phase: 'trailer' })
    f.msg('film/start', { film: 'trailer', fas: 'trailer', start_at_ms: 1_000_000 })
    await flush()
    expect(hamtaSpar).not.toHaveBeenCalled()
    expect(f.subs).not.toContain('film/start')
  })
})
