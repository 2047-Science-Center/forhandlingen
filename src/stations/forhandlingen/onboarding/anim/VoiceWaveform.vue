<script setup lang="ts">
/**
 * A2 — röst-förvrängning (MOCKUP). Headsetet är inte kopplat till appen, så
 * detta är enbart en animation: en waveform som "skramlas" (maskeras) medan man
 * håller inne & talar. INGEN riktig mikrofon. Efter ~2 s hållande → emit('voiced').
 * Reduced-motion: statisk waveform, klar direkt.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from '@/station-kit/i18n'

const emit = defineEmits<{ voiced: [] }>()
const { t } = useI18n()

const canvas = ref<HTMLCanvasElement | null>(null)
const talking = ref(false)
const doneOnce = ref(false)
const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

let raf = 0
let stopAt = 0

/** Tryck (eller håll) → talar i ~1,8 s → voiced. En tap räcker (mockup). */
function talk() {
  if (doneOnce.value) return
  talking.value = true
  stopAt = performance.now() + 1800
}

function draw(now: number) {
  raf = requestAnimationFrame(draw)
  if (talking.value && now >= stopAt) {
    talking.value = false
    if (!doneOnce.value) {
      doneOnce.value = true
      emit('voiced')
    }
  }
  const c = canvas.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const w = (c.width = c.clientWidth)
  const h = (c.height = c.clientHeight)
  ctx.clearRect(0, 0, w, h)

  const on = talking.value
  const amp = on ? 0.55 + Math.random() * 0.45 : 0.12
  // Maskerad waveform: segmenterade staplar med slumpad jitter (förvrängd).
  const bars = 48
  const bw = w / bars
  ctx.fillStyle = on ? '#ff9500' : '#b8690f'
  for (let i = 0; i < bars; i++) {
    const base = Math.sin((i / bars) * Math.PI * 6 + now / 120)
    const scramble = on ? (Math.random() - 0.5) * 2 : 0.2
    const bh = Math.max(2, (Math.abs(base) * 0.4 + Math.abs(scramble) * amp) * h * 0.9)
    ctx.fillRect(i * bw + 1, (h - bh) / 2, bw - 2, bh)
  }
}

onMounted(() => {
  if (reduced) {
    emit('voiced')
    return
  }
  raf = requestAnimationFrame(draw)
})
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="vw">
    <p class="vw__prompt">{{ t('onboarding.headset.prompt') }}</p>
    <canvas ref="canvas" class="vw__canvas amber-frame"></canvas>
    <p v-if="talking" class="vw__masking crt-caret">{{ t('onboarding.headset.masking') }}</p>
    <p v-else-if="doneOnce" class="vw__masking">{{ t('onboarding.headset.masked_done') }}</p>
    <button class="crt-button vw__talk" @pointerdown="talk" @click="talk">
      🎙 {{ t('onboarding.headset.talk') }}
    </button>
  </div>
</template>

<style scoped>
.vw {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
}
.vw__prompt {
  margin: 0;
  font-size: 1.4rem;
  color: var(--color-ink-strong);
}
.vw__canvas {
  width: min(32rem, 90%);
  height: 8rem;
  display: block;
}
.vw__masking {
  margin: 0;
  color: var(--color-primary);
}
.vw__talk {
  font-size: 1.2rem;
  user-select: none;
  touch-action: none;
}
</style>
