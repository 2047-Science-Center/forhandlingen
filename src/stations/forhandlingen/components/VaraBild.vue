<script setup lang="ts">
/**
 * En vara på marknaden som BILD (UTVARDERING-BILD-ANIMATION.md): ersätter emoji + ord.
 * Finns en genererad bild i public/varor/<id>.png används den; annars en ritad SVG i
 * stationens färger. Samma bild används i luckan, i livsviktig-kortet, i Klubban och i gissningen.
 */
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{ vara: string; size?: number }>(), { size: 160 })
const bildFel = ref(false)
watch(() => props.vara, () => (bildFel.value = false))
const src = (id: string) => `${import.meta.env.BASE_URL}varor/${id}.png`
</script>

<template>
  <span class="vb" :style="{ width: `${size}px`, height: `${size}px` }">
    <img v-if="!bildFel" :src="src(vara)" :alt="vara" class="vb__img" @error="bildFel = true" />
    <svg v-else viewBox="0 0 200 200" class="vb__svg" aria-hidden="true">
      <!-- Insulin: penna i liten kylväska -->
      <g v-if="vara === 'insulin'">
        <rect x="22" y="92" width="156" height="86" rx="14" fill="#e9f3f1" stroke="#7fb8ae" stroke-width="5" />
        <rect x="22" y="92" width="156" height="22" rx="10" fill="#35e0d0" />
        <g transform="rotate(-18 104 69)">
          <rect x="40" y="56" width="128" height="26" rx="13" fill="#f5f5f0" stroke="#9aa" stroke-width="3" />
          <rect x="132" y="56" width="34" height="26" rx="8" fill="#ff9500" />
          <rect x="70" y="62" width="40" height="14" rx="4" fill="#8fd3ff" opacity="0.7" />
        </g>
        <path d="M86 150 h28 M100 136 v28" stroke="#ff5a3c" stroke-width="9" stroke-linecap="round" />
      </g>
      <!-- Bränslecell: kraftig behållare med laddfönster och kabel -->
      <g v-else-if="vara === 'branslecell'">
        <rect x="58" y="34" width="84" height="18" rx="6" fill="#5d6b66" />
        <rect x="48" y="48" width="104" height="128" rx="16" fill="#3e5a55" stroke="#8fb3ab" stroke-width="5" />
        <rect x="68" y="70" width="64" height="70" rx="8" fill="#0c2a1a" />
        <rect x="74" y="104" width="52" height="30" rx="5" fill="#7ad14f" />
        <rect x="74" y="88" width="52" height="12" rx="4" fill="#7ad14f" opacity="0.45" />
        <path d="M150 150 C 182 150, 182 186, 150 186" fill="none" stroke="#ff9500" stroke-width="8" stroke-linecap="round" />
      </g>
      <!-- Styrkort: kretskort med chip, lysdioder och kontaktkant -->
      <g v-else-if="vara === 'styrkort'">
        <rect x="24" y="44" width="152" height="112" rx="10" fill="#1f6b4a" stroke="#7ad1a0" stroke-width="4" />
        <rect x="58" y="70" width="52" height="52" rx="4" fill="#1b1f1d" />
        <rect x="124" y="70" width="32" height="22" rx="3" fill="#1b1f1d" />
        <circle cx="132" cy="112" r="6" fill="#ff9500" /><circle cx="150" cy="112" r="6" fill="#ff9500" opacity="0.5" />
        <path d="M40 60 H58 M110 96 H124 M84 122 V140" stroke="#c9b26b" stroke-width="3" />
        <g fill="#e0c060"><rect v-for="i in 8" :key="i" :x="34 + i * 15" y="156" width="8" height="16" rx="1" /></g>
        <path d="M150 48 l16 10 l-10 10 z" fill="#2b2b2b" opacity="0.6" />
      </g>
      <!-- Radiosändare: låda med antenn, ratt och högtalargaller -->
      <g v-else-if="vara === 'radiosandare'">
        <path d="M132 64 L156 18" stroke="#9fb2c0" stroke-width="6" stroke-linecap="round" />
        <circle cx="156" cy="18" r="7" fill="#ff5a3c" />
        <rect x="28" y="64" width="144" height="104" rx="14" fill="#c9b994" stroke="#8a7a55" stroke-width="5" />
        <g fill="#5a4a2e"><circle v-for="i in 12" :key="i" :cx="52 + ((i - 1) % 4) * 16" :cy="94 + Math.floor((i - 1) / 4) * 16" r="4" /></g>
        <circle cx="136" cy="104" r="20" fill="#3a3326" /><path d="M136 104 L148 94" stroke="#ff9500" stroke-width="5" stroke-linecap="round" />
        <rect x="118" y="138" width="38" height="10" rx="4" fill="#7ad14f" />
      </g>
      <!-- Membranfilter: veckad filterpatron med droppe -->
      <g v-else-if="vara === 'membranfilter'">
        <rect x="60" y="40" width="80" height="20" rx="8" fill="#9fb2c0" />
        <rect x="60" y="150" width="80" height="20" rx="8" fill="#9fb2c0" />
        <rect x="66" y="58" width="68" height="94" fill="#e9f3f1" />
        <path v-for="i in 7" :key="i" :d="`M${68 + i * 9} 60 V150`" stroke="#a8c8d8" stroke-width="3" />
        <path d="M100 14 C 92 28, 86 34, 86 42 a14 14 0 0 0 28 0 C 114 34, 108 28, 100 14 Z" fill="#4aa3ff" />
      </g>
      <g v-else><rect x="40" y="40" width="120" height="120" rx="16" fill="#3e5a55" /><text x="100" y="125" text-anchor="middle" font-size="70" fill="#9fb2c0">?</text></g>
    </svg>
  </span>
</template>

<style scoped>
.vb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.vb__img,
.vb__svg {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.45));
}
</style>
