/**
 * Avslutet — stationens slut i fem takter (IDENTISK i alla X&Y-stationsappar).
 * Design: xy-arkitektur/XY-RESULTAT-OCH-VINST.md §2.1.
 *
 *   skarpt slut ─► 1 UPPBYGGNAD ─► 2 SPÄNNING ─► 3 AVSLÖJANDE ─► 4 UTFALL ──────────► 5 LEK
 *                  spelet fryser    virvel        slaget + rubrik  min 8 s · auto 45 s   (rotationen)
 *                  ljus: stänger    amber chase   appens utfall    "Vi är klara ▸"
 *
 * Allt går framåt av sig självt fram till utfallet — ingen takt före utfallet väntar på tryck,
 * så en station kan inte hänga innan `done`. Varje fönster kör sekvensen själv när det ser
 * utfallet i det synkade spelläget (samma NUC → samma ögonblick). Ljuset skrivs bara av
 * skrivarfönstret; ljudet spelas i de fönster som har `ljud` på.
 *
 *   const avslut = useAvslut({ ljud: true, ljus: { skrivare, ids }, onAvslojande, onAuto })
 *   avslut.start()            // när utfallet är låst
 *   avslut.takt.value         // 'uppbyggnad' | 'spanning' | 'avslojande' | 'utfall'
 *   avslut.kanGaVidare.value  // knappen "Vi är klara ▸" (efter 8 s från avslöjandet)
 */
import { getCurrentInstance, onBeforeUnmount, ref } from 'vue'
import { audio } from '@/station-kit/audio/AudioEngine'
import { useLjus } from '@/station-kit/ljus/stationLjus'

export type Takt = 'av' | 'uppbyggnad' | 'spanning' | 'avslojande' | 'utfall'

/** Utfallstyp — styr färg/ikon i rutan (ljuset sätter appen i onAvslojande). */
export type UtfallTyp = 'vinst' | 'oavgjort' | 'klarat' | 'delvis' | 'missat'

export interface AvslutTider {
  /** Takt 1: spelet fryser, en rad om vad som händer. */
  uppbyggnadMs: number
  /** Takt 2: spänningen (virveln). */
  spanningMs: number
  /** Takt 3: rubriken ensam innan siffra/rad/knapp tonar in. */
  avslojandeMs: number
  /** Minsta visningstid från avslöjandet innan gruppen kan gå vidare. */
  minMs: number
  /** Auto-vidare från avslöjandet utan tryck (done skickas alltid). */
  autoMs: number
}

export const AVSLUT_TIDER: AvslutTider = {
  uppbyggnadMs: 1800,
  spanningMs: 2500, // = sfx-virvel.mp3
  avslojandeMs: 1400,
  minMs: 8000,
  autoMs: 45000,
}

/** Takternas starttider (ms från start). Ren funktion — testbar. */
export function taktPlan(t: AvslutTider): { takt: Exclude<Takt, 'av'>; vid: number }[] {
  const a = t.uppbyggnadMs
  const b = a + t.spanningMs
  const c = b + t.avslojandeMs
  return [
    { takt: 'uppbyggnad', vid: 0 },
    { takt: 'spanning', vid: a },
    { takt: 'avslojande', vid: b },
    { takt: 'utfall', vid: c },
  ]
}

/** Ljudfilerna (public/Sound/sfx/, kanon i xy-simulator/media/ljud/xy-ljud/sfx/resultat/). */
export const AVSLUT_LJUD = {
  virvel: 'sfx-virvel.mp3',
  virvelKort: 'sfx-virvel-kort.mp3',
  avslojande: 'sfx-avslojande.mp3',
} as const

const filer = new Map<string, HTMLAudioElement>()

/** Spela en fil ur public/Sound/sfx/ på ljudmotorns volym. Ljud är aldrig kritiskt. */
export function spelaAvslutLjud(fil: string): void {
  if (audio.muted || typeof Audio === 'undefined') return
  try {
    let el = filer.get(fil)
    if (!el) {
      el = new Audio(import.meta.env.BASE_URL + 'Sound/sfx/' + fil)
      el.preload = 'auto'
      filer.set(fil, el)
    }
    const kopia = el.cloneNode() as HTMLAudioElement
    kopia.volume = audio.volume
    void kopia.play()?.catch(() => undefined)
  } catch {
    /* ljud är aldrig kritiskt */
  }
}

