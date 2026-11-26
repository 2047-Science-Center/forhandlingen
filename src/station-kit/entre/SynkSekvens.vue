<script setup lang="ts">
/**
 * Stationsintrot + rollsekvensen I TAKT på stationens två skärmar (entre `synkIntro`):
 *   intro (hype-klippet) → brygga1 "Träffa de som jobbar här" → kort A → klipp A → brygga2 → kort B → klipp B
 *
 * Ledarskärmen leder: den går vidare när ett steg är klart (bryggornas tid, klippets slut, saknad fil)
 * och skickar `entre:seq {steg, at}`. Följaren visar samma steg och spolar klippen till ledarens tid
 * (rättar om de glider > 0,3 s). Ett tryck / "Hoppa över" på vilken skärm som helst hoppar steget på båda.
 * Ljudet spelas BARA från ledaren (stationen har en högtalare); följarens klipp är tysta.
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import BryggKort from '../stationsintro/BryggKort.vue'
import Undertext from '../undertext/Undertext.vue'
import type { OverlayData } from '../undertext/undertext'
import { audio } from '../audio/AudioEngine'
import { useEntre, type SeqSteg } from './entre'
import { useHoppa } from '../kiosk/kioskSkip'

const props = defineProps<{
  /** Stationsintrots hype-klipp (config.introClip). */
  introClip?: string
  /** Rollnamnen på korten [A, B]. */
  rollnamn: [string, string]
  /** Klipp-url för roll A och B i det aktiva setet ('' = saknas → steget hoppas över). */
  klipp: [string, string]
  /** Textlager (XY-TEXTLAGER, overlay.json) för klipp A och B — undertext ritas på det textfria klippet. */
  overlay?: [OverlayData | null, OverlayData | null]
  valvfarg?: string
  sprak?: 'sv' | 'no'
}>()

const entre = useEntre()
const leder = computed(() => entre.state.leader)
const steg = computed<SeqSteg | null>(() => entre.state.seq?.steg ?? null)
const at = computed(() => entre.state.seq?.at ?? Date.now())
const arKlipp = computed(() => steg.value === 'intro' || steg.value === 'klippA' || steg.value === 'klippB')
const src = computed(() =>
  steg.value === 'intro' ? (props.introClip ?? '') : steg.value === 'klippA' ? props.klipp[0] : steg.value === 'klippB' ? props.klipp[1] : '',
)
const rollnamn = computed(() => (steg.value === 'klippB' || steg.value === 'kortB' ? props.rollnamn[1] : props.rollnamn[0]))
/** Textlagret som gäller i klippsteget (intro har inga undertexter). */
const aktivOverlay = computed<OverlayData | null>(() =>
  steg.value === 'klippA' ? (props.overlay?.[0] ?? null) : steg.value === 'klippB' ? (props.overlay?.[1] ?? null) : null,
)
/** Klippets egen klocka (sekunder) — driver undertexten. */
const tid = ref(0)
function onTid(): void {
  tid.value = video.value?.currentTime ?? 0
}

const video = ref<HTMLVideoElement | null>(null)
let guard: ReturnType<typeof setTimeout> | null = null
let synkTimer: ReturnType<typeof setInterval> | null = null

function stada(): void {
  if (guard) clearTimeout(guard)
  if (synkTimer) clearInterval(synkTimer)
  guard = null
  synkTimer = null
}
/** Det här steget är klart → nästa (följaren ber ledaren; redan passerat steg ignoreras i entre). */
function klart(s: SeqSteg | null = steg.value): void {
  if (s) entre.seqNext(s)
}
// Hörngesten (kioskSkip) hoppar steget — inga synliga hoppa över-knappar (Josef 2026-11-26).
useHoppa(() => klart())
/** Sekunder in i steget enligt ledarens klocka. */
const iSteget = () => Math.max(0, (Date.now() - at.value) / 1000)

