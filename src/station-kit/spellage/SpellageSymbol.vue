<script setup lang="ts">
/**
 * Spellägets symbol (xy-produktion/spellage/symboler): samma fem delar i alla lägen —
 * halvorna i sidfärgerna (A varmvitt, B magenta), vägg, ring och VALdis lampor.
 * Används statiskt på Ankomst (①) och i nedräkningen före skarpt (④).
 */
import type { Lage } from './spellage'

withDefaults(defineProps<{ lage: Lage; size?: number }>(), { size: 120 })
const PRICKAR = Array.from({ length: 12 }, (_, k) => [165 * Math.cos(k * 0.5236), 165 * Math.sin(k * 0.5236)])
</script>

<template>
  <svg class="ss" viewBox="-260 -190 520 380" :width="size" :height="(size * 380) / 520" aria-hidden="true">
    <template v-if="lage === 'tavling'">
      <path d="M-85,-120 A120,120 0 0,0 -85,120 Z" fill="#fff1d6" />
      <path d="M85,-120 A120,120 0 0,1 85,120 Z" fill="#ff3cc8" />
      <rect x="-8" y="-170" width="16" height="340" fill="#9fb2c0" />
    </template>
    <template v-else-if="lage === 'samarbete'">
      <circle cx="0" cy="0" r="160" fill="none" stroke="#ff9500" stroke-width="12" />
      <path d="M0,-120 A120,120 0 0,0 0,120 Z" fill="#fff1d6" />
      <path d="M0,-120 A120,120 0 0,1 0,120 Z" fill="#ff3cc8" />
    </template>
    <template v-else>
      <circle v-for="([x, y], i) in PRICKAR" :key="i" :cx="x" :cy="y" r="12" fill="#ff9500" />
      <circle cx="0" cy="0" r="28" fill="#f3ead8" />
    </template>
  </svg>
</template>

<style scoped>
.ss {
  display: block;
  overflow: visible;
}
</style>