export interface AvslutOptions {
  tider?: Partial<AvslutTider>
  /** Spela avslutets ljud (stänger, virvel, slag) i det här fönstret. */
  ljud?: boolean | (() => boolean)
  /** Ljuset: bara skrivarfönstret sätter stänger/spänning. ids = segment (default: fönstrets egna). */
  ljus?: { skrivare: boolean | (() => boolean); ids?: string[] } | null
  /** Kort virvel (1,25 s), t.ex. en andra spänning. */
  kortVirvel?: boolean
  /** Takt 3: slaget har gått — appen sätter utfallets ljus och spelar sitt utfallsljud. */
  onAvslojande?: () => void
  /** Varje taktbyte (för appens egna effekter). */
  onTakt?: (t: Takt) => void
  /** Auto-vidare efter `autoMs` från avslöjandet (låt bara ledaren agera). */
  onAuto: () => void
}

const val = (v: boolean | (() => boolean) | undefined, d: boolean): boolean =>
  typeof v === 'function' ? v() : (v ?? d)

export function useAvslut(o: AvslutOptions) {
  const t: AvslutTider = { ...AVSLUT_TIDER, ...o.tider }
  if (o.kortVirvel) t.spanningMs = Math.min(t.spanningMs, 1250)
  const takt = ref<Takt>('av')
  const kanGaVidare = ref(false)
  let timers: ReturnType<typeof setTimeout>[] = []

  function stop(): void {
    timers.forEach(clearTimeout)
    timers = []
  }

  function ljusNu(fn: (l: ReturnType<typeof useLjus>, ids?: string[]) => void): void {
    if (!o.ljus || !val(o.ljus.skrivare, false)) return
    try {
      fn(useLjus(), o.ljus.ids)
    } catch {
      /* ljuset är aldrig kritiskt */
    }
  }

  function steg(ny: Takt): void {
    takt.value = ny
    const ljud = val(o.ljud, true)
    if (ny === 'uppbyggnad') {
      ljusNu((l, ids) => l.gest('stanger', ids, { tyst: true }))
      if (ljud) {
        try {
          useLjus().ljud('stanger')
        } catch {
          /* inget ljus initierat → inget kanon-ljud */
        }
      }
    } else if (ny === 'spanning') {
      ljusNu((l, ids) => l.lage('spanning', ids))
      if (ljud) spelaAvslutLjud(o.kortVirvel ? AVSLUT_LJUD.virvelKort : AVSLUT_LJUD.virvel)
    } else if (ny === 'avslojande') {
      if (ljud) spelaAvslutLjud(AVSLUT_LJUD.avslojande)
      o.onAvslojande?.()
      kanGaVidare.value = t.minMs <= 0
      timers.push(setTimeout(() => (kanGaVidare.value = true), t.minMs))
      timers.push(
        setTimeout(() => {
          stop()
          o.onAuto()
        }, t.autoMs),
      )
    }
    o.onTakt?.(ny)
  }

  /** Starta sekvensen (utfallet är låst). Startar om från takt 1 om den redan kör. */
  function start(): void {
    stop()
    kanGaVidare.value = false
    for (const p of taktPlan(t)) {
      if (p.vid === 0) steg(p.takt)
      else timers.push(setTimeout(() => steg(p.takt), p.vid))
    }
  }

  /** Avbryt och nollställ (rutan lämnas). */
  function aterstall(): void {
    stop()
    takt.value = 'av'
    kanGaVidare.value = false
  }

  if (getCurrentInstance()) onBeforeUnmount(stop)
  return { takt, kanGaVidare, start, stop, aterstall, tider: t }
}

/** Är takten minst `min`? (för v-if i mallarna: siffra/rad syns från 'utfall'.) */
export function minst(takt: Takt, min: Exclude<Takt, 'av'>): boolean {
  const ord: Takt[] = ['av', 'uppbyggnad', 'spanning', 'avslojande', 'utfall']
  return ord.indexOf(takt) >= ord.indexOf(min)
}
