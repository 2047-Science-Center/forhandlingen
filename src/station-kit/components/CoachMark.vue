<script setup lang="ts">
/**
 * Återanvändbar coach-mark / spotlight-overlay (Lager A / station-kit).
 *
 * Mönster lånat från Eco Locos tutorial: grund-UI:t ligger kvar och syns hela
 * tiden; overlayn DIMMAR allt utom ETT mål-element (spotlight via box-shadow-
 * hål) och visar en kort bubbla intill. En sak i taget, visa-gör-förklara,
 * minimal text. Valfri "förstärknings-ruta" (ikon + kort uppdrag) i bubblan.
 *
 * Målet pekas ut med en CSS-selector (`target`) som slås upp i dokumentet —
 * overlayn mäter dess rect (fixed → viewport-koordinater) och ritar hålet där.
 * Saknas målet visas bubblan centrerad utan hål. Klick var som helst ELLER på
 * knappen → `next`. Prick-rad via `step`/`steps`. Reduced-motion: ingen puls.
 *
 * Färg ärvs via --color-primary (blå i tutorial, bärnsten i skarpt) — ingen
 * hårdkodad läges-färg. Overlayn blockerar interaktion med grund-UI:t bakom.
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from '../i18n'

const props = withDefaults(
  defineProps<{
    /** CSS-selector för mål-elementet. Tomt/ej funnet → centrerad bubbla. */
    target?: string | null
    title?: string
    body?: string
    /** Knapptext (default: "NÄSTA ▸"). */
    cta?: string
    /** Prick-rad: aktuellt steg (0-baserat) av totalt. */
    step?: number
    steps?: number
    /** Förstärknings-ruta: valfri roll-ikon-slot + kort uppdragstext. */
    reinforce?: string
    /** Spotlight-padding runt målet (px). */
    pad?: number
    /** Framtvinga bubbelplacering; auto = ovanför/under beroende på målet. */
    placement?: 'auto' | 'top' | 'bottom' | 'center'
  }>(),
  { target: null, pad: 12, placement: 'auto' },
)
const emit = defineEmits<{ next: [] }>()
const { t } = useI18n()

interface Rect {
  x: number
  y: number
  w: number
  h: number
}
const rect = ref<Rect | null>(null)
const bubbleRef = ref<HTMLElement | null>(null)
const bubbleH = ref(220)
const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const vh = ref(typeof window !== 'undefined' ? window.innerHeight : 720)

function measure() {
  vw.value = window.innerWidth
  vh.value = window.innerHeight
  if (bubbleRef.value) bubbleH.value = bubbleRef.value.offsetHeight
  if (!props.target) {
    rect.value = null
    return
  }
  // Union av ALLA matchande element → kan spotlighta samma rad i båda lagens
  // kort samtidigt (t.ex. [data-tut="res-capital"] i resultat-genomgången).
  const els = document.querySelectorAll(props.target)
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  let found = false
  els.forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return
    found = true
    x0 = Math.min(x0, r.left)
    y0 = Math.min(y0, r.top)
    x1 = Math.max(x1, r.right)
    y1 = Math.max(y1, r.bottom)
  })
  if (!found) {
    rect.value = null
    return
  }
  rect.value = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

let ro: ResizeObserver | null = null
let rafs: number[] = []
function remeasureSoon() {
  // Flera mätningar medan layouten sätter sig (foton/typsnitt laddar in).
  rafs.forEach((id) => cancelAnimationFrame(id))
  rafs = []
  for (const delayFrames of [0, 2, 10]) {
    let n = delayFrames
    const tickTo = () => {
      if (n-- > 0) rafs.push(requestAnimationFrame(tickTo))
      else measure()
    }
    rafs.push(requestAnimationFrame(tickTo))
  }
}

onMounted(() => {
  measure()
  remeasureSoon()
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    ro.observe(document.body)
  }
})
onUnmounted(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('scroll', measure, true)
  rafs.forEach((id) => cancelAnimationFrame(id))
  ro?.disconnect()
})
watch(
  () => props.target,
  () => nextTick(remeasureSoon),
)

// Spotlight-hål (med padding), klampat i viewporten.
const hole = computed<Rect | null>(() => {
  const r = rect.value
  if (!r) return null
  const p = props.pad
  const x = Math.max(0, r.x - p)
  const y = Math.max(0, r.y - p)
  const w = Math.min(vw.value - x, r.w + p * 2)
  const h = Math.min(vh.value - y, r.h + p * 2)
  return { x, y, w, h }
})

// Bubbelplacering: väljs så att HELA bubblan ryms i viewporten (mäter dess
// höjd). Under målet om det får plats, annars ovanför, annars vertikalt klampad.
const MARGIN = 16
const BUBBLE_W = 360
const GAP = 14
const bubbleStyle = computed(() => {
  const h = hole.value
  if (!h || props.placement === 'center') {
    return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  }
  const centerX = h.x + h.w / 2
  let left = centerX - BUBBLE_W / 2
  left = Math.max(MARGIN, Math.min(left, vw.value - BUBBLE_W - MARGIN))

  const bh = bubbleH.value
  const belowTop = h.y + h.h + GAP
  const aboveTop = h.y - GAP - bh
  let top: number
  if (props.placement === 'bottom') top = belowTop
  else if (props.placement === 'top') top = aboveTop
  else if (belowTop + bh <= vh.value - MARGIN) top = belowTop
  else if (aboveTop >= MARGIN) top = aboveTop
  else top = (vh.value - bh) / 2
  // Håll alltid hela bubblan inom skärmen.
  top = Math.max(MARGIN, Math.min(top, vh.value - bh - MARGIN))
  return { left: `${left}px`, top: `${top}px` }
})

