/** Stationsskärmarna följer regis filmer + apparna på broker-NUC:en (IDENTISK i alla X&Y-stationsappar). Se stationFilm.ts. */
export {
  initFilm,
  useFilm,
  filmOptions,
  filmSrc,
  revealSrc,
  syvSrc,
  regiFranMqtt,
  brokerHttp,
  REGI_PORT,
  REVEAL_PORT,
  SYV_PORT,
  SYV_VALV,
  __resetFilmForTest,
} from './stationFilm'
export type { StationFilm, FilmOptions, FilmClient, FilmSignal, OverlayLage } from './stationFilm'
export { default as FilmOverlay } from './FilmOverlay.vue'
