import { describe, it, expect } from 'vitest'
import { rubrik, varfor, vinnare, utfallTypFor, ingenVann } from './avslutText'
import type { TeamScore } from './engine/scoring'
import type { TeamId } from './engine/types'

const ts = (team: TeamId, p: Partial<TeamScore>): TeamScore => ({
  team,
  capitalLeft: 0,
  guessedRight: false,
  securedCritical: false,
  teamScore: 0,
  ...p,
})
const s = (a: Partial<TeamScore>, b: Partial<TeamScore>) => ({ lag1: ts('lag1', a), lag2: ts('lag2', b) })

describe('Förhandlingens avslut', () => {
  it('vinnaren heter Sida A / Sida B', () => {
    const r = s({ securedCritical: true, guessedRight: true, capitalLeft: 40, teamScore: 80 }, { securedCritical: false })
    expect(vinnare(r)).toBe('lag1')
    expect(rubrik(r)).toBe('SIDA A VANN!')
    expect(varfor(r)).toBe('Sida A säkrade sin livsviktiga resurs och gissade rätt — poängen dubblades, det gjorde inte Sida B.')
  })
  it('båda säkrade → poängskillnaden', () => {
    const r = s({ securedCritical: true, teamScore: 30 }, { securedCritical: true, teamScore: 55 })
    expect(rubrik(r)).toBe('SIDA B VANN!')
    expect(varfor(r)).toBe('Sida B säkrade sin livsviktiga resurs och hade 25 poäng mer.')
  })
  it('0–0 = INGEN VANN (inte oavgjort-grönt)', () => {
    const r = s({}, {})
    expect(ingenVann(r)).toBe(true)
    expect(rubrik(r)).toBe('INGEN VANN')
    expect(utfallTypFor(r, ['lag1'])).toBe('missat')
  })
  it('lika poäng över 0 = OAVGJORT', () => {
    const r = s({ securedCritical: true, teamScore: 20 }, { securedCritical: true, teamScore: 20 })
    expect(rubrik(r)).toBe('OAVGJORT')
    expect(utfallTypFor(r, ['lag2'])).toBe('oavgjort')
  })
  it('utfallstyp per fönster', () => {
    const r = s({ securedCritical: true, teamScore: 10 }, {})
    expect(utfallTypFor(r, ['lag1'])).toBe('vinst')
    expect(utfallTypFor(r, ['lag2'])).toBe('oavgjort')
  })
  it('nämner aldrig valv, sortering eller roller', () => {
    const r = s({ securedCritical: true, teamScore: 10 }, {})
    expect(rubrik(r) + varfor(r)).not.toMatch(/\bvalv|sortering|\broll/i)
  })
})
