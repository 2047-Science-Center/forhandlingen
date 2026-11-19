import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { taktPlan, minst, useAvslut, AVSLUT_TIDER } from './avslut'
import { initResultat, skickaResultat, resultatPayload, __resetResultatForTest } from './resultatSink'
import type { ResultPayload } from '@/station-kit/adapters/result/ResultSink'

const payload = (extra: Partial<ResultPayload> = {}): ResultPayload => ({
  grupp: 'pilot',
  rollresultat_A: 1,
  rollresultat_B: 2,
  personer: [{ band_id: 'b1', chosen_role: 'A', assigned_role: 'A', role_presented_as: 'kvinnlig', result_value: 3 }],
  ...extra,
})

describe('taktPlan', () => {
  it('lägger takterna i ordning med standardtiderna', () => {
    const p = taktPlan(AVSLUT_TIDER)
    expect(p.map((x) => x.takt)).toEqual(['uppbyggnad', 'spanning', 'avslojande', 'utfall'])
    expect(p[1].vid).toBe(AVSLUT_TIDER.uppbyggnadMs)
    expect(p[2].vid).toBe(AVSLUT_TIDER.uppbyggnadMs + AVSLUT_TIDER.spanningMs)
    // Hela vägen till utfallet ryms under 8 s (spänning, inte väntan).
    expect(p[3].vid).toBeLessThanOrEqual(8000)
  })

  it('minst() jämför takter', () => {
    expect(minst('utfall', 'avslojande')).toBe(true)
    expect(minst('spanning', 'avslojande')).toBe(false)
    expect(minst('av', 'uppbyggnad')).toBe(false)
  })
})

describe('useAvslut', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('går igenom takterna av sig självt och auto-avslutar', () => {
    const onAuto = vi.fn()
    const onAvslojande = vi.fn()
    const a = useAvslut({ ljud: false, onAuto, onAvslojande })
    a.start()
    expect(a.takt.value).toBe('uppbyggnad')
    vi.advanceTimersByTime(AVSLUT_TIDER.uppbyggnadMs)
    expect(a.takt.value).toBe('spanning')
    vi.advanceTimersByTime(AVSLUT_TIDER.spanningMs)
    expect(a.takt.value).toBe('avslojande')
    expect(onAvslojande).toHaveBeenCalledOnce()
    expect(a.kanGaVidare.value).toBe(false)
    vi.advanceTimersByTime(AVSLUT_TIDER.avslojandeMs)
    expect(a.takt.value).toBe('utfall')
    vi.advanceTimersByTime(AVSLUT_TIDER.minMs - AVSLUT_TIDER.avslojandeMs)
    expect(a.kanGaVidare.value).toBe(true)
    expect(onAuto).not.toHaveBeenCalled()
    vi.advanceTimersByTime(AVSLUT_TIDER.autoMs)
    expect(onAuto).toHaveBeenCalledOnce()
  })

  it('aterstall() stoppar sekvensen', () => {
    const onAuto = vi.fn()
    const a = useAvslut({ ljud: false, onAuto })
    a.start()
    a.aterstall()
    vi.advanceTimersByTime(120_000)
    expect(a.takt.value).toBe('av')
    expect(onAuto).not.toHaveBeenCalled()
  })
})

describe('skickaResultat', () => {
  beforeEach(() => __resetResultatForTest())

  it('bara ledaren publicerar, en gång, utan done', () => {
    const pub = vi.fn()
    initResultat({ stationN: 3, enabled: true, mqttUrl: 'ws://test' }, { publish: pub })
    expect(skickaResultat(payload({ round: 2, group: 4 }), { ledare: false })).toBe(false)
    expect(pub).not.toHaveBeenCalled()
    expect(skickaResultat(payload({ round: 2, group: 4 }), { ledare: true })).toBe(true)
    expect(pub).toHaveBeenCalledOnce()
    const [topic, body, o] = pub.mock.calls[0]
    expect(topic).toBe('station3/result')
    expect(JSON.parse(body)).toMatchObject({ grupp: '4', round: 2, group: 4 })
    expect(o).toEqual({ qos: 1, retain: false })
  })

  it('av → appens reserv-sink (pilotens konsol)', () => {
    const reserv = { send: vi.fn() }
    initResultat({ stationN: 1, enabled: false, mqttUrl: 'ws://test' })
    expect(skickaResultat(payload(), { ledare: true, reserv })).toBe(false)
    expect(reserv.send).toHaveBeenCalledOnce()
  })

  it('grupp följer rotationens testgrupp, annars appens värde', () => {
    expect(resultatPayload(payload({ group: 2 })).grupp).toBe('2')
    expect(resultatPayload(payload()).grupp).toBe('pilot')
  })
})