const holeStyle = computed(() => {
  const h = hole.value
  if (!h) return {}
  return {
    left: `${h.x}px`,
    top: `${h.y}px`,
    width: `${h.w}px`,
    height: `${h.h}px`,
  }
})

function advance() {
  emit('next')
}
</script>

<template>
  <div class="cm" @click="advance">
    <!-- Dim: helskärm när inget mål, annars bärs dimman av hålets box-shadow. -->
    <div v-if="!hole" class="cm__dim" />

    <!-- Spotlight-hål: glödande ram + stor box-shadow som dimmar allt runtom. -->
    <div v-else class="cm__hole" :style="holeStyle" />

    <!-- Bubbla (fångar klick själv, men klick utanför/på knappen går vidare). -->
    <div ref="bubbleRef" class="cm__bubble" :style="bubbleStyle" @click.stop>
      <p v-if="title" class="cm__title">{{ title }}</p>
      <p v-if="body" class="cm__body">{{ body }}</p>

      <!-- Liten animation som illustrerar begreppet (återanvänder intro-
           animationsvokabulären: stämpel, pengar→poäng, ×2). -->
      <div v-if="$slots.visual" class="cm__visual"><slot name="visual" /></div>

      <!-- Förstärknings-ruta (valfri): roll-ikon-slot + kort uppdragstext. -->
      <div v-if="$slots.reinforce || reinforce" class="cm__reinforce">
        <span class="cm__reinforce-icon"><slot name="reinforce" /></span>
        <span v-if="reinforce" class="cm__reinforce-text">{{ reinforce }}</span>
      </div>

      <slot />

      <button class="crt-button crt-button--strong cm__btn" @click="advance">
        {{ cta ?? t('onboarding.next') }} ▸
      </button>

      <div v-if="steps && steps > 1" class="cm__dots">
        <span
          v-for="n in steps"
          :key="n"
          class="cm__dot"
          :class="{ 'cm__dot--now': n - 1 === step }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cm {
  position: fixed;
  inset: 0;
  z-index: 45;
  cursor: pointer;
}
.cm__dim {
  position: absolute;
  inset: 0;
  background: rgba(3, 12, 8, 0.82);
}
.cm__hole {
  position: absolute;
  border-radius: 12px;
  border: 2px solid var(--color-primary);
  box-shadow:
    0 0 0 100vmax rgba(3, 12, 8, 0.82),
    0 0 22px rgba(var(--mode-accent-rgb), 0.7),
    inset 0 0 14px rgba(var(--mode-accent-rgb), 0.35);
  pointer-events: none;
  animation: cm-ring 1.6s ease-in-out infinite;
}
@keyframes cm-ring {
  0%, 100% { box-shadow: 0 0 0 100vmax rgba(3, 12, 8, 0.82), 0 0 16px rgba(var(--mode-accent-rgb), 0.5), inset 0 0 12px rgba(var(--mode-accent-rgb), 0.25); }
  50% { box-shadow: 0 0 0 100vmax rgba(3, 12, 8, 0.82), 0 0 30px rgba(var(--mode-accent-rgb), 0.85), inset 0 0 16px rgba(var(--mode-accent-rgb), 0.45); }
}
.cm__bubble {
  position: absolute;
  width: min(360px, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  text-align: center;
  padding: 1.2rem 1.4rem;
  border: 2px solid var(--color-primary);
  border-radius: 14px;
  background: var(--color-background-2);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.6), var(--frame-glow);
  cursor: default;
  animation: cm-in 0.3s ease-out;
}
@keyframes cm-in {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
}
.cm__title {
  margin: 0;
  font-family: var(--font-retro);
  font-size: 1.5rem;
  line-height: 1.25;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-soft);
}
.cm__body {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.4;
  color: var(--color-ink-muted);
}
.cm__visual {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 4.5rem;
}
.cm__reinforce {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  padding: 0.7rem 0.9rem;
  border: 1px dashed var(--color-primary);
  border-radius: 10px;
  background: rgba(var(--mode-accent-rgb), 0.08);
  text-align: left;
}
.cm__reinforce-icon {
  flex: none;
  display: inline-flex;
}
.cm__reinforce-text {
  font-family: var(--font-retro);
  font-size: 1.05rem;
  line-height: 1.3;
  color: var(--color-ink-strong);
}
.cm__btn {
  margin-top: 0.2rem;
  font-size: 1.15rem;
}
.cm__dots {
  display: flex;
  gap: 0.5rem;
}
.cm__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  border: 1px solid var(--color-primary-dim);
}
.cm__dot--now {
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: 0 0 8px var(--color-primary);
}
@media (prefers-reduced-motion: reduce) {
  .cm__hole { animation: none; }
  .cm__bubble { animation: none; }
}
</style>
