/**
 * Ljus-adapter. Appen säger "lucka N, tillstånd X" — aldrig pixelindex.
 * Firmware (ESP32) äger geometrin lucka→pixlar.
 *
 * Kontrakt (§5.1): station<N>/lights payload
 *   { hatch: 1..5, state: "active"|"won"|"off", winner: "lag1"|"lag2"|null }
 *   { state: "reset" } släcker allt.
 */

import type { HatchLight } from '@/stations/forhandlingen/engine/types'

export interface Lights {
  /** Sätt hela luckradens tillstånd (idempotent). */
  set(lights: HatchLight[]): void
  /** Släck allt. */
  reset(): void
}
