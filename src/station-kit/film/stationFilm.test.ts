import { beforeEach, describe, expect, it } from 'vitest'
import { initFilm, useFilm, filmSrc, regiFranMqtt, revealSrc, syvSrc, valdiFoljer, __resetFilmForTest, type FilmClient } from './stationFilm'

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

  describe('appar på broker-NUC:en (SOM.md "Appar i riggen")', () => {
    const OPTS = { enabled: true, mqttUrl: 'ws://h:9001', stationN: 4 }

    it('reveal: gruppen vid stationen (station<N>/group), follower som default', () => {
      const f = fakeClient()
      const film = initFilm(OPTS, f.c)
      expect(f.subs).toContain('station4/group')
      f.msg('station4/group', { round: 4, group: 3, members: [] })
      f.msg('station3/group', { round: 4, group: 1 }) // annan station → ignoreras
      f.msg('regi/phase', { phase: 'rotation', session_id: 12 })
      expect(film.synlig.value).toBe(false)
      f.msg('regi/phase', { phase: 'reveal', session_id: 12 })
      expect(film.lage.value).toBe('reveal')
      expect(film.src.value).toBe('http://h:5188/?group=3&session=12&follower')
      f.msg('regi/phase', { phase: 'sortering', session_id: 12 })
      expect(film.lage.value).toBe('sortering')
      expect(film.src.value).toBe('http://h:8790/?valdi=1&station=4&session=12&broker=ws%3A%2F%2Fh%3A9001')
    })

    it('sortering: VALdi på båda sidorna — sida A styr, sida B följer (folj=1)', () => {
      const f = fakeClient()
      const film = initFilm({ ...OPTS, sida: 'B' }, f.c)
      f.msg('regi/phase', { phase: 'sortering', session_id: 12 })
      expect(film.lage.value).toBe('sortering')
      expect(film.src.value).toBe('http://h:8790/?valdi=1&station=4&session=12&broker=ws%3A%2F%2Fh%3A9001&folj=1')
    })

    it('sortering: station 2 styrs från sida B (Lögndetektorn), sida A följer', () => {
      expect(valdiFoljer(2, 'B')).toBe(false)
      expect(valdiFoljer(2, 'A')).toBe(true)
      expect(valdiFoljer(1, 'A')).toBe(false)
      expect(valdiFoljer(4, 'B')).toBe(true)
      expect(valdiFoljer(3, null)).toBe(false)
    })

    it('reveal: driver-skärmen får autostart i stället för follower', () => {
      expect(revealSrc('http://h:5188/', { grupp: 2, sessionId: null, driver: true })).toBe('http://h:5188/?group=2&autostart')
      expect(revealSrc('http://h:5188', { grupp: null, sessionId: 5, driver: false })).toBe('http://h:5188/?session=5&follower')
    })

    it('syv: stationens valv + sida + broker, startar direkt', () => {
      const f = fakeClient()
      const film = initFilm({ ...OPTS, sida: 'B' }, f.c)
      f.msg('regi/phase', { phase: 'syv', session_id: 7 })
      expect(film.lage.value).toBe('syv')
      expect(film.src.value).toBe(
        'http://h:8791/?valv=driften&screen=B&station=4&session=7&broker=ws%3A%2F%2Fh%3A9001&autostart=1',
      )
      expect(syvSrc('http://x:1', { valv: 'diplomatkaren', sida: null, sessionId: null, mqttUrl: '' })).toBe(
        'http://x:1/?valv=diplomatkaren&screen=A&autostart=1',
      )
    })

    it('utan stationN visas inga appar (bara filmer); filmen går före appen', () => {
      const f = fakeClient()
      const film = initFilm({ enabled: true, mqttUrl: 'ws://h:9001' }, f.c)
      f.msg('regi/phase', { phase: 'syv' })
      expect(film.synlig.value).toBe(false)
      f.msg('regi/phase', { phase: 'reveal' })
      expect(film.lage.value).toBe('reveal') // reveal behöver ingen station (grupp saknas → appens default)
      f.msg('film/start', { ...TRAILER, fas: 'reveal' })
      expect(film.lage.value).toBe('film')
    })

    it('revealUrl/syvUrl överstyr de härledda adresserna', () => {
      const f = fakeClient()
      const film = initFilm({ ...OPTS, revealUrl: 'http://r.test:5190/', syvUrl: 'http://s.test:9000' }, f.c)
      f.msg('regi/phase', { phase: 'reveal' })
      expect(film.src.value.startsWith('http://r.test:5190/?')).toBe(true)
      f.msg('regi/phase', { phase: 'syv' })
      expect(film.src.value.startsWith('http://s.test:9000/?valv=driften')).toBe(true)
    })
  })
})
