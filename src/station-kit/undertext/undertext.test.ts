import { describe, it, expect } from 'vitest'
import { radVid, textPa, type UndertextRad } from './undertext'

const R: UndertextRad[] = [
  { t: 0.4, slut: 4, sv: 'ett', no: 'en' },
  { t: 4.5, sv: 'två' }, // inget slut → till nästa t
  { t: 8, slut: 9, sv: 'tre', no: '' },
]

describe('undertext', () => {
  it('ingen rad före första och i pauser', () => {
    expect(radVid(R, 0)).toBeNull()
    expect(radVid(R, 4.2)).toBeNull()
    expect(radVid(R, 9.5)).toBeNull()
  })
  it('rätt rad inom start–slut, och till nästa t när slut saknas', () => {
    expect(radVid(R, 0.4)?.sv).toBe('ett')
    expect(radVid(R, 3.99)?.sv).toBe('ett')
    expect(radVid(R, 7.9)?.sv).toBe('två')
    expect(radVid(R, 8)?.sv).toBe('tre')
  })
  it('norska med svensk reserv', () => {
    expect(textPa(R[0], 'no')).toBe('en')
    expect(textPa(R[1], 'no')).toBe('två')
    expect(textPa(R[2], 'no')).toBe('tre')
    expect(textPa(null, 'sv')).toBe('')
  })
})
