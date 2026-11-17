/**
 * Rollval-flödet (Lager A — gemensamt över alla X&Y-stationer).
 *
 * Ett touchskärms-flöde som läggs FÖRST i en station, före stationens eget
 * flöde, bakom en config-flagga (ROLLVAL_ENABLED) så det kan hoppas över.
 * Besökaren ser två "en dag i livet"-klipp (ett per roll) och väljer sedan
 * roll på skärmen. (Band-bipp kopplas in senare — inte nu.)
 *
 * Inramning: rollerna beskrivs som förmågor värda att vara bra på. Framingen
 * är IMPLICIT — copyn säger aldrig "framtidsyrke" eller nämner AI.
 *
 * KLIPPSTRUKTUR: varje station har flera KLIPPSET. Ett set = ETT klipp per
 * roll. Vid en körning visas ETT set (variation mellan grupper). Aktivt set
 * styrs av config/wiring och går att växla i granskningsläget.
 *
 * Datan (namn, texter, klipp) bor i stationens config.ts; KOMPONENTEN är
 * identisk överallt och tar allt via `config`-propen.
 */

/** En roll i rollvalet. `id` är stabilt (matchar klippsetens nycklar). */
export interface RollvalRole {
  /** Stabilt id — nyckel i varje klippset. */
  id: string
  /** Rollens namn (framtidsyrkes-ton), t.ex. "Sändebud". */
  name: string
  /** Kort en-rads-hook som ringar in förmågan. */
  tagline: string
  /** 1–2 meningar som beskriver förmågan (implicit framtidsyrkes-ton). */
  description: string
}

/** Ett klippset: en klipp-url per roll-id. */
export type RollvalClipSet = Record<string, string>

/** All data rollval-komponenten behöver (allt per station via config.ts). */
export interface RollvalConfig {
  /** Rubrik på rollval-skärmen (oftast stationens namn). */
  stationTitle: string
  /** Kort inramning under rubriken. */
  intro: string
  /** Formuleringen på split-screen-valet (bättre än "Vilken roll vill du ha?"). */
  question: string
  /** Stationens två roller (ordning = roll A, roll B). */
  roles: [RollvalRole, RollvalRole]
  /** Klippseten. Varje set har en url per roll-id. Minst ett set. */
  clipSets: RollvalClipSet[]
}
