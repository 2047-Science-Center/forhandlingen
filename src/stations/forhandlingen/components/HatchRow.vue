<script setup lang="ts">
/**
 * Minimal progress-indikator: en liten prick per lucka som visar HUR MÅNGA som
 * återstår — ingen mockup av vilka resurser som är kvar (de är hemliga).
 *   avgjord (won/nobuy) = fylld · aktuell = glödande · kommande = tom.
 */
import type { HatchCell } from '../store/gameStore'

defineProps<{ cells: HatchCell[] }>()
</script>

<template>
  <div class="pips" role="list" aria-label="Kvarvarande luckor">
    <span
      v-for="cell in cells"
      :key="cell.hatch"
      class="pip"
      :class="`pip--${cell.kind === 'won' || cell.kind === 'nobuy' ? 'done' : cell.kind}`"
      role="listitem"
    />
  </div>
</template>

<style scoped>
.pips {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
  align-items: center;
}
.pip {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
  border: 1px solid var(--color-primary-dim);
  background: transparent;
}
.pip--done {
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: var(--glow-soft);
}
.pip--upcoming {
  background: transparent;
  opacity: 0.5;
}
.pip--active,
.pip--getready {
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: 0 0 10px var(--color-primary);
  animation: pip-pulse 1.2s ease-in-out infinite;
}
@keyframes pip-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.35);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pip--active,
  .pip--getready {
    animation: none;
  }
}
</style>
