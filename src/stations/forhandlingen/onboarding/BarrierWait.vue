<script setup lang="ts">
/**
 * "Väntar på sida B …" mellan skärmarna, med synlig nedräkning: efter VANTA_MAX_SEKUNDER
 * går stationen vidare ändå (förslag 6), så en tyst sida aldrig låser stationen.
 * `sekunder` = kvar till auto-vidare (null = ingen nedräkning visas).
 */
import { useI18n } from '@/station-kit/i18n'
defineProps<{ sida: string; sekunder: number | null }>()
const { t } = useI18n()
</script>

<template>
  <div class="bw">
    <span class="bw__dot" aria-hidden="true"></span>
    <span class="bw__text">{{ t('vanta.andra', { sida }) }}</span>
    <span v-if="sekunder != null" class="bw__tid">{{ t('vanta.vidare_om', { n: sekunder }) }}</span>
  </div>
</template>

<style scoped>
.bw {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}
.bw__dot {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 14px var(--color-primary);
  animation: bw-throb 1s ease-in-out infinite;
}
.bw__text {
  font-family: var(--font-retro);
  font-size: 1.8rem;
  color: var(--color-ink-strong);
  text-align: center;
}
.bw__tid {
  font-family: var(--font-retro);
  font-size: 1.2rem;
  color: var(--color-ink-muted);
}
@keyframes bw-throb {
  0%, 100% { transform: scale(0.7); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .bw__dot { animation: none; }
}
</style>
