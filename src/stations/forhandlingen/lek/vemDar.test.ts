import { describe, it, expect } from 'vitest'
import { initialVem, reduceVem, peopleOn, VEM_TIMES, type VemPerson } from './vemDar'

const people: VemPerson[] = [
  { band_id: 'a1', name: 'Liam', side: 'A' },
  { band_id: 'a2', name: 'Jonna', side: 'A' },
  { band_id: 'b1', name: 'Omar', side: 'B' },
]

describe('Vem där?', () => {
  it('rätt gissning ger gissarna poäng, sedan byts sidan', () => {
    let s = initialVem(0)
    s = reduceVem(s, { type: 'pick', band_id: 'a2', name: 'Jonna' }, 1)
    expect(s.phase).toBe('speak')
    s = reduceVem(s, { type: 'guess', band_id: 'a2' }, 2)
    expect(s.correct).toBe(true)
    expect(s.score).toEqual({ A: 0, B: 1 })
    s = reduceVem(s, { type: 'tick' }, 2 + VEM_TIMES.revealMs)
    expect(s.phase).toBe('pick')
    expect(s.speakerSide).toBe('B')
  })
  it('fel gissning eller timeout ger talarsidan poäng', () => {
    let s = reduceVem(initialVem(0), { type: 'pick', band_id: 'a1', name: 'Liam' }, 0)
    s = reduceVem(s, { type: 'guess', band_id: 'a2' }, 1)
    expect(s.score.A).toBe(1)
    let t = reduceVem(initialVem(0), { type: 'pick', band_id: 'a1', name: 'Liam' }, 0)
    t = reduceVem(t, { type: 'tick' }, VEM_TIMES.speakMs)
    expect(t.phase).toBe('reveal')
    expect(t.score.A).toBe(1)
  })
  it('gissning utanför talfasen ignoreras', () => {
    const s = reduceVem(initialVem(0), { type: 'guess', band_id: 'a1' }, 1)
    expect(s.phase).toBe('pick')
  })
  it('bara talarsidans personer går att gissa på; ingen känd sida alls → alla', () => {
    expect(peopleOn([...people, { band_id: 'x', name: 'X', side: null }], 'B').map((p) => p.band_id)).toEqual(['b1'])
    expect(peopleOn(people, 'A').map((p) => p.band_id)).toEqual(['a1', 'a2'])
    const okanda = people.map((p) => ({ ...p, side: null }))
    expect(peopleOn(okanda, 'B')).toHaveLength(3)
  })
})
