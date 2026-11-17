<script setup lang="ts">
/**
 * Intro-3D-skärmen: det RIKTIGA konsol-UI:t (ReporterConsole i sitt lugna
 * demo-läge, skarpa rundans värden: 100 kr, 5 luckor, set-1:s livsviktiga)
 * som 3D-scenen visar på stationens skärm via iframe.
 *
 * Styrs av scenens tidslinje med postMessage:
 *   { type: 'xy-intro3d', state: 'idle' | 'luckor' | 'resurs' }
 *   idle   = grund-UI, ingen resurs i mitten
 *   luckor = de 5 luckorna (rundans resurser) highlightas
 *   resurs = aktuell resurs (bränslecell) i mitten, pulsar
 * Driver INGET spel-state och kopplar inte upp någon transport.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import CrtScreen from '@/station-kit/components/CrtScreen.vue'
import { useStationMode } from '@/station-kit/mode/useStationMode'
import ReporterConsole from '../stations/forhandlingen/components/ReporterConsole.vue'
import { LIVE_DATASET_ID, DATASETS } from '@/config'
import type { TeamId } from '../stations/forhandlingen/engine/types'

const qs = new URLSearchParams(location.search)
const team: TeamId = qs.get('team') === 'lag2' ? 'lag2' : 'lag1'
const ds = DATASETS.find((d) => d.id === LIVE_DATASET_ID)
const critical = (team === 'lag1' ? ds?.kritisk_lag1 : ds?.kritisk_lag2) ?? 'insulin'
const state = ref<string>(qs.get('state') ?? 'idle')

const { setMode } = useStationMode()
setMode('live')

function onMsg(e: MessageEvent) {
  if (e.data?.type === 'xy-intro3d' && typeof e.data.state === 'string') state.value = e.data.state
}
onMounted(() => window.addEventListener('message', onMsg))
onUnmounted(() => window.removeEventListener('message', onMsg))
</script>

<template>
  <div class="skarm" data-mode="live" :class="`skarm--${state}`">
    <CrtScreen :flicker="false">
      <ReporterConsole
        :team="team"
        demo="resource"
        :demo-critical="critical"
        :demo-capital="100"
        demo-resource="branslecell"
        :demo-hatches="5"
      />
    </CrtScreen>
  </div>
</template>

<style scoped>
.skarm {
  height: 100vh;
  padding: 0.6rem;
  box-sizing: border-box;
  overflow: hidden;
}
/* resurskortet syns bara i 'resurs' */
.skarm :deep(.console__rescard) {
  transition: opacity 0.45s ease, transform 0.45s ease;
}
.skarm--idle :deep(.console__rescard),
.skarm--luckor :deep(.console__rescard) {
  opacity: 0;
  transform: scale(0.9);
}
.skarm--resurs :deep(.console__rescard) {
  animation: intro-pulse 1.1s ease-in-out infinite;
}
/* luckorna highlightas */
.skarm :deep(.pips) {
  transition: transform 0.4s ease, filter 0.4s ease;
}
.skarm--luckor :deep(.pips) {
  transform: scale(2.1);
  filter: drop-shadow(0 0 8px var(--color-primary));
}
.skarm--luckor :deep(.pip) {
  opacity: 1;
  border-color: var(--color-primary);
  animation: intro-pip 0.9s ease-in-out infinite;
}
.skarm--luckor :deep(.pip:nth-child(2)) { animation-delay: 0.12s; }
.skarm--luckor :deep(.pip:nth-child(3)) { animation-delay: 0.24s; }
.skarm--luckor :deep(.pip:nth-child(4)) { animation-delay: 0.36s; }
.skarm--luckor :deep(.pip:nth-child(5)) { animation-delay: 0.48s; }
@keyframes intro-pulse {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
  50% { transform: scale(1.07); filter: drop-shadow(0 0 18px var(--color-primary)); }
}
@keyframes intro-pip {
  0%, 100% { box-shadow: 0 0 0 transparent; }
  50% { box-shadow: 0 0 10px var(--color-primary); background: var(--color-primary); }
}
</style>
