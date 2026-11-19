/** Stationsskärmarna följer regis filmer (IDENTISK i alla X&Y-stationsappar). Se stationFilm.ts. */
export { initFilm, useFilm, filmOptions, filmSrc, regiFranMqtt, REGI_PORT, __resetFilmForTest } from './stationFilm'
export type { StationFilm, FilmOptions, FilmClient, FilmSignal } from './stationFilm'
export { default as FilmOverlay } from './FilmOverlay.vue'
