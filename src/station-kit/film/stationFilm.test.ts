import { beforeEach, describe, expect, it } from 'vitest'
import { initFilm, useFilm, filmSrc, regiFranMqtt, __resetFilmForTest, type FilmClient } from './stationFilm'

function fakeClient() {
  const handlers: Record<string, (...a: any[]) => void> = {}
  const subs: string[] = []
  const c: FilmClient = {
    subscribe: (t) => subs.push(t),
    on: (ev: string, cb: any) => {
      handlers[ev] = cb
    },
  }
  return {
    c,
    subs,
    msg: (topic: string, body: object | string) =>
      handlers.message?.(topic, { toString: () => (typeof body === 'string' ? body : JSON.stringify(body)) }),
  }
}

const TRAILER = { film: 'trailer', fas: 'trailer', start_at_ms: 1_700_000_002_500, duration_s: 85.29, skarm: true }

describe('station-kit/film', () => {
  beforeEach(() => __resetFilmForTest())

  it('härleder regi-HTTP ur broker-adressen (ingen IP i koden)', () => {
    expect(regiFranMqtt('ws://192.168.10.10:9001')).toBe('http://192.168.10.10:8090')
    expect(regiFranMqtt('wss://broker.local/mqtt')).toBe('https://broker.local:8090')
    expect(regiFranMqtt('')).toBe('')
  })

  it('bygger skärmpaketets adress med start_at och regi-klockan', () => {
    expect(filmSrc('http://h:8090/', TRAILER)).toBe('http://h:8090/film/trailer/skarm.html?start_at=1700000002500&tid=/time')
    expect(filmSrc('http://h:8090', TRAILER, 'no')).toContain('&sprak=no')
  })

  it('prenumererar på regi/phase + film/start|stop', () => {
    const f = fakeClient()
    initFilm({ enabled: true, mqttUrl: 'ws://h:9001' }, f.c)
    expect(f.subs).toEqual(expect.arrayContaining(['regi/phase', 'film/start', 'film/stop']))
  })

  it('visar trailern bara i trailerfasen och släpper vid nästa fas', () => {
    const f = fakeClient()
    const film = initFilm({ enabled: true, mqttUrl: 'ws://h:9001' }, f.c)
    f.msg('film/start', TRAILER)
    f.msg('regi/phase', { phase: 'incheckning' })
    expect(film.synlig.value).toBe(false)
    f.msg('regi/phase', { phase: 'trailer' })
    expect(film.synlig.value).toBe(true)
    expect(film.src.value).toBe('http://h:8090/film/trailer/skarm.html?start_at=1700000002500&tid=/time')
    f.msg('regi/phase', { phase: 'rotation' })
    expect(film.synlig.value).toBe(false)
    expect(film.src.value).toBe('')
  })

  it('film/stop och rensad retained film/start döljer overlayen', () => {
    const f = fakeClient()
    const film = initFilm({ enabled: true, mqttUrl: 'ws://h:9001' }, f.c)
    f.msg('regi/phase', { phase: 'trailer' })
    f.msg('film/start', TRAILER)
    expect(film.synlig.value).toBe(true)
    f.msg('film/stop', { film: 'reveal' }) // annan film → ingen effekt
    expect(film.synlig.value).toBe(true)
    f.msg('film/stop', { film: 'trailer' })
    expect(film.synlig.value).toBe(false)
    f.msg('film/start', TRAILER)
    expect(film.synlig.value).toBe(true)
    f.msg('film/start', '') // retained rensad
    expect(film.synlig.value).toBe(false)
  })

  it('utan skärmpaket (skarm:false) eller avstängd visas inget', () => {
    const f = fakeClient()
    const film = initFilm({ enabled: true, mqttUrl: 'ws://h:9001' }, f.c)
    f.msg('regi/phase', { phase: 'trailer' })
    f.msg('film/start', { ...TRAILER, skarm: false })
    expect(film.synlig.value).toBe(false)

    __resetFilmForTest()
    const g = fakeClient()
    const av = initFilm({ enabled: false, mqttUrl: 'ws://h:9001' }, g.c)
    expect(g.subs).toEqual([])
    expect(av.synlig.value).toBe(false)
  })

  it('regiUrl överstyr den härledda adressen; trasig signal ignoreras', () => {
    const f = fakeClient()
    const film = initFilm({ enabled: true, mqttUrl: 'ws://h:9001', regiUrl: 'http://regi.test:8091/' }, f.c)
    f.msg('regi/phase', { phase: 'trailer' })
    f.msg('film/start', 'inte json')
    expect(film.synlig.value).toBe(false)
    f.msg('film/start', TRAILER)
    expect(film.src.value.startsWith('http://regi.test:8091/film/trailer/')).toBe(true)
    expect(useFilm().state.signal?.film).toBe('trailer')
  })
})