async function spela(): Promise<void> {
  const v = video.value
  const s = steg.value
  if (!v || !s) return
  // Ledaren tyst bara om stationens ljud är av; följaren alltid tyst (ljudet kommer från ledaren).
  v.muted = !leder.value || audio.muted
  const sok = () => {
    try {
      const mal = iSteget()
      if (mal > 0.15 && (!Number.isFinite(v.duration) || mal < v.duration)) v.currentTime = mal
    } catch {
      /* ignore */
    }
  }
  if (v.readyState >= 1) sok()
  else v.addEventListener('loadedmetadata', sok, { once: true })
  try {
    await v.play()
  } catch {
    try {
      v.muted = true
      await v.play()
    } catch {
      if (leder.value) klart(s)
    }
  }
  // Håll följaren på ledarens tid.
  synkTimer = setInterval(() => {
    const vv = video.value
    if (!vv || vv.readyState < 2 || vv.paused) return
    const mal = iSteget()
    if (Number.isFinite(vv.duration) && mal < vv.duration && Math.abs(vv.currentTime - mal) > 0.3) vv.currentTime = mal
  }, 500)
}
function onMeta(): void {
  const d = video.value?.duration
  if (!leder.value || !d || !Number.isFinite(d)) return
  if (guard) clearTimeout(guard)
  const s = steg.value
  guard = setTimeout(() => klart(s), Math.max(1, d - iSteget() + 5) * 1000) // säkerhetsspärr
}
function onSlut(): void {
  if (leder.value) klart()
}

watch(
  steg,
  (s) => {
    stada()
    tid.value = 0
    if (!s || !arKlipp.value) return
    if (!src.value) {
      if (leder.value) klart(s) // klippet saknas → nästa steg direkt
      return
    }
    if (leder.value) {
      guard = setTimeout(() => klart(s), 90000) // utan metadata
    }
    setTimeout(() => void spela(), 0) // vänta tills <video> är monterad
  },
  { immediate: true },
)
onUnmounted(stada)
</script>

<template>
  <div class="ss">
    <BryggKort
      v-if="steg === 'brygga1' || steg === 'brygga2'"
      :key="steg"
      :steg="steg"
      :sprak="props.sprak ?? 'sv'"
      :valvfarg="props.valvfarg"
      @done="klart(steg)"
    />
    <BryggKort
      v-else-if="steg === 'kortA' || steg === 'kortB'"
      :key="steg"
      :steg="steg"
      :rollnamn="rollnamn"
      :sprak="props.sprak ?? 'sv'"
      :valvfarg="props.valvfarg"
      @done="klart(steg)"
    />
    <div v-else-if="arKlipp && src" class="ss__klipp">
      <video
        ref="video"
        :key="steg ?? ''"
        class="ss__video"
        :src="src"
        playsinline
        preload="auto"
        @loadedmetadata="onMeta"
        @timeupdate="onTid"
        @ended="onSlut"
        @error="onSlut"
      />
      <Undertext
        v-if="steg !== 'intro' && aktivOverlay"
        :rader="aktivOverlay.undertext"
        :tid="tid"
        :sprak="props.sprak ?? 'sv'"
      />
      <span v-if="steg !== 'intro'" class="ss__roll">{{ rollnamn }}</span>
    </div>
  </div>
</template>

<style scoped>
.ss { position: relative; flex: 1; min-height: 0; display: flex; }
.ss__klipp {
  position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
  background: #000; border-radius: 12px; overflow: hidden;
}
.ss__video { width: 100%; height: 100%; object-fit: contain; }
.ss__roll {
  position: absolute; left: 1rem; top: 0.8rem; padding: 0.2em 0.7em; border-radius: 6px;
  background: rgba(0, 0, 0, 0.55); color: var(--color-ink-strong, #eee); font-family: var(--font-retro, monospace);
  font-size: clamp(1rem, 2vw, 1.5rem); letter-spacing: 0.08em; text-transform: uppercase;
}
.ss__skip, .ss__hint {
  position: absolute; right: 1rem; bottom: 0.8rem; padding: 0.25em 0.8em; border-radius: 999px;
  background: rgba(0, 0, 0, 0.55); color: var(--color-ink-muted, #bbb); font-size: 0.9rem;
}
.ss__skip { border: 1px solid rgba(255, 255, 255, 0.3); cursor: pointer; }
.ss__hint { pointer-events: none; }
</style>
