<script setup lang="ts">
/**
 * Stationsintrot (Lager A — IDENTISK i alla X&Y-stationer): ett hype-klipp på ~5–6 s som sätter
 * gruppen i situationen, direkt efter "Ställ er på rätt sida" och före rollvalet.
 *
 * Fil: config.introClip = `<BASE_URL>media/stationsintro/<station>.mp4` (H.264 + AAC, 1920×1080, 25/30 fps).
 *   - spelas med ljud (gruppen har just tryckt → autoplay tillåts); stationens ljud av (audio.muted) → tyst.
 *     Blockeras ljudet ändå spelas klippet tyst.
 *   - ett tryck var som helst hoppar över det
 *   - fel / går inte att spela / hänger → vidare (aldrig ett svart stopp: säkerhetsspärr 15 s)
 * Entrén visar bara det här steget när filen finns (entre.ts sonderar med HEAD vid start).
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { audio } from '../audio/AudioEngine'
import { useHoppa } from '../kiosk/kioskSkip'

const props = defineProps<{ src: string }>()
const emit = defineEmits<{ done: [] }>()

const MAX_MS = 15000
const video = ref<HTMLVideoElement | null>(null)
let finished = false
let guard: ReturnType<typeof setTimeout> | null = null

function done(): void {
  if (finished) return
  finished = true
  if (guard) clearTimeout(guard)
  try {
    video.value?.pause()
  } catch {
    /* ignore */
  }
  emit('done')
}
useHoppa(() => done()) // hörngesten (kioskSkip) i stället för tryck-för-att-hoppa

onMounted(async () => {
  guard = setTimeout(done, MAX_MS)
  const v = video.value
  if (!v) return done()
  v.muted = audio.muted
  try {
    await v.play()
  } catch {
    // Ljud blockerat (eller inget gesture) → försök tyst; går inte det heller → vidare.
    try {
      v.muted = true
      await v.play()
    } catch {
      done()
    }
  }
})
onUnmounted(() => {
  if (guard) clearTimeout(guard)
})
</script>

<template>
  <div class="si">
    <video ref="video" class="si__video" :src="props.src" playsinline preload="auto" @ended="done" @error="done" />
  </div>
</template>

<style scoped>
.si {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  animation: si-in 0.35s ease-out;
}
.si__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.si__skip {
  position: absolute;
  right: 1rem;
  bottom: 0.8rem;
  padding: 0.25em 0.7em;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: var(--color-ink-muted, #bbb);
  font-size: 0.95rem;
  letter-spacing: 0.05em;
}
@keyframes si-in {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .si {
    animation: none;
  }
}
</style>
