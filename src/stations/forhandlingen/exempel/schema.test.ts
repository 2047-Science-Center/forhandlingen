import { describe, it, expect } from 'vitest'
import { byggSchema, lageVid } from './schema'

const s = byggSchema()

describe('exempelförhandlingens schema', () => {
  it('har alla repliker i tidsordning utan överlapp', () => {
    expect(s.repliker.length).toBe(18)
    for (let i = 1; i < s.repliker.length; i++) expect(s.repliker[i].t).toBeGreaterThanOrEqual(s.repliker[i - 1].slut)
  })

  it('är ungefär en minut lång', () => {
    expect(s.langd).toBeGreaterThan(45)
    expect(s.langd).toBeLessThan(75)
  })

  it('pengarna följer klubbslagen: B 15 + 60, A 10', () => {
    const efter = lageVid(s, s.utfall)
    expect(efter.pengar).toEqual({ A: 90, B: 25 })
    expect(efter.klubbat.map((k) => `${k.vinnare}${k.pris}`)).toEqual(['B15', 'B60', 'A10'])
  })

  it('luckan är öppen under budgivningen och stängs vid klubbslaget', () => {
    const l2 = s.luckor[1]
    expect(lageVid(s, l2.oppnas + 1).oppen).toBe(true)
    expect(lageVid(s, l2.oppnas + 1).lucka).toBe(1)
    const k2 = s.klubbslag[1]
    expect(lageVid(s, k2.t + 0.1).oppen).toBe(false)
    expect(lageVid(s, k2.t + 0.1).stampel?.pris).toBe(60)
  })

  it('viskningen i bluffen är rapportörens och visar bluffbilden', () => {
    const x6 = s.repliker.find((r) => r.id === 'x6')!
    const l = lageVid(s, x6.t + 0.2)
    expect(l.replik?.vem).toBe('rapportorA')
    expect(l.replik?.viskar).toBe(true)
    expect(l.bild).toBe('s3-bluff')
  })

  it('gissningen kommer efter sista klubbslaget och slutet efter utfallet', () => {
    expect(s.gissning).toBeGreaterThan(s.klubbslag[2].t)
    expect(lageVid(s, s.utfall + 0.5).utfall).toBe(true)
    expect(lageVid(s, s.langd + 0.1).klar).toBe(true)
  })
})
