<script setup lang="ts">
/**
 * En sidas sändebud som figur i sidfärgen (A varmvitt, B magenta — samma som underglow och
 * entréns 3D-bild), valfritt med headset och ljudvågor. Vågorna är bara stämning: appen vet
 * inte vem som pratar (buden ges muntligt och låses först i Klubban).
 */
withDefaults(defineProps<{ sida: 'A' | 'B'; size?: number; headset?: boolean; pratar?: boolean; dimmad?: boolean }>(), {
  size: 120,
  headset: true,
  pratar: false,
  dimmad: false,
})
const FARG = { A: '#fff1d6', B: '#ff3cc8' } as const
</script>

<template>
  <span class="sf" :class="[`sf--${sida}`, { 'sf--pratar': pratar, 'sf--dimmad': dimmad }]" :style="{ width: `${size * 0.72}px`, height: `${size}px` }">
    <svg viewBox="0 0 150 210" aria-hidden="true">
      <circle cx="75" cy="48" r="34" :fill="FARG[sida]" />
      <path d="M33 210 V130 Q33 92 75 92 Q117 92 117 130 V210 Z" :fill="FARG[sida]" />
      <g v-if="headset">
        <path d="M38 48 A37 37 0 0 1 112 48" fill="none" stroke="#1d1d1d" stroke-width="8" />
        <rect x="30" y="40" width="14" height="26" rx="5" fill="#1d1d1d" />
        <rect x="106" y="40" width="14" height="26" rx="5" fill="#1d1d1d" />
        <path :d="sida === 'A' ? 'M112 62 Q118 84 96 84' : 'M38 62 Q32 84 54 84'" fill="none" stroke="#1d1d1d" stroke-width="5" />
      </g>
    </svg>
    <span v-if="pratar" class="sf__vagor" aria-hidden="true"><i /><i /><i /></span>
  </span>
</template>

<style scoped>
.sf {
  position: relative;
  display: inline-block;
  flex: none;
}
.sf svg {
  width: 100%;
  height: 100%;
  display: block;
}
.sf--dimmad {
  opacity: 0.35;
}
.sf__vagor {
  position: absolute;
  top: 14%;
  display: flex;
  gap: 6px;
  align-items: center;
}
.sf--A .sf__vagor { left: 100%; }
.sf--B .sf__vagor { right: 100%; flex-direction: row-reverse; }
.sf__vagor i {
  width: 8px;
  border-radius: 4px;
  background: currentColor;
  animation: sf-vag 0.9s ease-in-out infinite;
}
.sf--A .sf__vagor { color: #fff1d6; }
.sf--B .sf__vagor { color: #ff3cc8; }
.sf__vagor i:nth-child(1) { height: 18px; animation-delay: 0s; }
.sf__vagor i:nth-child(2) { height: 30px; animation-delay: 0.15s; }
.sf__vagor i:nth-child(3) { height: 18px; animation-delay: 0.3s; }
@keyframes sf-vag {
  0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
  50% { transform: scaleY(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .sf__vagor i { animation: none; }
}
</style>
