<script setup lang="ts">
/**
 * Läges-legend (station-kit, återanvändbar): visar BLÅTT bredvid SKARPT så
 * besökaren lär sig signalen innan spelet börjar — "när det är blått övar vi,
 * när det blir skarpt kör vi på riktigt". Swatcharna använder de fasta
 * --mode-tutorial / --mode-live-tokenen (inte --color-primary) så jämförelsen
 * stämmer oavsett vilket läge UI:t råkar vara i just nu.
 */
import { useI18n } from '../i18n'

const { t } = useI18n()
</script>

<template>
  <div class="ml" role="note">
    <div class="ml__row">
      <span class="ml__swatch ml__swatch--tut" aria-hidden="true"></span>
      <span class="ml__text">{{ t('mode.legend_tutorial') }}</span>
    </div>
    <div class="ml__row">
      <span class="ml__swatch ml__swatch--live" aria-hidden="true"></span>
      <span class="ml__text">{{ t('mode.legend_live') }}</span>
    </div>
  </div>
</template>

<style scoped>
.ml {
  display: flex;
  gap: 1.6rem;
  flex-wrap: wrap;
  justify-content: center;
  padding: 0.9rem 1.3rem;
  border: 1px solid var(--color-primary-dim);
  border-radius: 12px;
  background: var(--color-background-2);
}
.ml__row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.ml__swatch {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 5px;
  flex: none;
}
.ml__swatch--tut {
  background: var(--mode-tutorial);
  box-shadow: 0 0 12px rgba(var(--mode-tutorial-rgb), 0.7);
}
.ml__swatch--live {
  background: var(--mode-live);
  box-shadow: 0 0 12px rgba(var(--mode-live-rgb), 0.7);
}
.ml__text {
  font-family: var(--font-retro);
  font-size: 1.15rem;
  letter-spacing: 0.03em;
  color: var(--color-ink-strong);
}
</style>
