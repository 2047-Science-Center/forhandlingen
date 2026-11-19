import { describe, expect, it } from 'vitest'
import { arVirtuellt, bandlostFran, flagga, normaliseraMedlemmar, platsKod, virtuelltBand, visningsnamn } from './band'

describe('strömbrytaren (bandlostFran)', () => {
  it('URL går före bygget, bygget före default', () => {
    expect(bandlostFran(true, '0', '?bandlost=1')).toBe(true)
    expect(bandlostFran(true, '1', '?bandlost=0')).toBe(false)
    expect(bandlostFran(true, '0', '')).toBe(false)
    expect(bandlostFran(false, '1', '?x=1')).toBe(true)
    expect(bandlostFran(true, undefined, '')).toBe(true)
    expect(bandlostFran(false, '', '?bandlost=kanske')).toBe(false)
  })
  it('flagga tolkar 1/0/true/false/ja/nej', () => {
    expect([flagga('1'), flagga('true'), flagga('JA'), flagga('0'), flagga('nej'), flagga(''), flagga(null)]).toEqual([
      true,
      true,
      true,
      false,
      false,
      null,
      null,
    ])
  })
})

describe('virtuella band', () => {
  it('V + plats-kod, aldrig ett hex-UID', () => {
    expect(virtuelltBand('2a1')).toBe('V2A1')
    expect(arVirtuellt('V2A1')).toBe(true)
    expect(arVirtuellt('04A2B3C4')).toBe(false)
    expect(arVirtuellt('V')).toBe(false)
    expect(arVirtuellt(null)).toBe(false)
    expect(platsKod('v4b3')).toBe('4B3')
    expect(platsKod('04A2B3C4')).toBeNull()
  })
  it('visningsnamn: namn > plats-kod > band-svans', () => {
    expect(visningsnamn({ band_id: 'V2A1', name: 'Alma' })).toBe('Alma')
    expect(visningsnamn({ band_id: 'V2A1', name: null })).toBe('2A1')
    expect(visningsnamn({ band_id: 'V2A1', name: '  ' })).toBe('2A1')
    expect(visningsnamn({ band_id: '04A2B3C4D5' })).toBe('Band …C4D5')
  })
})

describe('normaliseraMedlemmar', () => {
  it('halva blir startsida, namn fylls i, tomma band tas bort', () => {
    const ut = normaliseraMedlemmar([
      { band_id: 'V1A1', name: null, gender: 'kvinna', halva: 'A' },
      { band_id: 'V1B1', name: 'Fredrik', gender: 'man', halva: 'B' },
      { band_id: '04AA', name: 'Ebba', halva: null },
      { band_id: '', name: 'Spöke' },
    ])
    expect(ut.map((m) => [m.band_id, m.name, m.startsida])).toEqual([
      ['V1A1', '1A1', 'A'],
      ['V1B1', 'Fredrik', 'B'],
      ['04AA', 'Ebba', null],
    ])
    expect(ut[0].gender).toBe('kvinna')
  })
  it('startsida går före halva; skräp ignoreras', () => {
    const [m] = normaliseraMedlemmar([{ band_id: 'V1A1', name: 'A', startsida: 'B', halva: 'A' }])
    expect(m.startsida).toBe('B')
    expect(normaliseraMedlemmar([{ band_id: 'X', halva: 'C' }])[0].startsida).toBeNull()
    expect(normaliseraMedlemmar(null)).toEqual([])
  })
})
