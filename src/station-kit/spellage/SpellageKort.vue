<script setup lang="ts">
/**
 * Spellägeskortet i helskärm (station-kit/spellage). Förrenderad HyperFrames-film med VALdis röst.
 * Båda skärmarna startar på samma epoch (`startAt`) och följaren spolar in sig om den kommer sent.
 * Ljudet spelas bara från ledaren (en högtalare per station), som i entréns synkade sekvens.
 *
 * `done` när filmen är slut (eller direkt om filen saknas). Ett tryck hoppar över, men först när
 * rubriken har landat (FORSLAG F6: ~1 s efter bytet ≈ 4 s in).
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { audio } from '../audio/AudioEngine'
import { useHoppa } from '../kiosk/kioskSkip'

const props = withDefaults(defineProps<{ src: string; startAt: number; leader: boolean; skipAfterS?: number }>(), {
  skipAfterS: 4,
})
const emit = defineEmits<{ done: []; skip: [] }>()

const video = ref<HTMLVideoElement | null>(null)
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
let startTimer: ReturnType<typeof setTimeout> | null = null
let klar = false

function fardig() {
  if (klar) return
  klar = true
  emit('done')
}

async function spela() {
  const v = video.value
  if (!v) return
  v.muted = !props.leader || audio.muted
  const mal = (Date.now() - props.startAt) / 1000
  if (mal > 0.2 && Number.isFinite(v.duration) && mal < v.duration) v.currentTime = mal
  try {
    await v.play()
  } catch {
    // Autoplay med ljud nekad (borde inte hända efter entrén) → spela tyst hellre än att stå still.
    v.muted = true
    await v.play().catch(() => fardig())
  }
}

onMounted(() => {
  tick = setInterval(() => (now.value = Date.now()), 200)
  const vanta = Math.max(0, props.startAt - Date.now())
  startTimer = setTimeout(spela, vanta)
})
onUnmounted(() => {
  if (tick) clearInterval(tick)
  if (startTimer) clearTimeout(startTimer)
})

// Hörngesten (kioskSkip) hoppar över kortet — inget tryck-för-att-gå-vidare på skärmen (Josef 2026-11-26).
useHoppa(() => emit('skip'))
</script>

<template>
  <div class="sk">
    <video ref="video" class="sk__film" :src="src" playsinline preload="auto" @ended="fardig" @error="fardig" />
  </div>
</template>

<style scoped>
.sk {
  position: absolute;
  inset: 0;
  background: #05100b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  border-radius: inherit;
}
.sk__film {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.sk__hoppa {
  position: absolute;
  right: 1.2rem;
  bottom: 1rem;
  font-family: var(--font-retro);
  font-size: 1rem;
  color: var(--color-ink-muted);
  opacity: 0.7;
}
</style>
