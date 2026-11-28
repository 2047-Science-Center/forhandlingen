import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initLjus, useLjus, __resetLjusForTest, type LjusClient } from './stationLjus'
import { lageFranRotation, medSaHarBlevDet, lageLook, regiLook, sidaForSegment, FARG, SIDFARG, VALVFARG } from './kanon'

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
    msg: (topic: string, obj: object) => handlers.message?.(topic, { toString: () => JSON.stringify(obj) }),
  }
}

const SEG = { A: [0, 29] as [number, number], B: [30, 59] as [number, number] }

describe('station-kit/ljus', () => {
  beforeEach(() => {
    __resetLjusForTest()
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => vi.useRealTimers())

  it('publicerar hela basen retained på station<N>/underglow vid connect (följer regi utanför rotationen)', () => {
    const f = fakeClient()
    initLjus({ stationN: 3, enabled: true, mqttUrl: '', valv: 'forskning', segment: SEG }, f.c)
    expect(f.subs).toContain('regi/phase')
    f.connect()
    f.msg('regi/phase', { phase: 'reveal' })
    const last = f.sent.filter((m) => m.topic === 'station3/underglow').at(-1)!
    expect(last.retain).toBe(true)
    expect(last.payload.segments).toEqual([
      { id: 'A', from: 0, to: 29, color: FARG.stal, effekt: 'static' },
      { id: 'B', from: 30, to: 59, color: FARG.stal, effekt: 'static' },
    ])
  })

  it('stationens läge går före regi, och publicerar bara vid ändring', () => {
    const f = fakeClient()
    const l = initLjus({ stationN: 1, enabled: true, mqttUrl: '', valv: 'diplomat', segment: SEG }, f.c)
    f.connect()
    l.lage('tutorial')
    l.lage('tutorial')
    const ug = f.sent.filter((m) => m.topic === 'station1/underglow')
    expect(ug.at(-1)!.payload.segments[0]).toMatchObject({ color: FARG.tutorial, effekt: 'static' })
    expect(ug.filter((m) => m.payload.lage === 'tutorial')).toHaveLength(1)
  })

  it('trailern går före stationens läge (dämpad amber fast), sedan tillbaka', () => {
    const f = fakeClient()
    const l = initLjus({ stationN: 3, enabled: true, mqttUrl: '', valv: 'forskning', segment: SEG }, f.c)
    f.connect()
    l.lage('startsida')
    f.msg('regi/phase', { phase: 'trailer' })
    const a = () => f.sent.filter((m) => m.topic === 'station3/underglow').at(-1)!.payload.segments[0]
    expect(a()).toMatchObject({ color: FARG.amberDim, effekt: 'static' })
    f.msg('regi/phase', { phase: 'rotation' })
    expect(a()).toMatchObject({ color: SIDFARG.A.led, effekt: 'static' })
  })

  it('VALdi under sorteringen: hjärtslag = amber lub-dub över hela vagnen, dom = valvfärg tills nästa person', () => {
    const f = fakeClient()
    const l = initLjus({ stationN: 3, enabled: true, mqttUrl: '', valv: 'forskning', segment: SEG }, f.c)
    f.connect()
    expect(f.subs).toContain('station3/valdi')
    f.msg('station3/valdi', { lage: 'hjarta' })
    expect(f.sent.filter((m) => m.topic === 'station3/feedback')).toHaveLength(0) // inte i sorteringen än
    l.lage('lek')
    f.msg('regi/phase', { phase: 'sortering' })
    expect(f.sent.filter((m) => m.topic === 'station3/underglow').at(-1)!.payload.segments[0]).toMatchObject({ color: FARG.amberDim }) // går före lek/startsida
    f.msg('station3/valdi', { lage: 'hjarta' })
    const fb = f.sent.filter((m) => m.topic === 'station3/feedback').at(-1)!
    expect(fb.retain).toBe(false)
    expect(fb.payload.segments.map((s: { id: string }) => s.id)).toEqual(['A', 'B'])
    expect(fb.payload.segments[0]).toMatchObject({ color: FARG.amber, antal: 2 })
    const bas = () => f.sent.filter((m) => m.topic === 'station3/underglow').at(-1)!.payload.segments
    f.msg('station3/valdi', { lage: 'dom', color: '#ff5a3c' })
    // Domen: basen släckt + 3 blink i valvfärgen (feedback), sedan hela vagnen fast i färgen.
    expect(bas().map((s: { effekt: string }) => s.effekt)).toEqual(['av', 'av'])
    expect(f.sent.filter((m) => m.topic === 'station3/feedback').at(-1)!.payload).toMatchObject({
      gest: 'dom',
      segments: [{ id: 'A', color: '#ff5a3c', tempo: 400, antal: 3 }, { id: 'B' }],
    })
    vi.advanceTimersByTime(1200)
    expect(bas().map((s: { color: string }) => s.color)).toEqual(['#ff5a3c', '#ff5a3c'])
    f.msg('station3/valdi', { lage: 'blixt' })
    expect(bas()[0].color).toBe('#ff5a3c')
    f.msg('station3/valdi', { lage: 'vila' })
    expect(bas()[0]).toMatchObject({ color: FARG.amberDim, effekt: 'static' })
  })

  it('gest = ej retained feedback på rätt segment + kanoniskt ljud', () => {
    const f = fakeClient()
    const spela = vi.fn()
    const l = initLjus({ stationN: 3, enabled: true, mqttUrl: '', valv: 'forskning', segment: SEG, spela }, f.c)
    l.gest('ratt', ['B'])
    const fb = f.sent.find((m) => m.topic === 'station3/feedback')!
    expect(fb.retain).toBe(false)
    expect(fb.payload).toEqual({
      gest: 'ratt',
      segments: [{ id: 'B', from: 30, to: 59, color: FARG.gron, tempo: 300, antal: 2 }],
    })
    expect(spela).toHaveBeenCalledWith('ratt')
  })

  it('prioritet + spärr: lägre gest under en högre ignoreras, högre avbryter', () => {
    const f = fakeClient()
    const l = initLjus({ stationN: 3, enabled: true, mqttUrl: '', valv: 'forskning', segment: SEG }, f.c)
    expect(l.gest('fel', ['B'])).toBe(1)
    expect(l.gest('kvitto', ['B'])).toBe(0) // under fel → ignoreras
    expect(l.gest('kvitto', ['A'])).toBe(1) // annat segment → ok
    vi.advanceTimersByTime(1600)
    expect(l.gest('kvitto', ['B'])).toBe(1) // spärren slut
    expect(l.gest('fel', ['B'])).toBe(1) // högre avbryter
    expect(l.gest('vinst', ['B'])).toBe(1) // utfall avbryter alltid
  })

  it('vinst = blink + varaktig grön bas; forlorarsida = dämpad bas utan blink', () => {
    const f = fakeClient()
    const spela = vi.fn()
    const l = initLjus({ stationN: 1, enabled: true, mqttUrl: '', valv: 'diplomat', segment: SEG, spela }, f.c)
    l.lage('skarp')
    l.utfall('vinst', ['A'])
    l.utfall('forlorarsida', ['B'])
    expect(l.state.bas.A).toEqual({ color: FARG.gron, effekt: 'static' })
    expect(l.state.bas.B).toEqual({ color: FARG.amberDim, effekt: 'static' })
    expect(f.sent.filter((m) => m.topic === 'station1/feedback')).toHaveLength(1)
    expect(spela).toHaveBeenCalledWith('vinst')
    expect(spela).toHaveBeenCalledWith('neutral')
  })

  it('varning påverkar bara segment i skarpt läge', () => {
    const l = initLjus({ stationN: 3, enabled: false, mqttUrl: '', valv: 'forskning', segment: SEG })
    l.lage('skarp', ['A'])
    l.lage('lek', ['B'])
    l.varning(2)
    expect(l.state.bas.A.effekt).toBe('blink')
    expect(l.state.bas.B).toEqual({ color: FARG.lek, effekt: 'puls' })
    l.varning(0)
    expect(l.state.bas.A).toEqual({ color: FARG.skarp, effekt: 'static' })
  })

  it('delad station: bara egna segment på station<N>/underglow/<sida>, ingen ompublicering', () => {
    const f = fakeClient()
    const l = initLjus(
      { stationN: 2, enabled: true, mqttUrl: '', valv: 'teknolog', segment: SEG, egna: ['B'], sida: 'B' },
      f.c,
    )
    f.connect()
    const first = f.sent.at(-1)!
    expect(first.topic).toBe('station2/underglow/B')
    expect(first.payload.ersatt).toBeUndefined()
    expect(first.payload.segments.map((s: any) => s.id)).toEqual(['B'])
    const n = f.sent.length
    vi.advanceTimersByTime(60000)
    expect(f.sent.length).toBe(n)
    l.lage('skarp')
    l.gest('kvitto', ['B'])
    expect(f.sent.slice(n).map((m) => m.topic)).toEqual(['station2/underglow/B', 'station2/feedback'])
    expect(f.sent.some((m) => m.topic === 'station2/underglow')).toBe(false)
  })

  it('följarfönster (skrivare:false) publicerar ingen bas men får skicka gester', () => {
    const f = fakeClient()
    const l = initLjus({ stationN: 1, enabled: true, mqttUrl: '', valv: 'diplomat', segment: SEG, skrivare: false }, f.c)
    f.connect()
    l.lage('skarp')
    l.gest('kvitto', ['B'])
    expect(f.sent.map((m) => m.topic)).toEqual(['station1/feedback'])
  })

  it('station<N>/hitta: hela vagnen i målfärgen i `sekunder`, sedan tillbaka; sekunder 0 släcker', () => {
    const f = fakeClient()
    const l = initLjus({ stationN: 2, enabled: true, mqttUrl: '', valv: 'teknolog', segment: SEG }, f.c)
    expect(f.subs).toContain('station2/hitta')
    f.connect()
    l.lage('lek')
    f.msg('station2/hitta', { valv: 'drift', color: '#e8c020', sekunder: 5, band_id: 'B1' })
    expect(l.state.hitta?.valv).toBe('drift')
    let ug = f.sent.filter((m) => m.topic === 'station2/underglow').at(-1)!
    expect(ug.payload.segments.map((s: any) => s.color)).toEqual(['#e8c020', '#e8c020'])
    vi.advanceTimersByTime(5000)
    expect(l.state.hitta).toBeNull()
    ug = f.sent.filter((m) => m.topic === 'station2/underglow').at(-1)!
    expect(ug.payload.segments[0]).toMatchObject({ color: FARG.lek, effekt: 'puls' })
    f.msg('station2/hitta', { valv: 'drift', color: '#e8c020', sekunder: 5 })
    f.msg('station2/hitta', { valv: 'drift', color: '#e8c020', sekunder: 0 })
    expect(l.state.hitta).toBeNull()
  })

  it('no-op före init', () => {
    const l = useLjus()
    expect(() => {
      l.lage('skarp')
      l.gest('ratt')
      l.varning(1)
    }).not.toThrow()
  })

  it('kanon: rotation → läge och regi → valvfärg', () => {
    expect(lageFranRotation('group', null)).toBe('startsida')
    expect(lageFranRotation('running', 'tutorial')).toBe('tutorial')
    expect(lageFranRotation('running', 'skarp')).toBe('skarp')
    expect(lageFranRotation('lek', 'lek')).toBe('lek')
    expect(lageFranRotation('waiting', null)).toBeNull()
    expect(regiLook('idle', 'drift')).toEqual({ color: FARG.amber, effekt: 'puls' }) // manus §4.1: bärnsten + vågen
    expect(regiLook('klart', 'drift')).toEqual({ color: VALVFARG.drift, effekt: 'puls' }) // reserv utan capstone-spår
    expect(regiLook('rotation', 'drift')).toBeNull()
  })

  it('kanon: "Så här blev det" (entrén utfall) → sidorna blinkar i sidfärgerna (Josef 2026-11-28)', () => {
    expect(medSaHarBlevDet('utfall', 'tutorial')).toBe('sidaBlink')
    expect(medSaHarBlevDet('valet', 'tutorial')).toBe('tutorial')
    expect(medSaHarBlevDet('klar', 'skarp')).toBe('skarp')
    expect(medSaHarBlevDet(undefined, null)).toBeNull()
    expect(lageLook('sidaBlink', 'A')).toEqual({ color: FARG.sidaA, effekt: 'blink' })
    expect(lageLook('sidaBlink', 'B')).toEqual({ color: FARG.sidaB, effekt: 'blink' })
    expect(lageLook('sidaBlink', 'falt.1a')).toEqual({ color: FARG.amber, effekt: 'blink' }) // st4 långsidorna
  })
})

describe('station-kit/ljus resultatTid', () => {
  it('minsta visningstid + auto-vidare', async () => {
    vi.useFakeTimers()
    const { useResultatTid } = await import('./resultatTid')
    const onAuto = vi.fn()
    const rt = useResultatTid({ onAuto })
    rt.start()
    expect(rt.kanGaVidare.value).toBe(false)
    vi.advanceTimersByTime(8000)
    expect(rt.kanGaVidare.value).toBe(true)
    vi.advanceTimersByTime(37000)
    expect(onAuto).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

describe('sidfärgerna (spikade 2026-11-19: A varmvitt, B magenta)', () => {
  it('ankomsten (rotation group) färgar sida A varmvitt och sida B magenta; segment utan sida behåller amber chase', () => {
    expect(lageLook('startsida', 'A')).toEqual({ color: SIDFARG.A.led, effekt: 'static' })
    expect(lageLook('startsida', 'B')).toEqual({ color: SIDFARG.B.led, effekt: 'static' })
    expect(lageLook('startsida', 'A.lur').color).toBe(SIDFARG.A.led)
    expect(lageLook('startsida', 'puls').color).toBe(SIDFARG.A.led)
    expect(lageLook('startsida', 'gyro').color).toBe(SIDFARG.B.led)
    expect(lageLook('startsida', 'valdi')).toEqual({ color: FARG.amber, effekt: 'chase' })
    expect(lageLook('startsida', 'falt')).toEqual({ color: FARG.amber, effekt: 'chase' })
    expect(sidaForSegment('Bx')).toBeNull()
  })
  it('skärmfärgerna är varmvitt och magenta', () => {
    expect(SIDFARG.A.skarm).toBe('#fff1d6')
    expect(SIDFARG.B.skarm).toBe('#ff3cc8')
  })
})

describe('farg (egen färg per segment)', () => {
  it('lägger en egen färg ovanpå läget och släpper den med null', async () => {
    const { initLjus, __resetLjusForTest } = await import('./stationLjus')
    __resetLjusForTest()
    const sent: { topic: string; body: string }[] = []
    const client = { publish: (topic: string, body: string) => sent.push({ topic, body }), subscribe() {}, on() {} }
    const l = initLjus({ stationN: 2, enabled: true, mqttUrl: '', valv: 'teknolog', segment: { A: [0, 29], 'A.lur1': [2, 6] } }, client)
    l.lage('skarp')
    l.farg({ color: '#5aa0ff', effekt: 'puls' }, ['A.lur1'])
    let body = JSON.parse(sent.filter((s) => s.topic === 'station2/underglow').at(-1)!.body)
    expect(body.segments.find((s: { id: string }) => s.id === 'A.lur1')).toMatchObject({ color: '#5aa0ff', effekt: 'puls' })
    expect(body.segments.find((s: { id: string }) => s.id === 'A').color).toBe('#ff9500')
    l.farg(null, ['A.lur1'])
    body = JSON.parse(sent.filter((s) => s.topic === 'station2/underglow').at(-1)!.body)
    expect(body.segments.find((s: { id: string }) => s.id === 'A.lur1').color).toBe('#ff9500')
  })
})
