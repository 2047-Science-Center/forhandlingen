/**
 * Kiosk-HOPPA för touchskärmarna (Lager A, generiskt — Josef 2026-11-26). Systern till kioskExit:
 *
 *   Håll fingret i ÖVRE HÖGRA HÖRNET i 2 s → hoppa till NÄSTA STEG.
 *
 * Osynligt för besökarna (en liten ring först efter ~0,6 s, sedan en kort ⏭-blink). Ersätter alla
 * synliga "Hoppa över"-knappar, så att facilitatorn kan labba sig igenom flödet utan att
 * stationen har knappar som barnen trycker på.
 *
 * VAD som är "nästa steg" bestämmer det som syns: varje vy registrerar sitt hopp med useHoppa(fn)
 * (eller onHoppa(fn) utanför Vue). Den SENAST registrerade provas först (en stack), så ett klipp inuti
 * entrén går före entréns eget steg. Ett hopp som returnerar `false` ("inte mitt läge") släpper vidare
 * till nästa i stapeln — behövs eftersom Vue monterar barn före förälder. Inget hoppade → svag blink.
 *
 * Anropas en gång i main.ts: installKioskSkip().
 *
 * pilotUi(): sant bara med ?pilot=1 i adressen — då visas facilitator-/pilotkontrollerna igen.
 */
import { onMounted, onUnmounted } from 'vue'

type Hopp = () => boolean | void
const stack: Hopp[] = []

/** Registrera ett hopp (senast registrerade vinner). Returnerar avregistreringen. */
export function onHoppa(fn: Hopp): () => void {
  stack.push(fn)
  return () => {
    const i = stack.lastIndexOf(fn)
    if (i >= 0) stack.splice(i, 1)
  }
}

/** Vue: hoppet gäller så länge komponenten är monterad. */
export function useHoppa(fn: Hopp): void {
  let av: (() => void) | null = null
  onMounted(() => (av = onHoppa(fn)))
  onUnmounted(() => av?.())
}

/** Kör det översta hoppet (gesten, eller tangent i dev). Sant om något hoppade. */
export function hoppa(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]() !== false) return true
  }
  return false
}

/** Facilitator-/pilotkontroller syns bara med ?pilot=1. */
export function pilotUi(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('pilot') === '1'
}

export function installKioskSkip(opts: { holdMs?: number; corner?: number } = {}): void {
  if (typeof document === 'undefined') return
  const HOLD_MS = opts.holdMs ?? 2000
  const FEEDBACK_MS = 600
  const HOT = opts.corner ?? 64

  const hot = document.createElement('div')
  hot.style.cssText = `position:fixed;top:0;right:0;width:${HOT}px;height:${HOT}px;z-index:2147483646;background:transparent;touch-action:none`

  const ring = document.createElement('div')
  ring.style.cssText =
    'position:fixed;top:12px;right:12px;width:40px;height:40px;z-index:2147483646;' +
    'border:3px solid rgba(255,255,255,.85);border-top-color:transparent;border-radius:50%;' +
    'opacity:0;pointer-events:none;transition:opacity .2s;animation:kxspin 1s linear infinite'

  const blink = document.createElement('div')
  blink.textContent = '⏭'
  blink.style.cssText =
    'position:fixed;top:10px;right:14px;z-index:2147483646;font:700 30px system-ui;color:#fff;' +
    'opacity:0;pointer-events:none;transition:opacity .25s;text-shadow:0 0 10px rgba(0,0,0,.8)'

  const style = document.createElement('style')
  style.textContent = '@keyframes kxspin{to{transform:rotate(360deg)}}'

  let holdTmr: ReturnType<typeof setTimeout> | undefined
  let fbTmr: ReturnType<typeof setTimeout> | undefined

  function clearHold(): void {
    clearTimeout(holdTmr)
    clearTimeout(fbTmr)
    ring.style.opacity = '0'
  }
  function visaBlink(ok: boolean): void {
    blink.style.opacity = ok ? '1' : '0.35'
    setTimeout(() => (blink.style.opacity = '0'), 700)
  }
  function onDown(e: PointerEvent): void {
    e.preventDefault()
    clearHold()
    fbTmr = setTimeout(() => (ring.style.opacity = '1'), FEEDBACK_MS)
    holdTmr = setTimeout(() => {
      clearHold()
      visaBlink(hoppa())
    }, HOLD_MS)
  }

  function mount(): void {
    document.head.appendChild(style)
    document.body.append(hot, ring, blink)
    hot.addEventListener('pointerdown', onDown)
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel'] as const) hot.addEventListener(ev, clearHold)
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
}
