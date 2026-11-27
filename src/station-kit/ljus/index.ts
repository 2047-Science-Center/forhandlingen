/** Stationens ljus + feedbackljud (IDENTISK i alla X&Y-stationsappar). Se stationLjus.ts. */
export { initLjus, useLjus, ljusOptions, __resetLjusForTest } from './stationLjus'
export type { StationLjus, LjusOptions, LjusClient } from './stationLjus'
export {
  GEST,
  FARG,
  SIDFARG,
  VALVFARG,
  VALVDIM,
  VALVNAMN,
  STANDARDSLINGA,
  dampa,
  lageLook,
  regiLook,
  lageFranRotation,
  sidaForSegment,
} from './kanon'
export type { Spar, SparRad } from './underglowSpar'
export type { Gest, Lage, LjudNamn, Look, Effekt, Valv, GestDef } from './kanon'
export { default as LjusRemsa } from './LjusRemsa.vue'
export { useResultatTid } from './resultatTid'
export type { ResultatTidOptions } from './resultatTid'
