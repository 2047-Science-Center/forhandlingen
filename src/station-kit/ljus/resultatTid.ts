/**
 * Resultatrutans tider (XY-FEEDBACK-LJUS-LJUD §6), IDENTISK i alla stationsappar:
 *  - minst `minMs` (8 s) innan gruppen kan gå vidare → ingen klickar förbi utfallet
 *  - auto-vidare efter `autoMs` (45 s) utan touch → done skickas alltid, ingen station hänger regi
 *
 *   const rt = useResultatTid({ onAuto: () => finish() })
 *   rt.start()                 // när resultatet visas
 *   <button :disabled="!rt.kanGaVidare.value" @click="finish">
 *   rt.stop()                  // när rutan lämnas (onBeforeUnmount sköts automatiskt)
 */
import { getCurrentInstance, onBeforeUnmount, ref } from 'vue'

export interface ResultatTidOptions {
  minMs?: number
  autoMs?: number
  onAuto: () => void
}

export function useResultatTid(o: ResultatTidOptions) {
  const minMs = o.minMs ?? 8000
  const autoMs = o.autoMs ?? 45000
  const kanGaVidare = ref(false)
  let tMin: ReturnType<typeof setTimeout> | null = null
  let tAuto: ReturnType<typeof setTimeout> | null = null

  function stop(): void {
    if (tMin) clearTimeout(tMin)
    if (tAuto) clearTimeout(tAuto)
    tMin = tAuto = null
  }
  function start(): void {
    stop()
    kanGaVidare.value = minMs <= 0
    tMin = setTimeout(() => (kanGaVidare.value = true), minMs)
    tAuto = setTimeout(() => {
      stop()
      o.onAuto()
    }, autoMs)
  }
  if (getCurrentInstance()) onBeforeUnmount(stop)
  return { kanGaVidare, start, stop }
}
