import { describe, it, expect } from 'vitest'
import { onHoppa, hoppa } from './kioskSkip'

describe('kioskSkip', () => {
  it('senast registrerade provas först; false släpper vidare; avregistrering tar bort', () => {
    const logg: string[] = []
    const av1 = onHoppa(() => void logg.push('undre'))
    const av2 = onHoppa(() => {
      logg.push('övre (inte mitt läge)')
      return false
    })
    expect(hoppa()).toBe(true)
    expect(logg).toEqual(['övre (inte mitt läge)', 'undre'])
    av2()
    av1()
    expect(hoppa()).toBe(false)
  })
})
