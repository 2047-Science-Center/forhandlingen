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
import ModeCountdown from '@/station-kit/components/ModeCountdown.vue'
import { useI18n } from '@/station-kit/i18n'
import { useStationMode } from '@/station-kit/mode/useStationMode'

import ReporterConsole from './components/ReporterConsole.vue'
import ResultView from './components/ResultView.vue'
import PilotPanel from './components/PilotPanel.vue'
import FacilitatorControls from './components/FacilitatorControls.vue'
import PauseOverlay from './components/PauseOverlay.vue'
import IdleWarning from './components/IdleWarning.vue'
import Onboarding from './onboarding/Onboarding.vue'
import type { TeamId } from './engine/types'

const store = useGameStore()
const { t } = useI18n()

/** Attract visas tills första gesten. */
const entered = ref(false)
/** Onboardingen klar när koordinatorns stage nått 'live'. */
const onboarded = computed(() => store.onbStage === 'live')

const isPilot = computed(() => config.mode === 'pilot')
const showReveal = computed(() => store.phase === 'reveal')
/** Vilket valv tutorialen gäller (delad vy → lag1 för soloprov). */
const onboardTeam = computed<TeamId>(() => (store.view === 'lag2' ? 'lag2' : 'lag1'))
const leader = computed(() => store.view === 'shared' || onboardTeam.value === 'lag1')

/** När onboardingen når 'live' → starta skarp körning (100 kr, 5 resurser). */
watch(onboarded, (v) => {
  if (v && leader.value && store.state.datasetId !== LIVE_DATASET_ID) store.startLive()
})

// --- Läges-system (gemensamt station-kit): HELA UI:t är i tutorial-tema (blått)
//     under hela onboardingen, skarpt tema annars. data-mode på app-roten sätter
//     tokens; komponenterna ärver färg. Attract visas i skarp identitetsfärg. ---
const { setMode } = useStationMode()
const stationMode = computed<'tutorial' | 'live'>(() =>
  entered.value && !onboarded.value ? 'tutorial' : 'live',
)
watch(stationMode, (m) => setMode(m), { immediate: true })

// Go-live-nedräkning: helskärmsanimation vid övergången tutorial → live.
const showGoLive = ref(false)
watch(onboarded, (v, old) => {
  if (v && !old) showGoLive.value = true
})

// --- Idle-återstart: logiken bor i storet (tickens reaktivitet). Appen sätter
//     bara "körning pågår" vid enter och återgår till attract vid reset. ---
watch(entered, (v) => store.setSessionActive(v))
// Reset (manuell, idle eller från peer) → tillbaka till attract.
watch(() => store.resetSignal, () => {
  entered.value = false
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
  <div class="app" :data-mode="stationMode">
    <div v-if="!entered" class="app__single">
      <CrtScreen><AttractScreen @start="entered = true" /></CrtScreen>
    </div>

    <template v-else>
      <div class="app__chrome">
        <span class="app__title">{{ t('app.title') }}</span>
        <MuteButton />
      </div>

      <!-- Övningsmärkning: egen in-flow-rad högst upp (ALDRIG position:fixed över
           innehållet — det var därför lag-/valv-skyltar kunde täcka texten i test
           1). Syns HELA tutorialen och försvinner i samma stund spelet blir
           skarpt. Blå --mode-tutorial oavsett tema. -->
      <div v-if="!onboarded" class="app__practice" role="status">
        <span class="app__practice-dot" aria-hidden="true"></span>
        <span class="app__practice-main">{{ t('mode.testomgang') }}</span>
        <span class="app__practice-sub">{{ t('mode.practice_sub') }}</span>
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

    <!-- Facilitator-kontroller (paus/starta om) — i både pilot och drift -->
    <FacilitatorControls v-if="entered" />
    <PauseOverlay v-if="entered && store.paused" />
    <IdleWarning v-if="store.idleWarn" :seconds="store.idleSecondsLeft" />

    <PilotPanel v-if="isPilot && entered" />

    <!-- Go-live: helskärms-nedräkning vid tutorial → live -->
    <ModeCountdown
      v-if="showGoLive"
      :title="t('mode.golive_title')"
      :from="3"
      @done="showGoLive = false"
    />
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
/* In-flow banner (ingen position:fixed) → kan per konstruktion aldrig täckas
   av eller täcka skyltar/overlays. Full bredd högst upp, under app-chrome. */
.app__practice {
  flex: none;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.7rem;
  padding: 0.35em 1.2em;
  font-family: var(--font-retro);
  color: var(--mode-tutorial);
  background: var(--color-background-2);
  border: 2px solid var(--mode-tutorial);
  border-radius: 10px;
  box-shadow: 0 0 18px rgba(var(--mode-tutorial-rgb), 0.35);
  text-shadow: 0 0 6px rgba(var(--mode-tutorial-rgb), 0.5);
  flex-wrap: wrap;
}
.app__practice-main {
  font-size: 1.8rem;
  letter-spacing: 0.18em;
  line-height: 1;
}
.app__practice-sub {
  font-size: 1.05rem;
  letter-spacing: 0.04em;
  color: var(--mode-tutorial);
  opacity: 0.85;
}
.app__practice-dot {
  align-self: center;
  width: 0.8em;
  height: 0.8em;
  border-radius: 50%;
  background: var(--mode-tutorial);
  box-shadow: 0 0 10px var(--mode-tutorial);
  animation: practice-throb 1.4s ease-in-out infinite;
}
@keyframes practice-throb {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
@media (prefers-reduced-motion: reduce) {
  .app__practice-dot { animation: none; }
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
