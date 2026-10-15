/**
 * Gemensamt läges-system för X&Y-stationerna (Lager A / station-kit).
 *
 * En station är antingen i TUTORIAL (övning, blått tema) eller LIVE (skarpt,
 * bärnsten). Läget styr HELA UI:ts färg via design-tokens i crt.css: en
 * rot-wrapper sätter attributet `data-mode="tutorial|live"`, och alla
 * komponenter ärver färgen via --color-primary + glöd-tokens (ingen
 * hårdkodad läges-färg i komponenterna).
 *
 * Mekanismen är medvetet transportoberoende och utan Förhandlingen-specifika
 * beroenden, så den kan lyftas rakt in i de tre andra X&Y-stationerna.
 */
import { ref, computed, readonly } from 'vue'

export type StationMode = 'tutorial' | 'live'

/** Modul-globalt läge: delas av alla som anropar useStationMode() i appen. */
const mode = ref<StationMode>('live')

export function useStationMode() {
  function setMode(m: StationMode): void {
    mode.value = m
  }
  return {
    mode: readonly(mode),
    isTutorial: computed(() => mode.value === 'tutorial'),
    isLive: computed(() => mode.value === 'live'),
    setMode,
  }
}
