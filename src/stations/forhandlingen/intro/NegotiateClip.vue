<script setup lang="ts">
/**
 * Steg 7 — "Så här kan en förhandling se ut". Spelar KLIPP #2: förhandlingsdemon
 * som studsar mellan valven (NegotiateDemo/Alma), med settle-UI:t under som
 * speglar de riktiga klicken (vinnare → slutpris → bekräfta), precis som förr.
 *
 * Till skillnad från det gamla introt drivs klippet på en EGEN klocka
 * (requestAnimationFrame) utan narrations-ljudblock — de fyra ljudblocken är
 * borttagna. Klockan tajmar talarmarkeringen + settle-animationen mot manuset
 * (negotiateScripts). Reduced-motion: hoppa direkt till slutframen.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { INTRO_MEDIA } from '@/config'
import { useI18n } from '@/station-kit/i18n'
import { NEGOTIATE_SCRIPTS } from './negotiateScripts'
import NegotiateDemo from './NegotiateDemo.vue'

const emit = defineEmits<{ next: [] }>()
const { t } = useI18n()

// KLIPP #2 (Alma / sida A vinner). Byt här för att välja ett annat manus.
const CLIP = 'B1'
const script = NEGOTIATE_SCRIPTS[CLIP]
// Klippets längd = sista manushändelsen + lite svans.
const DURATION = script.settle.confirmAt + 1.4

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const elapsed = ref(reduceMotion ? DURATION : 0)
let raf = 0
let t0 = 0
function tick(now: number) {
  elapsed.value = Math.min(DURATION, (now - t0) / 1000)
  if (elapsed.value < DURATION) raf = requestAnimationFrame(tick)
}
onMounted(() => {
  if (reduceMotion) return
  t0 = performance.now()
  raf = requestAnimationFrame(tick)
})
onUnmounted(() => cancelAnimationFrame(raf))

const photoUrl = INTRO_MEDIA.photo
const done = computed(() => elapsed.value >= DURATION - 0.05)
</script>

<template>
  <div class="nc">
    <div class="nc__head">
      <h2 class="nc__title">{{ t('clip.title') }}</h2>
      <p class="nc__sub">{{ t('clip.sub') }}</p>
    </div>

    <div class="nc__stage">
      <NegotiateDemo :illustration="CLIP" :elapsed="elapsed" :photo-url="photoUrl" />
    </div>

    <button class="crt-button crt-button--strong nc__btn" :class="{ 'nc__btn--ready': done }" @click="emit('next')">
      {{ t('clip.continue') }} ▸
    </button>
  </div>
</template>

<style scoped>
.nc {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.4rem;
}
.nc__head {
  flex: none;
  text-align: center;
}
.nc__title {
  font-family: var(--font-retro);
  font-size: clamp(1.5rem, 3.4vw, 2.2rem);
  letter-spacing: 0.08em;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-soft);
  margin: 0;
}
.nc__sub {
  margin: 0.2rem 0 0;
  font-size: 1.1rem;
  color: var(--color-ink-muted);
}
.nc__stage {
  flex: 1 1 auto;
  min-height: 0;
}
.nc__btn {
  flex: none;
  align-self: center;
  font-size: 1.2rem;
  padding: 0.4em 1.8em;
  opacity: 0.75;
  transition: opacity 0.3s ease, box-shadow 0.3s ease;
}
.nc__btn--ready {
  opacity: 1;
  box-shadow: var(--glow-strong);
}
@media (prefers-reduced-motion: reduce) {
  .nc__btn {
    opacity: 1;
    transition: none;
  }
}
</style>
