/**
 * Kiosk-avsluta för touchskärmarna (samma princip som Eco Loco mellan, src/kiosk-exit.js).
 *
 * Håll fingret i ÖVRE VÄNSTRA HÖRNET i 4 s → "Avsluta programmet?" → AVSLUTA stänger
 * fönstret (tillbaka till skrivbordet). En liten ring syns först efter ~1,2 s, så att
 * en besökare som nuddar hörnet aldrig ser något. Rutan stänger sig själv efter 10 s.
 *
 * Dessutom: ett långt tryck med fingret ska aldrig bli högerklick/kontextmeny
 * (touchskärmarna tolkar håll-tryck som secondary click). Musens högerklick lämnas
 * orört, så att man kan felsöka med mus på en dev-dator.
 *
 * window.close() kräver att Chromium startats med --app (kiosk.sh gör det, även i
 * --kiosk-läge). Anropas en gång i main.ts: installKioskExit().
 */
export function installKioskExit(opts: { holdMs?: number; corner?: number } = {}): void {
  if (typeof document === 'undefined') return
  const HOLD_MS = opts.holdMs ?? 4000
  const FEEDBACK_MS = 1200
  const HOT = opts.corner ?? 64

  // --- Långtryck = ingen kontextmeny (bara touch/penna) ---
  let lastPointer = 'mouse'
  document.addEventListener('pointerdown', (e) => (lastPointer = e.pointerType), true)
  document.addEventListener(
    'contextmenu',
    (e) => {
      const caps = (e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities
      if (caps?.firesTouchEvents || lastPointer !== 'mouse') e.preventDefault()
    },
    true,
  )

  // --- Hörnet ---
  const hot = document.createElement('div')
  hot.style.cssText = `position:fixed;top:0;left:0;width:${HOT}px;height:${HOT}px;z-index:2147483646;background:transparent;touch-action:none`

  const ring = document.createElement('div')
  ring.style.cssText =
    'position:fixed;top:12px;left:12px;width:40px;height:40px;z-index:2147483646;' +
    'border:3px solid rgba(255,255,255,.85);border-top-color:transparent;border-radius:50%;' +
    'opacity:0;pointer-events:none;transition:opacity .2s;animation:kxspin 1s linear infinite'

  const box = document.createElement('div')
  box.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;display:none;background:rgba(8,7,5,.94);' +
    'align-items:center;justify-content:center;flex-direction:column;gap:22px;font-family:system-ui,sans-serif'
  box.innerHTML =
    '<div style="font:800 28px system-ui;color:#eee">Avsluta programmet?</div>' +
    '<div data-kx="hint" style="font:600 15px system-ui;color:#999;max-width:520px;text-align:center;line-height:1.5"></div>' +
    '<div style="display:flex;gap:16px">' +
    '<button data-kx="yes" style="font:800 20px system-ui;padding:16px 42px;border-radius:12px;border:0;background:#c0392b;color:#fff">AVSLUTA</button>' +
    '<button data-kx="no" style="font:800 20px system-ui;padding:16px 42px;border-radius:12px;border:0;background:#333;color:#fff">AVBRYT</button>' +
    '</div>'
  const hint = box.querySelector<HTMLElement>('[data-kx="hint"]')!

  const style = document.createElement('style')
  style.textContent = '@keyframes kxspin{to{transform:rotate(360deg)}}'

  let holdTmr: ReturnType<typeof setTimeout> | undefined
  let fbTmr: ReturnType<typeof setTimeout> | undefined
  let autoTmr: ReturnType<typeof setTimeout> | undefined

  function clearHold(): void {
    clearTimeout(holdTmr)
    clearTimeout(fbTmr)
    ring.style.opacity = '0'
  }
  function onDown(e: PointerEvent): void {
    e.preventDefault()
    clearHold()
    fbTmr = setTimeout(() => (ring.style.opacity = '1'), FEEDBACK_MS)
    holdTmr = setTimeout(() => {
      clearHold()
      openConfirm()
    }, HOLD_MS)
  }
  function openConfirm(): void {
    hint.textContent = ''
    box.style.display = 'flex'
    clearTimeout(autoTmr)
    autoTmr = setTimeout(closeConfirm, 10000) // råkade man öppna den → stäng själv
  }
  function closeConfirm(): void {
    box.style.display = 'none'
    clearTimeout(autoTmr)
  }
  function doExit(): void {
    // Stationens server stänger båda fönstren (deploy/nuc stop_kiosk) — funkar även när window.close()
    // blockeras av historiken. Appar utan endpointen får 404 → window.close() nedan som förut.
    fetch('/api/kiosk/avsluta', { method: 'POST' }).catch(() => {})
    try {
      window.close()
    } catch {
      /* ignoreras */
    }
    setTimeout(() => {
      try {
        window.open('', '_self')
        window.close()
      } catch {
        /* ignoreras */
      }
    }, 120)
    // Stängdes inte (vanlig flik / utan --app) → säg det i stället för att låsa skärmen.
    setTimeout(() => {
      if (!document.hidden)
        hint.innerHTML =
          'Fönstret kunde inte stängas av appen. Starta via <b>kiosk.sh</b> (Chromium med <b>--app</b>), eller tryck <b>Alt+F4</b>.'
    }, 2500)
  }

  function mount(): void {
    document.head.appendChild(style)
    document.body.append(hot, ring, box)
    hot.addEventListener('pointerdown', onDown)
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel'] as const) hot.addEventListener(ev, clearHold)
    box.querySelector('[data-kx="no"]')!.addEventListener('click', closeConfirm)
    box.querySelector('[data-kx="yes"]')!.addEventListener('click', doExit)
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
}
