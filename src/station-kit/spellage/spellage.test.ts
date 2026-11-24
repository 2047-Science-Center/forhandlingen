import { describe, it, expect } from 'vitest'
import { forraStation, kortFil } from './spellage'

const ORDNING = [1, 4, 3, 2]

describe('spellägeskortet', () => {
  it('runda 0 och 1 = första stationen', () => {
    expect(forraStation(1, 0, ORDNING)).toBeNull()
    expect(forraStation(1, 1, ORDNING)).toBeNull()
    expect(kortFil(1, 1, ORDNING)).toBe('forsta-st1.mp4')
  })
  it('runda ≥ 2 = stationen före i ordningen (medsols, st1 ← st2)', () => {
    expect(forraStation(1, 2, ORDNING)).toBe(2)
    expect(forraStation(4, 3, ORDNING)).toBe(1)
    expect(forraStation(3, 2, ORDNING)).toBe(4)
    expect(kortFil(1, 4, ORDNING)).toBe('st2-st1.mp4')
  })
  it('okänd station → första', () => {
    expect(forraStation(9, 2, ORDNING)).toBeNull()
  })
})
