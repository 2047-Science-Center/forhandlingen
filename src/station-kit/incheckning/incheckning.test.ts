import { beforeEach, describe, expect, it } from 'vitest'
import { __resetIncheckningForTest, initIncheckning, type IncheckningClient } from './incheckning'

function fake() {
  let onMsg: (t: string, p: { toString(): string }) => void = () => {}
  let onConnect: () => void = () => {}
  const published: { topic: string; payload: string; retain?: boolean }[] = []
  const subs: string[] = []
  const client: IncheckningClient = {
    publish: (topic, payload, o) => published.push({ topic, payload, retain: o?.retain }),
    subscribe: (t) => subs.push(t),
    on: ((ev: string, cb: (...a: never[]) => void) => {
      if (ev === 'message') onMsg = cb as unknown as typeof onMsg
      if (ev === 'connect') onConnect = cb as unknown as typeof onConnect
    }) as IncheckningClient['on'],
  }
  const send = (t: string, p: unknown) => onMsg(t, { toString: () => (typeof p === 'string' ? p : JSON.stringify(p)) })
  return { client, published, subs, send, connect: () => onConnect() }
}

const GROUP = {
  session_id: 21826,
  round: 1,
  group: 2,
  members: [
    { band_id: 'V2A1', name: 'Alma', halva: 'A' },
    { band_id: 'V2A2', name: null, halva: 'A' },
    { band_id: 'V2B1', name: 'Fredrik', halva: 'B' },
    { band_id: '04AABBCC', name: 'Ebba', halva: 'B' },
  ],
}

describe('incheckningen vid stationen (station<N>/incheckad)', () => {
  beforeEach(() => __resetIncheckningForTest())

  it('syns bara i regis fas incheckning; gruppen per sida ur station<N>/group', () => {
    const f = fake()
    const i = initIncheckning({ stationN: 3, enabled: true, mqttUrl: '' }, f.client)
    f.connect()
    expect(f.subs).toEqual(['regi/phase', 'station3/group', '+/incheckad'])
    f.send('station3/group', GROUP)
    expect(i.visible.value).toBe(false)
    f.send('regi/phase', { session_id: 21826, phase: 'incheckning' })
    expect(i.visible.value).toBe(true)
    expect(i.namnPaSida('A').map((m) => m.name)).toEqual(['Alma', '2A2'])
    expect(i.namnPaSida('B').map((m) => m.name)).toEqual(['Fredrik', 'Ebba'])
    f.send('regi/phase', { session_id: 21826, phase: 'trailer' })
    expect(i.visible.value).toBe(false)
  })

  it('knappen kvitterar retained med session och grupp; andra stationer räknas, gamla körningar inte', () => {
    const f = fake()
    const i = initIncheckning({ stationN: 2, enabled: true, mqttUrl: '', side: 'B' }, f.client)
    f.connect()
    f.send('regi/phase', { session_id: 21826, phase: 'incheckning' })
    f.send('station2/group', { ...GROUP, group: 4 })
    f.send('station1/incheckad', { session_id: 99, group: 1 })     // gammal retained
    f.send('station4/incheckad', { session_id: 21826, group: 2 })
    expect(i.klaraStationer.value).toEqual([4])
    expect(i.kvitterad.value).toBe(false)
    i.kvittera()
    expect(f.published).toEqual([
      { topic: 'station2/incheckad', payload: JSON.stringify({ session_id: 21826, group: 4, side: 'B' }), retain: true },
    ])
    expect(i.kvitterad.value).toBe(true)
    expect(i.klaraStationer.value).toEqual([2, 4])
    i.kvittera()
    expect(f.published).toHaveLength(1)
    f.send('station4/incheckad', '')       // regi rensar
    expect(i.klaraStationer.value).toEqual([2])
  })

  it('delad station: den andra sidans kvittens räcker för den här skärmen', () => {
    const f = fake()
    const i = initIncheckning({ stationN: 2, enabled: true, mqttUrl: '', side: 'A' }, f.client)
    f.connect()
    f.send('regi/phase', { session_id: 7, phase: 'incheckning' })
    f.send('station2/incheckad', { session_id: 7, group: 4, side: 'B' })
    expect(i.kvitterad.value).toBe(true)
    expect(i.kanKvittera.value).toBe(false)
  })

  it('med band: bippen bockar av namnen; kravBipp låser knappen tills alla bippat', () => {
    const f = fake()
    const i = initIncheckning({ stationN: 3, enabled: true, mqttUrl: '', bandlost: false, kravBipp: true }, f.client)
    f.connect()
    expect(f.subs).toContain('station3/rfid')
    f.send('regi/phase', { session_id: 21826, phase: 'incheckning' })
    f.send('station3/group', GROUP)
    expect(i.kanKvittera.value).toBe(false)
    for (const uid of ['V2A1', 'V2A2', 'V2B1', '04aabbcc']) f.send('station3/rfid', uid)
    expect(i.allaBippat.value).toBe(true)
    expect(i.kanKvittera.value).toBe(true)
  })

  it('av (enabled=false) → visas aldrig, ingen prenumeration', () => {
    const f = fake()
    const i = initIncheckning({ stationN: 3, enabled: false, mqttUrl: '' }, f.client)
    f.connect()
    expect(f.subs).toEqual([])
    expect(i.visible.value).toBe(false)
  })
})
