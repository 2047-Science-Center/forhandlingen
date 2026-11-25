import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initRotation, tagResult, __resetRotationForTest } from './rotation'
import type { RotationClient } from './types'

/** Fejk-broker: fångar publiceringar och låter testet leverera meddelanden. */
function fakeClient() {
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {}
  const published: { topic: string; payload: unknown; retain?: boolean }[] = []
  const client: RotationClient = {
    publish: (topic, payload, opts) => {
      published.push({ topic, payload: JSON.parse(payload), retain: opts?.retain })
    },
    subscribe: () => undefined,
    on: (ev: string, cb: (...a: never[]) => void) => {
      ;(handlers[ev] ??= []).push(cb as (...a: unknown[]) => void)
    },
  }
  const deliver = (topic: string, payload: object) =>
    handlers.message?.forEach((cb) => cb(topic, { toString: () => JSON.stringify(payload) }))
  return { client, published, deliver }
}

const N = 2 // Människa eller maskin: sista position (index 3) i [1, 4, 3, 2]
const group = (round: number, g: number | null, sid: string | null = 's1') => ({
  session_id: sid,
  round,
  group: g,
  members: g ? [{ band_id: `b${g}`, name: `Namn${g}` }] : [],
})

describe('rotation (stationssidan)', () => {
  beforeEach(() => {
    __resetRotationForTest()
    try {
      localStorage.clear()
    } catch {
      /* ingen localStorage i testmiljön */
    }
  })

  it('är av när enabled=false och tagResult rör inte payloaden', () => {
    const r = initRotation({ stationN: N, enabled: false, mqttUrl: '' })
    expect(r.state.phase).toBe('off')
    expect(r.finishSkarp()).toBe(false)
    expect(tagResult({ grupp: 'x' })).toEqual({ grupp: 'x' })
  })

  it('4 rundor: grupp → touch → skarp → done → lek → nästa grupp', () => {
    const f = fakeClient()
    const r = initRotation({ stationN: N, enabled: true, mqttUrl: '' }, f.client)
    expect(r.state.phase).toBe('waiting')
    const facit = [4, 3, 2, 1] // XY-ROTATION.md, kolumn Människa eller maskin (st2)
    facit.forEach((g, i) => {
      const round = i + 1
      f.deliver(`station${N}/group`, group(round, g))
      expect(r.state.phase).toBe('group')
      expect(r.state.group).toBe(g)
      r.begin()
      expect(r.state.phase).toBe('running')
      r.markSkarp()
      expect(tagResult({ grupp: 'x' })).toEqual({ grupp: 'x', round, group: g })
      expect(r.finishSkarp()).toBe(true)
      expect(r.state.phase).toBe('lek')
      const done = f.published.filter((p) => p.topic === `station${N}/done`).at(-1)
      expect(done?.payload).toEqual({ session_id: 's1', round, group: g })
    })
    const modes = f.published.filter((p) => p.topic === `station${N}/mode`)
    expect(modes.map((m) => (m.payload as { mode: string }).mode)).toEqual(
      Array(4).fill(['tutorial', 'skarp', 'lek']).flat(),
    )
    expect(modes.every((m) => m.retain)).toBe(true)
  })

  it('retained samma grupp igen ändrar inte läget; round 0 → waiting', () => {
    const f = fakeClient()
    const r = initRotation({ stationN: N, enabled: true, mqttUrl: '' }, f.client)
    f.deliver(`station${N}/group`, group(1, 3))
    r.begin()
    f.deliver(`station${N}/group`, group(1, 3))
    expect(r.state.phase).toBe('running')
    r.finishSkarp()
    f.deliver(`station${N}/group`, group(0, null, null))
    expect(r.state.phase).toBe('waiting')
  })

  it('done från stationens andra skärm → lek utan egen publicering', () => {
    const f = fakeClient()
    const r = initRotation({ stationN: N, enabled: true, mqttUrl: '' }, f.client)
    f.deliver(`station${N}/group`, group(2, 2))
    r.begin()
    const before = f.published.length
    f.deliver(`station${N}/done`, { session_id: 's1', round: 2, group: 2 })
    expect(r.state.phase).toBe('lek')
    expect(f.published.length).toBe(before)
  })

  it('delad station (side): egen done med side, lek per sida, andra sidans done ignoreras', () => {
    const f = fakeClient()
    const r = initRotation({ stationN: N, enabled: true, mqttUrl: '', side: 'B' }, f.client)
    f.deliver(`station${N}/group`, group(1, 3))
    r.begin()
    r.markSkarp()
    // Sida A blir klar först → sida B spelar vidare (orange), går INTE till lek.
    f.deliver(`station${N}/done`, { session_id: 's1', round: 1, group: 3, side: 'A' })
    expect(r.state.phase).toBe('running')
    // Sida B klar → eget done med side → lek.
    expect(r.finishSkarp()).toBe(true)
    expect(r.state.phase).toBe('lek')
    const done = f.published.filter((p) => p.topic === `station${N}/done`).at(-1)
    expect(done?.payload).toEqual({ session_id: 's1', round: 1, group: 3, side: 'B' })
    const mode = f.published.filter((p) => p.topic === `station${N}/mode`).at(-1)
    expect(mode?.payload).toEqual({ mode: 'lek', side: 'B' })
  })

  it('delad station: done UTAN side (hela stationen) tar också sidan till lek', () => {
    const f = fakeClient()
    const r = initRotation({ stationN: N, enabled: true, mqttUrl: '', side: 'A' }, f.client)
    f.deliver(`station${N}/group`, group(1, 3))
    r.begin()
    f.deliver(`station${N}/done`, { session_id: 's1', round: 1, group: 3 })
    expect(r.state.phase).toBe('lek')
  })

  it('manuellt val räknar ut rundan ur stationsordningen', () => {
    vi.useFakeTimers()
    const r = initRotation({ stationN: N, enabled: true, mqttUrl: '' })
    expect(r.state.showManual).toBe(true) // ingen broker → manuellt direkt
    r.pickManual(1)
    expect(r.state.phase).toBe('group')
    expect(r.state.round).toBe(4) // G1 står på st2 i runda 4
    vi.useRealTimers()
  })
})
