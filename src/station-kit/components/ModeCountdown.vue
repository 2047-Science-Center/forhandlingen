<script setup lang="ts">
/**
 * Helskärms-nedräkning vid övergången tutorial → live (station-kit,
 * återanvändbar). Visar en rubrik ("NU KÖR VI PÅ RIKTIGT") och räknar sedan
 * ner i stora siffror innan skarpa rundan tar över. Emit('done') när klar.
 *
 * Självständig (egen klocka, ingen transport) — varje skärm kör sin egen
 * instans. Färgen ärvs från det aktiva läget (live = skarp färg).
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { audio } from '../audio/AudioEngine'

const props = withDefaults(
  defineProps<{
    title: string
    /** Startar på detta tal och räknar ner till 1. */
    from?: number
    /** Hur länge rubriken visas innan nedräkningen (ms). */
    leadMs?: number
    /** Ms per siffra. */
    stepMs?: number
  }>(),
  { from: 3, leadMs: 1100, stepMs: 900 },
)
const emit = defineEmits<{ done: [] }>()

/** null = rubrikfas; annars aktuell siffra. */
const count = ref<number | null>(null)
const timers: ReturnType<typeof setTimeout>[] = []

onMounted(() => {
  // Dramatiskt "nu blir det skarpt"-svep när overlayn dyker upp.
  audio.play('live')
  timers.push(
    setTimeout(() => {
      runCount(props.from)
    }, props.leadMs),
  )
})
onUnmounted(() => timers.forEach(clearTimeout))

function runCount(n: number) {
  if (n <= 0) {
    // Inget eget "go"-ljud här — live-svepet (ovan) bär övergången.
    emit('done')
    return
  }
  count.value = n
  audio.play('blip')
  timers.push(setTimeout(() => runCount(n - 1), props.stepMs))
}
</script>

<template>
  <div class="mc" role="status" aria-live="assertive">
    <div class="mc__backdrop" />
    <div class="mc__inner">
      <p class="mc__title ink-strong">{{ title }}</p>
      <div v-if="count != null" :key="count" class="mc__num mono">{{ count }}</div>
    </div>
  </div>
</template>

<style scoped>
.mc {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mc__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(3, 9, 6, 0.92);
}
.mc__inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;
}
.mc__title {
  font-family: var(--font-retro);
  font-size: clamp(2rem, 6vw, 4rem);
  letter-spacing: 0.12em;
  color: var(--color-primary);
  text-shadow: var(--glow-strong);
  margin: 0;
  animation: mc-title-in 0.6s ease-out both;
}
.mc__num {
  font-size: clamp(7rem, 24vw, 16rem);
  line-height: 1;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-strong);
  animation: mc-num 0.9s ease-out both;
}
@keyframes mc-title-in {
  from { opacity: 0; transform: scale(0.8); letter-spacing: 0.4em; }
  to { opacity: 1; transform: scale(1); letter-spacing: 0.12em; }
}
@keyframes mc-num {
  0% { opacity: 0; transform: scale(2.2); }
  25% { opacity: 1; transform: scale(1); }
  100% { opacity: 0.85; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .mc__title,
  .mc__num {
    animation: none;
  }
}
</style>
