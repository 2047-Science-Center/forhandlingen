/**
 * Band-lagret (Lager A, IDENTISK i alla X&Y-stationer): EN strömbrytare för om riggen kör med
 * RFID-armband eller utan (v49), plus normalisering av gruppens medlemmar.
 *
 * Kontrakt: xy-rigg/SOM.md "Tillägg: bandlöst läge (v49)". Design: xy-arkitektur/XY-BANDLOST-OCH-ANKOMST.md.
 *
 *   bandlöst (default inför v49)  allt banden gör görs på skärmen: rollvalet en person i taget
 *                                 (entrén, voteMode 'skarm'), SYV sveper i turordning.
 *   band                          läsarna: station<N>/rfidnej = roll A, station<N>/rfidja = roll B.
 *
 * Datan är densamma i båda lägena: varje elev har ett band_id. Utan band är det ett VIRTUELLT
 * band = "V" + plats_kod (V2A1), incheckat av xy-startkit/bandlost.py på checkin/participant.
 * Regi, identitetstjänsten och ingest ser ingen skillnad.
 *
 * Påslag (första som finns vinner): ?bandlost=1|0 i URL:en → VITE_BANDLOST=1|0 vid bygget → stationens config.
 * Modulen beror INTE på appens @/config, så den kan kopieras byte-identiskt mellan stationsrepona.
 */

/** Prefix för virtuella band. `V` är aldrig en hexsiffra → krockar aldrig med ett riktigt UID. */
export const VIRTUELLT_PREFIX = 'V'

/** Tolka en 1/0-flagga ('1' | 'true' | 'ja' → true, '0' | 'false' | 'nej' → false, annat → null). */
export function flagga(v: string | null | undefined): boolean | null {
  if (v == null) return null
  const s = String(v).trim().toLowerCase()
  if (s === '1' || s === 'true' || s === 'ja' || s === 'on') return true
  if (s === '0' || s === 'false' || s === 'nej' || s === 'off') return false
  return null
}

/**
 * Bandlöst eller inte. `?bandlost=` i URL:en (kiosk, per skärm) går före byggets `VITE_BANDLOST`,
 * som går före stationens default.
 */
export function bandlostFran(fallback: boolean, env?: string | null, search?: string): boolean {
  const q =
    search ?? (typeof window !== 'undefined' && window.location ? window.location.search : '')
  const url = flagga(new URLSearchParams(q).get('bandlost'))
  if (url != null) return url
  const byggt = flagga(env)
  if (byggt != null) return byggt
  return fallback
}

/** Är band_id ett virtuellt band (bandlöst läge)? */
export function arVirtuellt(bandId: string | null | undefined): boolean {
  return typeof bandId === 'string' && bandId.length > 1 && bandId[0].toUpperCase() === VIRTUELLT_PREFIX
}

/** Plats-koden ur ett virtuellt band (V2A1 → "2A1"), annars null. */
export function platsKod(bandId: string | null | undefined): string | null {
  return arVirtuellt(bandId) ? bandId!.slice(1).toUpperCase() : null
}

/** Ett virtuellt band för en plats-kod ("2a1" → "V2A1"). */
export function virtuelltBand(kod: string): string {
  return VIRTUELLT_PREFIX + kod.trim().toUpperCase()
}

/**
 * Namnet på skärmen. Klasslistan har inga namn (D9) → plats-koden ur det virtuella bandet ("2A1"),
 * som står på lärarens utskrift. Ett riktigt band utan namn → "Band …C4D5".
 */
export function visningsnamn(m: { band_id: string; name?: string | null }): string {
  const n = typeof m.name === 'string' ? m.name.trim() : ''
  if (n) return n
  const kod = platsKod(m.band_id)
  if (kod) return kod
  const id = String(m.band_id ?? '')
  return id ? `Band …${id.slice(-4)}` : 'Okänd'
}

type Sida = 'A' | 'B'
const sida = (v: unknown): Sida | null => (v === 'A' || v === 'B' ? v : null)

/** En medlem som den kommer från regi (station<N>/group) eller en pilot-roster. */
export interface RaMedlem {
  band_id: string
  name?: string | null
  gender?: string | null
  /** Klasslistans fasta sida (SOM: members[].halva). */
  halva?: string | null
  /** Samma sak, entréns äldre namn. Går före `halva` om båda finns. */
  startsida?: string | null
}

/**
 * Normalisera gruppens medlemmar: namn alltid satt (visningsnamn), `startsida` = `startsida ?? halva`
 * (regi skickar `halva`, entrén läser `startsida`). Medlemmar utan band_id tas bort.
 */
export function normaliseraMedlemmar<T extends RaMedlem>(
  members: readonly T[] | null | undefined,
): (T & { name: string; startsida: Sida | null })[] {
  if (!Array.isArray(members)) return []
  return members
    .filter((m) => m && typeof m.band_id === 'string' && m.band_id.length > 0)
    .map((m) => ({ ...m, name: visningsnamn(m), startsida: sida(m.startsida) ?? sida(m.halva) }))
}
