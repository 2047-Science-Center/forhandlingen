import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initLjus, useLjus, __resetLjusForTest, type LjusClient } from './stationLjus'
import { lageFranRotation, regiLook, FARG, VALVFARG } from './kanon'

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

  it('delad station: bara egna segment, ersatt:false, ompublicering', () => {
    const f = fakeClient()
    initLjus(
      { stationN: 2, enabled: true, mqttUrl: '', valv: 'teknolog', segment: { ...SEG, valdi: [60, 75] }, egna: ['B', 'valdi'], delad: true },
      f.c,
    )
    f.connect()
    const n = f.sent.length
    const first = f.sent.at(-1)!
    expect(first.payload.ersatt).toBe(false)
    expect(first.payload.segments.map((s: any) => s.id)).toEqual(['B', 'valdi'])
    vi.advanceTimersByTime(15000)
    expect(f.sent.length).toBe(n + 1)
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
    expect(lageFranRotation('group', null)).toBe('ankomst')
    expect(lageFranRotation('running', 'tutorial')).toBe('tutorial')
    expect(lageFranRotation('running', 'skarp')).toBe('skarp')
    expect(lageFranRotation('lek', 'lek')).toBe('lek')
    expect(lageFranRotation('waiting', null)).toBeNull()
    expect(regiLook('idle', 'drift')).toEqual({ color: VALVFARG.drift, effekt: 'puls' })
    expect(regiLook('rotation', 'drift')).toBeNull()
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
