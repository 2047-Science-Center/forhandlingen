<script setup lang="ts">
/**
 * Rollsekvensen efter stationsintrot (Lager A — IDENTISK i alla X&Y-stationer). Josefs flöde 2026-11-19,
 * INGA klick efter BÖRJA:
 *
 *   brygga1 "Träffa de som jobbar här" (1,8 s) → kortA rollnamn A (1,6 s) → rollklipp A (spelas klart)
 *   → brygga2 (1,8 s) → kortB rollnamn B (1,6 s) → rollklipp B → done (entrén: rollvalet person för person)
 *
 * Roll A spelas alltid först (ENTRE.roles[0], inte ROLLVAL.roles-ordningen). Klippen ur det aktiva klippsetet
 * (entrén: regi:s set_id, SOM.md "Klippset per grupp"). Bryggor/kort = station-kit/stationsintro/BryggKort.vue
 * (ett tryck hoppar över). Klippen: autoplay med ljud (gruppen har just tryckt på BÖRJA), tyst om stationens
 * ljud är av; saknas/fel → nästa steg direkt; säkerhetsspärr längd + 5 s (90 s utan metadata).
 * "Hoppa över ▸" i hörnet hoppar över ett klipp (facilitatorn) — hela skärmen gör det inte (barnen trycker).
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import BryggKort from '../stationsintro/BryggKort.vue'
import Undertext from '../undertext/Undertext.vue'
import type { OverlayData } from '../undertext/undertext'
import { audio } from '../audio/AudioEngine'
import { useHoppa } from '../kiosk/kioskSkip'

type Steg = 'brygga1' | 'kortA' | 'klippA' | 'brygga2' | 'kortB' | 'klippB'
const ORDNING: Steg[] = ['brygga1', 'kortA', 'klippA', 'brygga2', 'kortB', 'klippB']

const props = defineProps<{
  /** Rollnamnen på korten [A, B]. */
  rollnamn: [string, string]
  /** Klipp-url för roll A och B i det aktiva setet ('' = saknas → hoppas över). */
  klipp: [string, string]
  /** Textlager (XY-TEXTLAGER, overlay.json) för klipp A och B — undertext ritas på det textfria klippet. */
  overlay?: [OverlayData | null, OverlayData | null]
  valvfarg?: string
  sprak?: 'sv' | 'no'
}>()
const emit = defineEmits<{ done: []; steg: [steg: Steg] }>()

const i = ref(0)
const steg = computed(() => ORDNING[i.value])
/** Klippet som gäller i ett klippsteg (0 = roll A, 1 = roll B). */
const klippIdx = computed<0 | 1>(() => (steg.value === 'klippB' ? 1 : 0))
/** Textlagret för det aktiva klippet. */
const aktivOverlay = computed<OverlayData | null>(() => props.overlay?.[klippIdx.value] ?? null)
/** Klippets egen klocka (sekunder) — driver undertexten. */
const tid = ref(0)
function onTid(): void {
  tid.value = video.value?.currentTime ?? 0
}
const video = ref<HTMLVideoElement | null>(null)
let guard: ReturnType<typeof setTimeout> | null = null

function clearGuard(): void {
  if (guard) clearTimeout(guard)
  guard = null
}
function nasta(): void {
  clearGuard()
  if (i.value >= ORDNING.length - 1) emit('done')
  else i.value++
}
useHoppa(() => nasta()) // hörngesten (kioskSkip)

async function spela(): Promise<void> {
  const v = video.value
  if (!v) return nasta()
  guard = setTimeout(nasta, 90000)
  v.muted = audio.muted
  try {
    await v.play()
  } catch {
    try {
      v.muted = true
      await v.play()
    } catch {
      nasta()
    }
  }
}
function onMeta(): void {
  const d = video.value?.duration
  if (d && Number.isFinite(d)) {
    clearGuard()
    guard = setTimeout(nasta, (d + 5) * 1000)
  }
}

watch(
  steg,
  (s) => {
    emit('steg', s)
    tid.value = 0
    if (s !== 'klippA' && s !== 'klippB') return
    if (!props.klipp[klippIdx.value]) {
      nasta() // klippet saknas → nästa steg direkt
      return
    }
    // vänta tills <video> är monterad
    setTimeout(() => void spela(), 0)
  },
  { immediate: true },
)
onUnmounted(clearGuard)
</script>

<template>
  <div class="rs">
    <BryggKort
      v-if="steg === 'brygga1' || steg === 'brygga2'"
      :key="steg"
      :steg="steg"
      :sprak="props.sprak ?? 'sv'"
      :valvfarg="props.valvfarg"
      @done="nasta"
    />
    <BryggKort
      v-else-if="steg === 'kortA' || steg === 'kortB'"
      :key="steg"
      :steg="steg"
      :rollnamn="steg === 'kortA' ? props.rollnamn[0] : props.rollnamn[1]"
      :sprak="props.sprak ?? 'sv'"
      :valvfarg="props.valvfarg"
      @done="nasta"
    />
    <div v-else class="rs__klipp">
      <video
        ref="video"
        :key="steg"
        class="rs__video"
        :src="props.klipp[klippIdx]"
        playsinline
        preload="auto"
        @loadedmetadata="onMeta"
        @timeupdate="onTid"
        @ended="nasta"
        @error="nasta"
      />
      <Undertext v-if="aktivOverlay" :rader="aktivOverlay.undertext" :tid="tid" :sprak="props.sprak ?? 'sv'" />
      <span class="rs__roll">{{ props.rollnamn[klippIdx] }}</span>
    </div>
  </div>
</template>

<style scoped>
.rs {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}
.rs__klipp {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
}
.rs__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.rs__roll {
  position: absolute;
  left: 1rem;
  top: 0.8rem;
  padding: 0.2em 0.7em;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: var(--color-ink-strong, #eee);
  font-family: var(--font-retro, monospace);
  font-size: clamp(1rem, 2vw, 1.5rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.rs__skip {
  position: absolute;
  right: 1rem;
  bottom: 0.8rem;
  padding: 0.25em 0.8em;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: var(--color-ink-muted, #bbb);
  font-size: 0.9rem;
  cursor: pointer;
}
</style>
