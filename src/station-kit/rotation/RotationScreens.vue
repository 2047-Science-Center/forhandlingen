<script setup lang="ts">
/**
 * Rotationens skärmar (Lager A — IDENTISK i alla X&Y-stationer).
 * Fullskärms-overlay över appen när stationen INTE kör en grupp:
 *   waiting — väntar på regi (manuellt gruppval efter en stund)
 *   group   — INGEN overlay: entréns attract (station-kit/entre) visar "Testgrupp X —
 *             tryck för att börja" + sidindelningen och anropar begin().
 *   lek     — lila lek-läge efter skarpt; stationens lek läggs i slot "lek"
 * I 'running'/'off' renderas ingenting — appen syns som vanligt.
 */
import { ref, computed, watch } from 'vue'
import { useRotation } from './rotation'

withDefaults(
  defineProps<{
    /** Stationens namn (visas överst). */
    stationTitle?: string
    /** Antal testgrupper i det manuella valet. */
    groupCount?: number
  }>(),
  { stationTitle: '', groupCount: 4 },
)

const rot = useRotation()
const s = rot.state

const picking = ref(false)
watch(
  () => s.phase,
  () => {
    picking.value = false
  },
)
const visible = computed(() => s.phase === 'waiting' || s.phase === 'lek')
const showPicker = computed(() => picking.value || (s.phase === 'waiting' && s.showManual))

function pick(g: number): void {
  rot.pickManual(g)
  picking.value = false
}
</script>

<template>
  <div v-if="visible" class="rot" :class="`rot--${s.phase}`">
    <!-- VÄNTAR på regi -->
    <div v-if="s.phase === 'waiting'" class="rot__stage">
      <p v-if="stationTitle" class="rot__eyebrow">{{ stationTitle }}</p>
      <h1 class="rot__title">Väntar på nästa grupp</h1>
      <p class="rot__sub">
        {{ s.connected ? 'Regin har inte skickat någon grupp ännu.' : 'Ingen kontakt med regin.' }}
      </p>
    </div>

    <!-- LEK (lila) -->
    <div v-else class="rot__lek">
      <header class="rot__lek-head">
        <span class="rot__lek-tag">LEK</span>
        <span>Testgrupp {{ s.group }} — bra jobbat, ni är klara med stationen!</span>
      </header>
      <div class="rot__lek-slot">
        <slot name="lek">
          <div class="rot__lek-ph">
            <span class="rot__lek-ph-tag">[STATIONENS LEK — platshållare]</span>
            <span>Förslag: xy-arkitektur/XY-VANTUPPGIFTER.md</span>
          </div>
        </slot>
      </div>
      <footer class="rot__lek-foot">Stanna kvar — bytet startar när alla grupper är klara.</footer>
    </div>

    <!-- Manuellt gruppval (fallback) — diskret knapp + väljare -->
    <button class="rot__manual-btn" @click.stop="picking = !picking">Grupp ▾</button>
    <div v-if="showPicker" class="rot__picker" @click.stop>
      <p class="rot__picker-title">Manuellt gruppval</p>
      <div class="rot__picker-row">
        <button v-for="g in groupCount" :key="g" class="rot__picker-btn" @click="pick(g)">
          Testgrupp {{ g }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rot {
  --rot-accent: var(--mode-tutorial, #7cc8ff);
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  flex-direction: column;
  padding: clamp(0.8rem, 3vh, 2rem);
  background: var(--color-background, #05080a);
  color: var(--color-ink-strong, #e8f4ff);
  font-family: var(--font-retro, monospace);
}
.rot--lek {
  --rot-accent: #b48cff;
  background: radial-gradient(ellipse at center, #1c1030 0%, #0a0612 75%);
}
.rot__stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  text-align: center;
}
.rot__eyebrow {
  margin: 0;
  font-size: 1.2rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-ink-muted, #8aa);
}
.rot__title {
  margin: 0;
  font-size: clamp(3rem, 10vw, 7rem);
  letter-spacing: 0.06em;
  color: var(--rot-accent);
  text-shadow: 0 0 24px var(--rot-accent);
}
.rot__sub {
  margin: 0;
  font-size: 1.2rem;
  color: var(--color-ink-muted, #8aa);
}
.rot__members {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem 1.4rem;
  font-size: 1.5rem;
  max-width: 50rem;
}
.rot__cta {
  margin: 1rem 0 0;
  font-size: 1.8rem;
  color: var(--rot-accent);
  animation: rot-pulse 1.6s ease-in-out infinite;
}
@keyframes rot-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

/* --- lek --- */
.rot__lek {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.rot__lek-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  font-size: 1.3rem;
  color: var(--rot-accent);
  flex-wrap: wrap;
  text-align: center;
}
.rot__lek-tag {
  padding: 0.15em 0.8em;
  border: 2px solid var(--rot-accent);
  border-radius: 999px;
  letter-spacing: 0.2em;
  box-shadow: 0 0 16px rgba(180, 140, 255, 0.45);
}
.rot__lek-slot {
  flex: 1;
  min-height: 0;
  display: flex;
}
.rot__lek-slot > * {
  flex: 1;
  min-width: 0;
}
.rot__lek-ph {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  border: 2px dashed var(--rot-accent);
  border-radius: 14px;
  color: var(--rot-accent);
  font-family: var(--font-mono, monospace);
  text-align: center;
  padding: 1rem;
}
.rot__lek-ph-tag {
  font-size: 1.4rem;
  letter-spacing: 0.08em;
}
.rot__lek-foot {
  text-align: center;
  font-size: 1.1rem;
  color: var(--color-ink-muted, #a9a);
}

/* --- manuellt val --- */
.rot__manual-btn {
  position: absolute;
  right: 0.8rem;
  bottom: 0.8rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.85rem;
  color: var(--color-ink-muted, #8aa);
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 6px;
  padding: 0.25em 0.7em;
  opacity: 0.5;
  cursor: pointer;
}
.rot__picker {
  position: absolute;
  left: 50%;
  bottom: 3.2rem;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 1.2rem;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid var(--rot-accent);
  border-radius: 12px;
}
.rot__picker-title {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.1em;
  color: var(--color-ink-muted, #8aa);
}
.rot__picker-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
}
.rot__picker-btn {
  font-family: var(--font-retro, monospace);
  font-size: 1.2rem;
  padding: 0.5em 1em;
  color: var(--rot-accent);
  background: transparent;
  border: 2px solid var(--rot-accent);
  border-radius: 10px;
  cursor: pointer;
}
@media (prefers-reduced-motion: reduce) {
  .rot__cta { animation: none; }
}
</style>
