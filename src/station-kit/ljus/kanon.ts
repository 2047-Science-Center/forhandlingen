/**
 * Ljusspråket i Valvet — kanon för ALLA stationer (IDENTISK fil i alla X&Y-stationsappar).
 * Design: Kontext/Mjukvara/xy-arkitektur/XY-FEEDBACK-LJUS-LJUD.md. Söm: xy-rigg/SOM.md "Stationsljus".
 *
 *  - Ett LÄGE är segmentets bas (retained på station<N>/underglow): tutorial, skarp, lek, …
 *  - En GEST är ett engångsblink ovanpå basen (station<N>/feedback, ej retained): rätt, fel, …
 *    Samma händelse ser likadan ut och låter likadant på alla stationer. Rytmen skiljer
 *    gesterna (rätt = 2 snabba, fel = 2 långsamma/tunga), inte bara färgen (färgblindhet).
 */

export type Effekt = 'av' | 'static' | 'blink' | 'puls' | 'chase'

export interface Look {
  color: string
  effekt: Effekt
}

export type Valv = 'teknolog' | 'diplomat' | 'drift' | 'forskning'

/** Valvfärgerna (SYV-låsningen 2026-10-12 = cue-sheeten). */
export const VALVFARG: Record<Valv, string> = {
  teknolog: '#ff5a3c',
  diplomat: '#7ad14f',
  drift: '#e8c020',
  forskning: '#4aa3ff',
}

/**
 * SIDFÄRGERNA (spikade 2026-11-19, Josef — XY-PLATSER): sida A = VARMVITT, sida B = MAGENTA.
 * Samma färg överallt; två värden per sida eftersom WS2812 återger vitt kallt:
 *  - `skarm` = skärmarna (entréns ankomstvy/namnkolumner, incheckningen, 3D-bildens sidor:
 *    CSS-variablerna --entre-side-a/-b och public/entre/sidor-3d.html DEFAULT_COLORS)
 *  - `led`   = underglow (station<N>/underglow i läget `startsida`), varmare för att se varmvit ut på slingan.
 */
export const SIDFARG = {
  A: { namn: 'varmvitt', skarm: '#fff1d6', led: '#ffd9a0' },
  B: { namn: 'magenta', skarm: '#ff3cc8', led: '#ff3ca0' },
} as const

/**
 * Vilken startsida ett underglow-segment hör till (SOM.md "Stationsljus", logiska id:n):
 * `A`/`A.*` och st4:s `puls` (puls-skärmen = sida A) → A; `B`/`B.*` och st4:s `gyro` → B.
 * Övriga (st2 `valdi`, st4 `falt`) hör inte till en sida → null (behåller ankomstens amber chase).
 */
export function sidaForSegment(id: string): 'A' | 'B' | null {
  if (id === 'A' || id.startsWith('A.') || id === 'puls') return 'A'
  if (id === 'B' || id.startsWith('B.') || id === 'gyro') return 'B'
  return null
}

/** Valvens namn för skärmtext (t.ex. "Leta upp valvet med den här färgen"). */
export const VALVNAMN: Record<Valv, string> = {
  teknolog: 'Teknologerna',
  diplomat: 'Diplomatkåren',
  drift: 'Driften',
  forskning: 'Forskningslaget',
}

export const FARG = {
  tutorial: '#35e0d0',
  skarp: '#ff9500',
  lek: '#b06cff',
  amber: '#ff9500',
  amberDim: '#5a3400',
  gron: '#4fd14f',
  rod: '#ff2a1e',
  rodDjup: '#7a1410',
  vit: '#fff0d0',
  stal: '#9fb2c0',
  /** Startsidor vid ankomsten (spikade 2026-11-19: varmvitt + magenta) — LED-värdena ur SIDFARG. */
  sidaA: SIDFARG.A.led,
  sidaB: SIDFARG.B.led,
} as const

/**
 * Lägen = segmentets bas.
 *  vila         amber andning (attract/väntar)
 *  ankomst      amber chase ("kom hit", ny grupp)
 *  startsida    sidfärg A varmvitt / B magenta (sidaForSegment) vid ankomsten; segment utan sida → amber chase
 *  tutorial     ljusblå fast
 *  skarp        orange fast
 *  varning      orange andning (tiden ≤15 s)
 *  sista        orange blink (≤5 s)
 *  vinst        grön fast (håller under resultatrutan)
 *  forlust      djupröd fast
 *  forlorarsida dämpad orange (lag mot lag — aldrig rött)
 *  oavgjort     grön andning
 *  spanning     amber chase (avslutets spänningstakt före avslöjandet, station-kit/resultat)
 *  vinnare      grön chase (vinnarsidan lag mot lag, under resultatrutan, station-kit/resultat)
 *  lek          lila andning
 *  av           släckt
 */
export type Lage =
  | 'vila'
  | 'ankomst'
  | 'startsida'
  | 'tutorial'
  | 'skarp'
  | 'varning'
  | 'sista'
  | 'vinst'
  | 'forlust'
  | 'forlorarsida'
  | 'oavgjort'
  | 'spanning'
  | 'vinnare'
  | 'lek'
  | 'av'

