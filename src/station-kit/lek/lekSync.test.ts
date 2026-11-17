import { describe, it, expect } from 'vitest'
import { createLekSync, pickIndex, type LekTransport, type LekAction } from './lekSync'

/** Två skärmar på samma "kanal" (synkron fake-transport). */
function pair(): [LekTransport, LekTransport] {
  const hs: Array<Array<(m: { kind: string; payload: unknown }) => void>> = [[], []]
  const mk = (me: number): LekTransport => ({
    send: (m) => hs[1 - me].forEach((h) => h(JSON.parse(JSON.stringify(m)))),
    subscribe: (h) => {
      hs[me].push(h)
      return () => {
        hs[me] = hs[me].filter((x) => x !== h)
      }
    },
  })
  return [mk(0), mk(1)]
}

const reduce = (s: { n: number }, a: LekAction) => (a.type === 'inc' ? { n: s.n + 1 } : s)

describe('lekSync', () => {
  it('följaren skickar till ledaren och får tillbaka state', () => {
    const [ta, tb] = pair()
    const lead = createLekSync({ channel: 't', initial: { n: 0 }, reduce, leader: true, transport: ta })
    const fol = createLekSync({ channel: 't', initial: { n: 0 }, reduce, leader: false, transport: tb })
    fol.act({ type: 'inc' })
    lead.act({ type: 'inc' })
    expect(lead.state.n).toBe(2)
    expect(fol.state.n).toBe(2)
  })
  it('utan transport körs allt lokalt', () => {
    const s = createLekSync({ channel: 't', initial: { n: 0 }, reduce, leader: false })
    s.act({ type: 'inc' })
    expect(s.state.n).toBe(1)
  })
  it('pickIndex undviker föregående', () => {
    for (let i = 0; i < 50; i++) expect(pickIndex(5, 2)).not.toBe(2)
    expect(pickIndex(1, 0)).toBe(0)
  })
})
