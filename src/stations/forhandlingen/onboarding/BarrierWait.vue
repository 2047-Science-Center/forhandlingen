<script setup lang="ts">
/**
 * Väntan på andra sidan som BILD: den sidans figur andas i sin färg, och en ring räknar ner
 * till auto-vidare (VANTA_MAX_SEKUNDER, förslag 6) så en tyst sida aldrig låser stationen.
 */
import { computed } from 'vue'
import { VANTA_MAX_SEKUNDER } from '@/config'
import SidFigur from '../components/SidFigur.vue'

const props = defineProps<{ sida: string; sekunder: number | null }>()
const RING = 2 * Math.PI * 92
const andel = computed(() => (props.sekunder == null ? 1 : props.sekunder / VANTA_MAX_SEKUNDER))
const figurSida = computed<'A' | 'B'>(() => (props.sida === 'B' ? 'B' : 'A'))
</script>

<template>
  <div class="bw" role="status" :aria-label="`Väntar på sida ${sida}`">
    <div class="bw__mitt">
      <svg class="bw__ring" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" />
        <circle cx="100" cy="100" r="92" fill="none" stroke="var(--color-primary)" stroke-width="8" stroke-linecap="round"
          :stroke-dasharray="RING" :stroke-dashoffset="RING * (1 - andel)" transform="rotate(-90 100 100)" class="bw__ringfg" />
      </svg>
      <SidFigur :sida="figurSida" :size="120" :headset="false" class="bw__figur" />
    </div>
    <span class="bw__sida">{{ sida }} …</span>
    <span v-if="sekunder != null" class="bw__tid mono">{{ sekunder }}</span>
  </div>
</template>

<style scoped>
.bw {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
}
.bw__mitt {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bw__ring {
  position: absolute;
  inset: 0;
}
.bw__ringfg {
  transition: stroke-dashoffset 260ms linear;
}
.bw__figur {
  animation: bw-andas 1.8s ease-in-out infinite;
}
.bw__sida {
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2.4rem;
  color: var(--color-ink-strong);
}
.bw__tid {
  font-size: 1.2rem;
  color: var(--color-ink-muted);
}
@keyframes bw-andas {
  0%, 100% { opacity: 0.45; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .bw__figur { animation: none; }
}
</style>
