import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initLjus, __resetLjusForTest, type LjusClient } from '@/station-kit/ljus/stationLjus'
import { FARG } from '@/station-kit/ljus/kanon'
import { LJUS } from '@/config'
import {
  appLage,
  arSkrivare,
  egnaSidor,
  resultatLjud,
  timerVarning,
  utfallForResultat,
  LJUD_TILL_SFX,
  SIDA_FOR_LAG,
} from './ljus'

describe('Förhandlingen: ljus-mappning (§5.1)', () => {
  it('sida A = lag1 (vänster), sida B = lag2 (höger); ledarfönstret är skrivare', () => {
    expect(SIDA_FOR_LAG).toEqual({ lag1: 'A', lag2: 'B' })
    expect(arSkrivare('lag1')).toBe(true)
    expect(arSkrivare('shared')).toBe(true)
    expect(arSkrivare('lag2')).toBe(false)
    expect(egnaSidor('lag2')).toEqual(['B'])
    expect(egnaSidor('shared')).toEqual(['A', 'B'])
  })

  it('resultat: vinnarsidan vinst (grön), den andra forlust (röd); oavgjort båda', () => {
    expect(utfallForResultat('lag2')).toEqual([
      { utfall: 'vinst', ids: ['B'] },
      { utfall: 'forlust', ids: ['A'] },
    ])
    expect(utfallForResultat('draw')).toEqual([{ utfall: 'oavgjort', ids: ['A', 'B'] }])
    expect(resultatLjud('lag1', 'lag1')).toBe('vinst')
    expect(resultatLjud('lag1', 'lag2')).toBe('neutral')
    expect(resultatLjud('lag2', 'shared')).toBe('vinst')
    expect(resultatLjud('draw', 'lag1')).toBe('neutral')
  })

  it('timern: varning 2 bara sista 5 s av en pågående förhandling', () => {
    expect(timerVarning('negotiating', 6)).toBe(0)
    expect(timerVarning('negotiating', 5)).toBe(2)
    expect(timerVarning('negotiating', 1)).toBe(2)
    expect(timerVarning('negotiating', 0)).toBe(0)
    expect(timerVarning('getready', 3)).toBe(0)
    expect(timerVarning('negotiating', null)).toBe(0)
  })

  it('läget: rotationen styr när den är på; annars appens faser', () => {
    expect(appLage({ rotationPa: true, franRotation: 'ankomst', entered: true, onboarded: true })).toBe('ankomst')
    expect(appLage({ rotationPa: false, franRotation: null, entered: false, onboarded: false })).toBeNull()
    expect(appLage({ rotationPa: false, franRotation: null, entered: true, onboarded: false })).toBe('tutorial')
    expect(appLage({ rotationPa: false, franRotation: null, entered: true, onboarded: true })).toBe('skarp')
  })

  it('entrén: ställ er på rätt sida = sidfärgerna, rollklipp och val = mint (Josef 2026-11-26)', () => {
    const i = (entreSteg: string) => appLage({ rotationPa: true, franRotation: 'tutorial', entered: true, onboarded: false, entreSteg })
    expect(i('attract')).toBe('startsida')
    expect(i('redo')).toBe('startsida')
    expect(i('sekvens')).toBe('tutorial')
    expect(i('rollval')).toBe('tutorial')
    expect(i('valet')).toBe('tutorial')
    expect(i('utfall')).toBe('startsida')
    expect(i('klar')).toBe('tutorial')
    // Skarpt påverkas aldrig av entrén.
    expect(appLage({ rotationPa: true, franRotation: 'skarp', entered: true, onboarded: true, entreSteg: 'utfall' })).toBe('skarp')
  })

  it('alla kanon-ljud har ett Sfx i appen', () => {
    for (const sfx of Object.values(LJUD_TILL_SFX)) expect(typeof sfx).toBe('string')
    expect(LJUD_TILL_SFX.oppnar).toBe('hatch')
    expect(LJUD_TILL_SFX.vinst).toBe('win')
  })
})

describe('Förhandlingen: utfall på underglow', () => {
  beforeEach(() => {
    __resetLjusForTest()
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => vi.useRealTimers())

  it('lag2 vinner i skarpt: B grön (vinst-gest + bas), A dämpad orange', () => {
    const sent: { topic: string; payload: any; retain: boolean }[] = []
    let onConnect = () => {}
    const c: LjusClient = {
      publish: (topic, payload, o) => sent.push({ topic, payload: JSON.parse(payload), retain: !!o?.retain }),
      subscribe: () => {},
      on: (ev: string, cb: any) => {
        if (ev === 'connect') onConnect = cb
      },
    }
    const l = initLjus({ stationN: 1, enabled: true, mqttUrl: '', valv: LJUS.valv, segment: LJUS.segment }, c)
    onConnect()
    l.lage('skarp')
    for (const u of utfallForResultat('lag2')) l.utfall(u.utfall, u.ids, { tyst: true })

    const fb = sent.filter((m) => m.topic === 'station1/feedback')
    expect(fb.map((m) => [m.payload.gest, m.payload.segments.map((s: any) => s.id)])).toEqual([
      ['vinst', ['B']],
      ['forlust', ['A']],
    ])

    const bas = sent.filter((m) => m.topic === 'station1/underglow').at(-1)!
    expect(bas.retain).toBe(true)
    const byId = Object.fromEntries(bas.payload.segments.map((s: any) => [s.id, s]))
    expect(byId.B).toMatchObject({ from: 70, to: 140, color: FARG.gron, effekt: 'static' })
    expect(byId.A).toMatchObject({ from: 0, to: 69, color: FARG.rodDjup, effekt: 'static' })
  })
})
