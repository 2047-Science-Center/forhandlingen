<script setup lang="ts">
/**
 * Lek-läget — gemensam panel (Lager A, IDENTISK i alla X&Y-stationer).
 * Lila ram med titel + EN kort instruktionsrad + innehåll. Används inuti
 * RotationScreens' slot "lek" (rotationen) eller LekStandalone (?lek=1 / utan rotation).
 * Lek-knappar: klassen `lek-btn` (+ `lek-btn--big`, `lek-btn--ghost`) — global (nedan).
 */
defineProps<{
  /** Lekens namn. */
  title: string
  /** En kort rad (≤ ~12 ord): vad man gör just nu. */
  hint?: string
}>()
</script>

<template>
  <section class="lekp">
    <header class="lekp__head">
      <h2 class="lekp__title">{{ title }}</h2>
      <p v-if="hint" class="lekp__hint">{{ hint }}</p>
    </header>
    <div class="lekp__body"><slot /></div>
    <footer v-if="$slots.foot" class="lekp__foot"><slot name="foot" /></footer>
  </section>
</template>

<style scoped>
.lekp {
  --lek: #b48cff;
  --lek-soft: rgba(180, 140, 255, 0.16);
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(0.5rem, 1.6vh, 1rem);
  padding: clamp(0.6rem, 2vh, 1.4rem);
  border: 2px solid var(--lek);
  border-radius: 16px;
  background: rgba(20, 10, 36, 0.55);
  box-shadow: 0 0 28px rgba(180, 140, 255, 0.25) inset;
  color: var(--color-ink-strong, #f1eaff);
}
.lekp__head {
  text-align: center;
}
.lekp__title {
  margin: 0;
  font-family: var(--font-retro, monospace);
  font-size: clamp(2rem, 5.5vw, 3.6rem);
  letter-spacing: 0.08em;
  color: var(--lek);
  text-shadow: 0 0 18px rgba(180, 140, 255, 0.7);
}
.lekp__hint {
  margin: 0.3rem 0 0;
  font-size: clamp(1.1rem, 2.4vw, 1.6rem);
  color: var(--color-ink-strong, #f1eaff);
}
.lekp__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 1rem;
}
.lekp__foot {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 1.05rem;
  color: var(--color-ink-muted, #b9a8d8);
}
</style>

<style>
/* Lek-knappar (globala så stationernas lek-komponenter delar dem). */
.lek-btn {
  font-family: var(--font-retro, monospace);
  font-size: clamp(1.2rem, 2.6vw, 1.8rem);
  letter-spacing: 0.06em;
  padding: 0.55em 1.2em;
  color: #f4ecff;
  background: rgba(180, 140, 255, 0.22);
  border: 2px solid #b48cff;
  border-radius: 12px;
  cursor: pointer;
  touch-action: manipulation;
  transition: transform 0.08s ease, background 0.15s ease;
}
.lek-btn:active {
  transform: scale(0.97);
  background: rgba(180, 140, 255, 0.4);
}
.lek-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.lek-btn--big {
  font-size: clamp(1.6rem, 3.6vw, 2.6rem);
  padding: 0.7em 1.6em;
}
.lek-btn--ghost {
  background: transparent;
}
.lek-btn--on {
  background: #b48cff;
  color: #1a0f2c;
}
</style>
