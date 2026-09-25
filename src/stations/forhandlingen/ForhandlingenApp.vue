<script setup lang="ts">
/**
 * Toppnivå för stationen Förhandlingen. Attract-skärm → konsol(er).
 * Vy styr layout: en konsol (lag1/lag2, en fysisk skärm per sida i drift)
 * eller båda (delad vy för soloprov i piloten). Avslöjandet visas en gång.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from './store/gameStore'
import { config, LIVE_DATASET_ID } from '@/config'

import CrtScreen from '@/station-kit/components/CrtScreen.vue'
import AttractScreen from '@/station-kit/components/AttractScreen.vue'
import MuteButton from '@/station-kit/components/MuteButton.vue'
import { useI18n } from '@/station-kit/i18n'

import ReporterConsole from './components/ReporterConsole.vue'
import ResultView from './components/ResultView.vue'
import PilotPanel from './components/PilotPanel.vue'
import FacilitatorControls from './components/FacilitatorControls.vue'
import PauseOverlay from './components/PauseOverlay.vue'
import IdleWarning from './components/IdleWarning.vue'
import Onboarding from './onboarding/Onboarding.vue'
import PopupSequence, { type PopupSpec } from './onboarding/PopupSequence.vue'
import type { TeamId } from './engine/types'

const store = useGameStore()
const { t } = useI18n()

/** Attract visas tills första gesten. */
const entered = ref(false)
/** Onboardingen klar när koordinatorns stage nått 'live'. */
const onboarded = computed(() => store.onbStage === 'live')

/** "Ta på lurarna"-ruta i början av skarpa förhandlingen (klickas bort en gång). */
const liveHeadsetDone = ref(false)
const liveHeadsetPopups = computed<PopupSpec[]>(() => [
  { icon: '🎧', title: t('headset.on'), body: t('headset.on_sub') },
])

const isPilot = computed(() => config.mode === 'pilot')
const showReveal = computed(() => store.phase === 'reveal')
/** Vilket valv tutorialen gäller (delad vy → lag1 för soloprov). */
const onboardTeam = computed<TeamId>(() => (store.view === 'lag2' ? 'lag2' : 'lag1'))
const leader = computed(() => store.view === 'shared' || onboardTeam.value === 'lag1')

/** När onboardingen når 'live' → starta skarp körning (100 kr, 5 resurser). */
watch(onboarded, (v) => {
  if (v && leader.value && store.state.datasetId !== LIVE_DATASET_ID) store.startLive()
})

// --- Idle-återstart: logiken bor i storet (tickens reaktivitet). Appen sätter
//     bara "körning pågår" vid enter och återgår till attract vid reset. ---
watch(entered, (v) => store.setSessionActive(v))
// Reset (manuell, idle eller från peer) → tillbaka till attract.
watch(() => store.resetSignal, () => {
  entered.value = false
  liveHeadsetDone.value = false
})

function onActivity() {
  store.notifyActivity()
}
const ACTIVITY_EVENTS = ['pointerdown', 'mousedown', 'click', 'keydown', 'touchstart', 'wheel'] as const
onMounted(() => {
  store.init()
  ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
})
onUnmounted(() => {
  ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
  store.dispose()
})
</script>

<template>
  <div class="app">
    <div v-if="!entered" class="app__single">
      <CrtScreen><AttractScreen @start="entered = true" /></CrtScreen>
    </div>

    <template v-else>
      <div class="app__chrome">
        <span class="app__title">{{ t('app.title') }}</span>
        <span v-if="store.isTest" class="app__trial">{{ t('onboarding.trial.watermark') }}</span>
        <MuteButton />
      </div>

      <!-- Onboarding (headset → 4 block → 3 tester) före skarp körning -->
      <div v-if="!onboarded" class="app__single">
        <CrtScreen>
          <Onboarding :team="onboardTeam" />
        </CrtScreen>
      </div>

      <!-- Avslöjande: en gemensam vy -->
      <div v-else-if="showReveal" class="app__single">
        <CrtScreen><ResultView /></CrtScreen>
      </div>

      <!-- Delad vy: båda konsolerna sida vid sida -->
      <div v-else-if="store.view === 'shared'" class="app__split">
        <CrtScreen><ReporterConsole team="lag1" /></CrtScreen>
        <CrtScreen><ReporterConsole team="lag2" /></CrtScreen>
      </div>

      <!-- Enkel vy: en sidas skärm -->
      <div v-else class="app__single">
        <CrtScreen>
          <ReporterConsole :team="store.view === 'lag1' ? 'lag1' : 'lag2'" />
        </CrtScreen>
      </div>
    </template>

    <!-- "Ta på lurarna" i början av skarpa förhandlingen (klickas bort en gång) -->
    <PopupSequence
      v-if="onboarded && !showReveal && !liveHeadsetDone"
      :popups="liveHeadsetPopups"
      @finish="liveHeadsetDone = true"
    />

    <!-- Facilitator-kontroller (paus/starta om) — i både pilot och drift -->
    <FacilitatorControls v-if="entered" />
    <PauseOverlay v-if="entered && store.paused" />
    <IdleWarning v-if="store.idleWarn" :seconds="store.idleSecondsLeft" />

    <PilotPanel v-if="isPilot && entered" />
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0.6rem;
  gap: 0.6rem;
}
.app__chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.4rem;
}
.app__title {
  font-family: var(--font-retro);
  font-size: 1.3rem;
  letter-spacing: 0.15em;
  color: var(--color-primary);
}
.app__trial {
  margin-left: auto;
  margin-right: 1rem;
  font-family: var(--font-retro);
  letter-spacing: 0.2em;
  color: var(--color-ink-muted);
  border: 1px solid var(--color-primary-dim);
  border-radius: 6px;
  padding: 0.1em 0.6em;
}
.app__split {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  min-height: 0;
}
.app__single {
  flex: 1;
  min-height: 0;
}
@media (max-width: 900px) {
  .app__split {
    grid-template-columns: 1fr;
  }
}
</style>
