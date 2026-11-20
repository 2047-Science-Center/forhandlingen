/**
 * station-kit/resultat — stationens avslut + resultatet ut (IDENTISK i alla X&Y-stationsappar).
 * Design: xy-arkitektur/XY-RESULTAT-OCH-VINST.md.
 */
export { useAvslut, taktPlan, minst, spelaAvslutLjud, AVSLUT_TIDER, AVSLUT_LJUD } from './avslut'
export type { Takt, UtfallTyp, AvslutTider, AvslutOptions } from './avslut'
export { default as AvslutRuta } from './AvslutRuta.vue'
export {
  initResultat,
  skickaResultat,
  resultatOptions,
  resultatPayload,
  resultatPa,
  __resetResultatForTest,
} from './resultatSink'
export type { ResultatOptions, ResultatClient } from './resultatSink'
