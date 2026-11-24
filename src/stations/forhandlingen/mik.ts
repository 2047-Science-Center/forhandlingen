/**
 * Mikrofonsynk (Josef 2026-11-24): headseten går genom en XLR-mixer. Om NUC:en också får in
 * mixerns ljud (line-in/USB) kan skärmen visa VEM SOM PRATAR under budgivningen — aldrig vad
 * som sägs, inga belopp. Buden låses fortfarande i Klubban.
 *
 *  - AV som standard. På med ?mik=1 (kiosk-URL) eller VITE_MIK=1. ?mik=visa = testvy med nivåer.
 *  - Stereo (mixern panorerar sida A vänster, sida B höger): nivå per sida.
 *    Mono: en gemensam nivå → båda figurerna visar att någon pratar.
 *  - Ingång: ?mikenhet=<deviceId-prefix eller namnbit> väljer enhet, annars systemets standard.
 *  - Kiosk-Chrome måste få mikrofonen utan dialog: starta med
 *    --use-fake-ui-for-media-stream (eller policyn AudioCaptureAllowedUrls för stationens URL).
 *
 * Ren nivåmätning i webbläsaren (Web Audio, RMS); inget spelas in, inget skickas någonstans.
 */
import { reactive, readonly } from 'vue'

export type MikLage = 'av' | 'pa' | 'visa'

const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const env = (import.meta.env.VITE_MIK as string | undefined) ?? ''
export const MIK_LAGE: MikLage = qs.get('mik') === 'visa' ? 'visa' : qs.get('mik') === '1' || env === '1' ? 'pa' : 'av'

/** Tröskel (RMS 0..1) och hysteres: "pratar" slår till över PA och släpper under AV i minst HALL_MS. */
const PA = 0.045
const AV = 0.025
const HALL_MS = 350

export interface MikSida {
  niva: number
  pratar: boolean
}

const state = reactive({
  aktiv: false,
  fel: '' as string,
  stereo: false,
  enhet: '' as string,
  enheter: [] as { id: string; namn: string }[],
  A: { niva: 0, pratar: false } as MikSida,
  B: { niva: 0, pratar: false } as MikSida,
})

let ctx: AudioContext | null = null
let stream: MediaStream | null = null
let raf = 0
const senastOver = { A: 0, B: 0 }

/** RMS (0..1) ur en analysator. */
function rms(an: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  an.getFloatTimeDomainData(buf)
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  return Math.sqrt(s / buf.length)
}

function uppdatera(sida: 'A' | 'B', niva: number, nu: number) {
  const m = state[sida]
  m.niva = Math.min(1, niva * 6)
  if (niva >= PA) senastOver[sida] = nu
  if (!m.pratar && niva >= PA) m.pratar = true
  else if (m.pratar && niva < AV && nu - senastOver[sida] > HALL_MS) m.pratar = false
}

/** Starta lyssningen (idempotent). Gör inget när läget är 'av'. */
export async function startaMik(): Promise<void> {
  if (MIK_LAGE === 'av' || state.aktiv || typeof navigator === 'undefined' || !navigator.mediaDevices) return
  try {
    const onskad = qs.get('mikenhet') ?? ''
    // Första anropet ger behörighet och därmed enhetsnamn.
    let deviceId: string | undefined
    const lista = async () =>
      (await navigator.mediaDevices.enumerateDevices())
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ id: d.deviceId, namn: d.label || d.deviceId.slice(0, 8) }))
    const forsta = await lista()
    const traff = onskad ? forsta.find((d) => d.id.startsWith(onskad) || d.namn.toLowerCase().includes(onskad.toLowerCase())) : undefined
    deviceId = traff?.id
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        channelCount: { ideal: 2 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    state.enheter = await lista()
    const spar = stream.getAudioTracks()[0]
    state.enhet = spar?.label ?? ''
    ctx = new AudioContext()
    const kalla = ctx.createMediaStreamSource(stream)
    const kanaler = spar?.getSettings().channelCount ?? kalla.channelCount
    state.stereo = (kanaler ?? 1) >= 2
    const nyAnalys = () => {
      const a = ctx!.createAnalyser()
      a.fftSize = 1024
      return a
    }
    const anA = nyAnalys()
    const anB = nyAnalys()
    if (state.stereo) {
      const delare = ctx.createChannelSplitter(2)
      kalla.connect(delare)
      delare.connect(anA, 0)
      delare.connect(anB, 1)
    } else {
      kalla.connect(anA)
    }
    const buf = new Float32Array(new ArrayBuffer(anA.fftSize * 4))
    state.aktiv = true
    const tick = () => {
      const nu = performance.now()
      const a = rms(anA, buf)
      const b = state.stereo ? rms(anB, buf) : a
      uppdatera('A', a, nu)
      uppdatera('B', b, nu)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  } catch (e) {
    state.fel = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }
}

export function stoppaMik(): void {
  cancelAnimationFrame(raf)
  stream?.getTracks().forEach((t) => t.stop())
  void ctx?.close()
  ctx = null
  stream = null
  state.aktiv = false
}

export function useMik() {
  return readonly(state)
}
