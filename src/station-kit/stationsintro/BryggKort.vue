<script setup lang="ts">
/**
 * Bryggor och rollkort mellan stationsintrot och rollklippen (Lager A — IDENTISK i alla X&Y-stationer).
 * Källa: xy-produktion/stationsintro/ (FORSLAG.md §3, mall/mall.html). Godkänt av Josef 2026-11-19.
 *
 *   steg="brygga1"  "Träffa de som jobbar här"           (1,8 s)
 *   steg="kortA"    rollkort A: bara rollnamnet         (1,6 s) → station-kit spelar rollklipp A
 *   steg="brygga2"  "…och den som jobbar med det här"   (1,8 s)
 *   steg="kortB"    rollkort B: bara rollnamnet         (1,6 s) → rollklipp B
 *
 * NEUTRAL MELLAN ROLLERNA: kortA och kortB är exakt samma layout, storlek, tid och färg — bara texten byts.
 * Visar aldrig sida A/B (sidan bestäms först i valet). Emit:ar `done` efter fast tid; ett tryck hoppar över
 * (samma beteende som StationIntro.vue). Rollnamnen kommer som data (station-config), sv/no.
 */
import { computed, onMounted, onUnmounted } from 'vue'

type BryggSteg = 'brygga1' | 'kortA' | 'brygga2' | 'kortB'

const props = withDefaults(
  defineProps<{
    steg: BryggSteg
    /** Rollnamnet för kortA/kortB (t.ex. "SÄNDEBUD"). Ignoreras för bryggorna. */
    rollnamn?: string
    sprak?: 'sv' | 'no'
    /** Valvfärgen (SYV-låsningen) — bara på tejpen, samma för båda rollerna. */
    valvfarg?: string
    /** Överstyr tiden (ms). Standard: brygga 1800, kort 1600. */
    ms?: number
  }>(),
  { rollnamn: '', sprak: 'sv', valvfarg: '#ff9500', ms: undefined },
)
const emit = defineEmits<{ done: [] }>()

const TEXT = {
  sv: { ovan: 'I DET HÄR VALVET', brygga1: 'Träffa de som jobbar här', brygga2: '…och den som jobbar med det här', roll: 'ROLL' },
  no: { ovan: 'I DETTE HVELVET', brygga1: 'Møt de som jobber her', brygga2: '…og den som jobber med dette', roll: 'ROLLE' },
} as const
const t = computed(() => TEXT[props.sprak] ?? TEXT.sv)
const arKort = computed(() => props.steg === 'kortA' || props.steg === 'kortB')
const varaktighet = computed(() => props.ms ?? (arKort.value ? 1600 : 1800))

let timer: ReturnType<typeof setTimeout> | null = null
let klar = false
function done(): void {
  if (klar) return
  klar = true
  if (timer) clearTimeout(timer)
  emit('done')
}
onMounted(() => {
  timer = setTimeout(done, varaktighet.value)
})
onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="bk" :class="arKort ? 'bk--kort' : 'bk--brygga'" :style="{ '--valv': valvfarg }" @pointerdown="done">
    <template v-if="!arKort">
      <div class="bk__ovan">{{ t.ovan }}</div>
      <div class="bk__rad"><span :key="steg">{{ steg === 'brygga1' ? t.brygga1 : t.brygga2 }}</span></div>
    </template>
    <template v-else>
      <div class="bk__papper" />
      <div :key="steg" class="bk__lapp">
        <div class="bk__tejp" />
        <small>{{ t.roll }}</small>
        <b>{{ rollnamn }}</b>
      </div>
    </template>
    <div class="bk__scan" />
  </div>
</template>

<style scoped>
@font-face { font-family: 'XY Oswald'; src: url('./fonts/oswald.woff2') format('woff2'); font-weight: 200 700; }
@font-face { font-family: 'XY Plex Mono'; src: url('./fonts/plexmono-700.woff2') format('woff2'); font-weight: 700; }
.bk { position: fixed; inset: 0; z-index: 40; overflow: hidden; background: #05100b; cursor: default; }
.bk__scan { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0 2px, transparent 2px 4px); }
.bk__ovan { position: absolute; left: 0; right: 0; top: 32%; text-align: center; font-family: 'XY Plex Mono', monospace; font-weight: 700;
  font-size: 1.6vw; letter-spacing: 0.3em; color: #9fb2c0; }
.bk__rad { position: absolute; left: 0; right: 0; top: 44%; text-align: center; font-family: 'XY Oswald', sans-serif; font-weight: 700;
  font-size: 5.6vw; letter-spacing: 0.02em; white-space: nowrap; color: #ff9500; text-shadow: 0 0 2.4vw rgba(255, 149, 0, 0.45); }
.bk__rad span { display: inline-block; clip-path: inset(0 100% 0 0); animation: bk-skriv 0.6s steps(24) 0.1s forwards; }
.bk--kort { background: #1a1d12; }
.bk__papper { position: absolute; inset: 0; opacity: 0.18; background: radial-gradient(ellipse at center, #f3ead8 0%, transparent 70%); }
.bk__lapp { position: absolute; left: 50%; top: 50%; width: 62vw; padding: 4.6vw 0 4.2vw; text-align: center; background: #f6efd9;
  border: 0.25vw solid #2c3320; box-shadow: 1.2vw 1.4vw 0 rgba(0, 0, 0, 0.38); transform: translate(-50%, -50%) rotate(-1.5deg);
  animation: bk-slag 0.18s cubic-bezier(0.2, 0.9, 0.2, 1) both; }
.bk__tejp { position: absolute; top: -1.6vw; left: 50%; width: 11vw; height: 3vw; margin-left: -5.5vw; background: var(--valv); opacity: 0.85; transform: rotate(-4deg); }
.bk__lapp small { display: block; font-family: 'XY Plex Mono', monospace; font-weight: 700; font-size: 1.7vw; letter-spacing: 0.25em; color: #2c3320; }
.bk__lapp b { display: block; margin-top: 1vw; font-family: 'XY Oswald', sans-serif; font-weight: 700; font-size: 9.5vw; line-height: 1; letter-spacing: 0.03em; color: #1d2214; }
@keyframes bk-skriv { to { clip-path: inset(0 0 0 0); } }
@keyframes bk-slag {
  from { transform: translate(-50%, -50%) rotate(-7deg) scale(1.35); opacity: 0; }
  to { transform: translate(-50%, -50%) rotate(-1.5deg) scale(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .bk__rad span { animation: none; clip-path: none; }
  .bk__lapp { animation: none; }
}
</style>
