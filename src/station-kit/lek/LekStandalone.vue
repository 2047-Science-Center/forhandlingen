<script setup lang="ts">
/**
 * Lek-läget utan rotationen (Lager A, IDENTISK i alla X&Y-stationer).
 * Fullskärms lila overlay med samma ram som RotationScreens' lek — för
 * förhandsvisning (`?lek=1`) och för stationer som ännu inte är inkopplade i
 * rotationen. Stationens lek läggs i default-sloten.
 */
withDefaults(defineProps<{ label?: string }>(), { label: 'Förhandsvisning — ?lek=1' })
</script>

<template>
  <div class="leks">
    <header class="leks__head">
      <span class="leks__tag">LEK</span>
      <span>{{ label }}</span>
    </header>
    <div class="leks__slot"><slot /></div>
  </div>
</template>

<style scoped>
.leks {
  position: fixed;
  inset: 0;
  z-index: 480;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(0.8rem, 3vh, 2rem);
  background: radial-gradient(ellipse at center, #1c1030 0%, #0a0612 75%);
  color: var(--color-ink-strong, #e8f4ff);
  font-family: var(--font-retro, monospace);
}
.leks__head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  font-size: 1.2rem;
  color: #b48cff;
  flex-wrap: wrap;
}
.leks__tag {
  padding: 0.15em 0.8em;
  border: 2px solid #b48cff;
  border-radius: 999px;
  letter-spacing: 0.2em;
}
.leks__slot {
  flex: 1;
  min-height: 0;
  display: flex;
}
.leks__slot > * {
  flex: 1;
  min-width: 0;
}
</style>
