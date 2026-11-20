import { describe, expect, it } from 'vitest'
import { ROLLVAL, ROLLVAL_OVERLAY_SETS, ROLLVAL_PORTRATT_SETS } from '@/config'

/**
 * Säkrar att textlagret (overlay.json) och rollvalsporträtten (portratt.jpg) bredvid varje
 * textfritt klipp hittas av Vite-globben (XY-TEXTLAGER). Idas/Ossians klipp saknar undertext
 * i originalet (ren bildvlogg) → undertext får vara tom, men overlay-objektet + titeln ska finnas.
 */
describe('Förhandlingen: textlager + porträtt per klippset', () => {
  it('overlay.json + porträtt finns för varje klipp i varje set', () => {
    expect(ROLLVAL_OVERLAY_SETS).toHaveLength(ROLLVAL.clipSets.length)
    expect(ROLLVAL_PORTRATT_SETS).toHaveLength(ROLLVAL.clipSets.length)
    for (let i = 0; i < ROLLVAL.clipSets.length; i++) {
      for (const roll of ['sandebud', 'rapportor'] as const) {
        expect(Array.isArray(ROLLVAL_OVERLAY_SETS[i][roll]?.undertext)).toBe(true)
        expect(ROLLVAL_OVERLAY_SETS[i][roll]?.titel).toBeDefined()
        expect(ROLLVAL_PORTRATT_SETS[i][roll]).toBeTruthy()
      }
    }
  })
})