export function lageLook(lage: Lage, segmentId = ''): Look {
  switch (lage) {
    case 'vila':
      return { color: FARG.amber, effekt: 'puls' }
    case 'ankomst':
      return { color: FARG.amber, effekt: 'chase' }
    case 'startsida': {
      const sida = sidaForSegment(segmentId)
      if (!sida) return { color: FARG.amber, effekt: 'chase' }
      return { color: sida === 'B' ? FARG.sidaB : FARG.sidaA, effekt: 'static' }
    }
    case 'tutorial':
      return { color: FARG.tutorial, effekt: 'static' }
    case 'skarp':
      return { color: FARG.skarp, effekt: 'static' }
    case 'varning':
      return { color: FARG.skarp, effekt: 'puls' }
    case 'sista':
      return { color: FARG.skarp, effekt: 'blink' }
    case 'vinst':
      return { color: FARG.gron, effekt: 'static' }
    case 'forlust':
      return { color: FARG.rodDjup, effekt: 'static' }
    case 'forlorarsida':
      return { color: FARG.amberDim, effekt: 'static' }
    case 'oavgjort':
      return { color: FARG.gron, effekt: 'puls' }
    case 'spanning':
      return { color: FARG.amber, effekt: 'chase' }
    case 'vinnare':
      return { color: FARG.gron, effekt: 'chase' }
    case 'lek':
      return { color: FARG.lek, effekt: 'puls' }
    case 'av':
      return { color: '#000000', effekt: 'av' }
  }
}

/** Kanoniska ljudnamn — varje app mappar dem till sin AudioEngine (station-kit/audio). */
export type LjudNamn =
  | 'kvitto'
  | 'kvitto-fel'
  | 'ratt'
  | 'fel'
  | 'inom'
  | 'over'
  | 'varning'
  | 'sista'
  | 'start'
  | 'vinst'
  | 'forlust'
  | 'neutral'
  | 'klar'
  | 'resultat'
  | 'oppnar'
  | 'stanger'

export type Gest = 'kvitto' | 'ratt' | 'inom' | 'fel' | 'over' | 'oppnar' | 'stanger' | 'vinst' | 'forlust' | 'klar'

export interface GestDef {
  color: string
  /** ms per blink (första halvan färg, andra halvan basen). */
  tempo: number
  antal: number
  /** 0 kvitto · 1 rätt · 2 fel · 3 utfall. Högre avbryter lägre; lägre under högre ignoreras. */
  prio: number
  ljud: LjudNamn
  /** Varaktig bas efter blinket (utfall). */
  bas?: Lage
}

export const GEST: Record<Gest, GestDef> = {
  kvitto: { color: FARG.vit, tempo: 300, antal: 1, prio: 0, ljud: 'kvitto' },
  ratt: { color: FARG.gron, tempo: 300, antal: 2, prio: 1, ljud: 'ratt' },
  inom: { color: FARG.gron, tempo: 300, antal: 2, prio: 1, ljud: 'inom' },
  oppnar: { color: FARG.vit, tempo: 300, antal: 2, prio: 1, ljud: 'oppnar' },
  fel: { color: FARG.rod, tempo: 450, antal: 2, prio: 2, ljud: 'fel' },
  over: { color: FARG.rod, tempo: 450, antal: 2, prio: 2, ljud: 'over' },
  stanger: { color: FARG.rod, tempo: 450, antal: 2, prio: 2, ljud: 'stanger' },
  vinst: { color: FARG.gron, tempo: 400, antal: 3, prio: 3, ljud: 'vinst', bas: 'vinst' },
  forlust: { color: FARG.rod, tempo: 600, antal: 3, prio: 3, ljud: 'forlust', bas: 'forlust' },
  klar: { color: FARG.lek, tempo: 600, antal: 1, prio: 3, ljud: 'klar', bas: 'lek' },
}

/**
 * regi/phase → stationens bas UTANFÖR rotationen (cue-sheetens underglow-rader,
 * XY-RIGG-ARKITEKTUR §1.2). null = stationens eget läge styr (rotationen).
 */
/**
 * Regi-faser som går FÖRE stationens eget läge (Josef 2026-11-25): under trailern dämpas
 * underglow till amber fast så att filmen syns, även om gruppen redan står vid stationen
 * (startsida från incheckningen). Efter fasen tar stationens läge över igen.
 */
export const REGI_FORE: readonly string[] = ['trailer']

export function regiLook(fas: string | null, valv: Valv): Look | null {
  const v = VALVFARG[valv]
  switch (fas) {
    case 'idle':
    case 'attract':
    case 'klart':
      return { color: v, effekt: 'puls' }
    case 'incheckning':
      return { color: FARG.amber, effekt: 'puls' }
    case 'trailer':
      return { color: FARG.amberDim, effekt: 'static' }
    case 'reveal':
      return { color: FARG.stal, effekt: 'static' }
    case 'sortering':
      // Dämpad orange fast (Josef 2026-11-25): VALdis hjärtslag blinkar fullt amber ovanpå, domen ger valvfärgen.
      return { color: FARG.amberDim, effekt: 'static' }
    case 'syv':
      return { color: v, effekt: 'static' }
    default:
      return null
  }
}

/**
 * Rotationens fas/läge (station-kit/rotation) → stationens läge. Strängar i stället för
 * rotationens typer så att modulen inte beror på rotationen (st4 saknar den).
 *   off/waiting → null (följ regi), group → startsida (sidfärgerna A/B, XY-PLATSER), running → tutorial|skarp, lek → lek.
 */
export function lageFranRotation(phase: string, mode: string | null): Lage | null {
  switch (phase) {
    case 'group':
      return 'startsida'
    case 'running':
      return mode === 'skarp' ? 'skarp' : 'tutorial'
    case 'lek':
      return 'lek'
    default:
      return null
  }
}
