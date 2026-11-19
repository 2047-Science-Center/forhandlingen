<script setup lang="ts">
/**
 * Förhandsvisning av stationens ljus (?ljus=visa): en tunn remsa längst ner som ritar
 * segmenten i proportion till pixelintervallen, med samma tider som firmwaren
 * (blink 550/550, puls 2,6 s, chase 40 ms/px) och gesterna ovanpå. Ingen hårdvara krävs.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useLjus } from './stationLjus'

const ljus = useLjus()
const now = ref(Date.now())
let raf = 0
function tick() {
  now.value = Date.now()
  raf = requestAnimationFrame(tick)
}
onMounted(() => {
  if (ljus.state.visa) raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))

function scale(hex: string, k: number): string {
  const v = parseInt(hex.slice(1), 16)
  const r = Math.round(((v >> 16) & 255) * k)
  const g = Math.round(((v >> 8) & 255) * k)
  const b = Math.round((v & 255) * k)
  return `rgb(${r},${g},${b})`
}

const total = computed(() => Math.max(1, ...Object.values(ljus.state.segment).map(([, to]) => to + 1)))

const segs = computed(() => {
  const t = now.value
  return Object.entries(ljus.state.segment).map(([id, [from, to]]) => {
    const look = ljus.state.bas[id] ?? { color: '#000000', effekt: 'av' }
    let bg = '#000'
    if (look.effekt === 'static') bg = look.color
    else if (look.effekt === 'blink') bg = Math.floor(t / 550) % 2 === 0 ? look.color : scale(look.color, 0.12)
    else if (look.effekt === 'puls') bg = scale(look.color, (100 + 127 * (0.5 + 0.5 * Math.sin((t / 1300) * Math.PI))) / 255)
    else if (look.effekt === 'chase') {
      const n = to - from + 1
      const head = Math.floor(t / 40) % n
      const pct = (head / n) * 100
      bg = `linear-gradient(90deg, ${scale(look.color, 0.16)} ${pct}%, ${look.color} ${pct}%, ${look.color} ${pct + (4 / n) * 100}%, ${scale(look.color, 0.16)} ${pct + (4 / n) * 100}%)`
    }
    const fx = ljus.state.fx[id]
    if (fx) {
      const dt = t - fx.t0
      if (dt < fx.tempo * fx.antal && dt % fx.tempo < fx.tempo / 2) bg = fx.color
    }
    return { id, left: (from / total.value) * 100, width: ((to - from + 1) / total.value) * 100, bg }
  })
})
</script>

<template>
  <div v-if="ljus.state.visa" class="ljus-remsa" aria-hidden="true">
    <div
      v-for="s in segs"
      :key="s.id"
      class="ljus-remsa__seg"
      :style="{ left: s.left + '%', width: s.width + '%', background: s.bg }"
    >
      <span>{{ s.id }}</span>
    </div>
  </div>
</template>

<style scoped>
.ljus-remsa {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 14px;
  background: #000;
  z-index: 9999;
  pointer-events: none;
}
.ljus-remsa__seg {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid #000;
}
.ljus-remsa__seg span {
  font: 9px/14px monospace;
  color: rgba(255, 255, 255, 0.55);
  padding-left: 3px;
  mix-blend-mode: difference;
}
</style>
