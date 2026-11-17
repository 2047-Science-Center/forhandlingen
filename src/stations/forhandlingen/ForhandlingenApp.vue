<script setup lang="ts">
/**
 * Toppnivå för stationen Förhandlingen. Attract-skärm → konsol(er).
 * Vy styr layout: en konsol (lag1/lag2, en fysisk skärm per sida i drift)
 * eller båda (delad vy för soloprov i piloten). Avslöjandet visas en gång.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from './store/gameStore'
import { config, LIVE_DATASET_ID, ROLLVAL, ROTATION, ENTRE, SIDE_TO_TEAM } from '@/config'

import CrtScreen from '@/station-kit/components/CrtScreen.vue'
import AttractScreen from '@/station-kit/components/AttractScreen.vue'
import Entre from '@/station-kit/entre/Entre.vue'
import { initEntre } from '@/station-kit/entre/entre'
import MuteButton from '@/station-kit/components/MuteButton.vue'
import ModeCountdown from '@/station-kit/components/ModeCountdown.vue'
import { useI18n } from '@/station-kit/i18n'
import { useStationMode } from '@/station-kit/mode/useStationMode'
import { audio } from '@/station-kit/audio/AudioEngine'
import RotationScreens from '@/station-kit/rotation/RotationScreens.vue'
import { initRotation, rotationOptions } from '@/station-kit/rotation/rotation'

import ReporterConsole from './components/ReporterConsole.vue'
import ResultWalkthrough from './components/ResultWalkthrough.vue'
import PilotPanel from './components/PilotPanel.vue'
import FacilitatorControls from './components/FacilitatorControls.vue'
import PauseOverlay from './components/PauseOverlay.vue'
import IdleWarning from './components/IdleWarning.vue'
import Onboarding from './onboarding/Onboarding.vue'
import VemSaDet from './ventlage/VemSaDet.vue'
import type { TeamId } from './engine/types'

const store = useGameStore()
const { t } = useI18n()

// --- Väntläge-entry: hash #vem öppnar väntleken "Vem sa det?" (F1) fristående,
//     förbi attract/onboarding. "TILL START" rensar hashen → vanlig attract.
//     Speglar hur gameStore läser #lag1/#shared ur hashen. ---
const hashRoute = ref(readHashRoute())
function readHashRoute(): string {
  return (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '')
}
function onHashChange() {
  hashRoute.value = readHashRoute()
}
const showVem = computed(() => hashRoute.value === 'vem')
function exitVem() {
  if (typeof window !== 'undefined') window.location.hash = ''
  hashRoute.value = ''
}

/** Sessionen pågår (entréns attract lämnad). */
const entered = ref(false)

// --- Rotationen + entrén (station-kit): entréns attract visar "Testgrupp X — tryck"
//     + sidindelningen, sedan rollval-klipp → valet → ombalansering → "gå till sida A/B".
//     Sida A = lag1 (Sändebud), sida B = lag2 (Rapportör) — config ENTRE. ---
const rotation = initRotation(rotationOptions(ROTATION))
const entre = initEntre({ stationN: ROTATION.stationN, config: ENTRE, mqttUrl: rotationOptions(ROTATION).mqttUrl })
const entreDone = computed(() => entre.state.step === 'klar')
watch(
  () => store.view,
  (v) => entre.setScreen({ side: v === 'lag1' ? 'A' : v === 'lag2' ? 'B' : null, leader: v === 'shared' || v === 'lag1' }),
  { immediate: true },
)
/** Entrén klar → lottade roller in i spelet (ledaren dispatchar; synkas). */
function onEntreDone(): void {
  const team = (side: 'A' | 'B') =>
    entre.personer.value
      .filter((p) => p.side === side)
      .map((p) => ({
        band_id: p.band_id,
        name: p.name,
        team: SIDE_TO_TEAM[side],
        // DB: chosen_role är NOT NULL — den som inte hann välja (facilitatorns "Lotta nu") loggas som sin tilldelade roll.
        chosen_role: p.chosen_role ?? p.assigned_role,
        assigned_role: p.assigned_role,
        role_presented_as: null,
      }))
  store.setRoster({ lag1: team('A'), lag2: team('B') })
}
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
  if (v) rotation.markSkarp()
})

// --- Rotationen: entréns touch = begin(); lämnar gruppen 'running' (lek / ny grupp)
//     → stationen återställs bakom overlayen. ---
watch(
  () => rotation.state.phase,
  (p, old) => {
    if (p === 'running') {
      audio.unlock()
      entered.value = true
    } else if (old === 'running') store.reset(false)
  },
)
/** Skarpa resultatgenomgången klar → done + lek (rotation), annars som förut. */
function onLiveFinish(): void {
  if (!rotation.finishSkarp()) store.reset()
}

// --- Läges-system (gemensamt station-kit): HELA UI:t är i tutorial-tema (blått)
//     under hela onboardingen, skarpt tema annars. data-mode på app-roten sätter
//     tokens; komponenterna ärver färg. Attract visas i skarp identitetsfärg. ---
const { setMode } = useStationMode()
const stationMode = computed<'tutorial' | 'live'>(() =>
  entered.value && !onboarded.value && entreDone.value ? 'tutorial' : 'live',
)
watch(stationMode, (m) => setMode(m), { immediate: true })

// Tutorial-loop (beat 2.2): låg bakgrundsbädd under onboardingen, tonas ut när
// skarpa rundan börjar. Bädden ligger utanför SFX-mastern (eget HTMLAudio).
watch([stationMode, entered], ([m, isIn]) => {
  if (isIn && m === 'tutorial') audio.bed('tutorial-loop.mp3', 0.18)
  else audio.bedStop()
})

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
  entre.reset()
})

function onActivity() {
  store.notifyActivity()
}
// Kiosk: långtryck på en touchskärm fyrar webbläsarens contextmenu (ser ut som
// ett högerklick → meny med Ladda om/Bakåt osv.). Spärra den helt — stationen
// har inget eget behov av högerklick. Funkar oavsett OS/skärm.
function onContextMenu(e: Event) {
  e.preventDefault()
}
const ACTIVITY_EVENTS = ['pointerdown', 'mousedown', 'click', 'keydown', 'touchstart', 'wheel'] as const
onMounted(() => {
  store.init()
  entre.attachTransport(store.transport())
  window.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('hashchange', onHashChange)
  ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
})
onUnmounted(() => {
  window.removeEventListener('contextmenu', onContextMenu)
  window.removeEventListener('hashchange', onHashChange)
  ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
  audio.bedStop(0)
  store.dispose()
})
</script>

<template>
  <div class="app" :data-mode="stationMode">
    <!-- Väntläge "Vem sa det?" (F1): fristående via #vem, förbi attract/onboarding.
         Egen app-chrome + CRT-skärm; "TILL START" → exitVem → vanlig attract. -->
    <template v-if="showVem">
      <div class="app__chrome">
        <span class="app__title">{{ t('app.title') }}</span>
        <MuteButton />
      </div>
      <div class="app__single">
        <CrtScreen><VemSaDet @exit="exitVem" /></CrtScreen>
      </div>
    </template>

    <template v-else>
    <!-- Entrén: attract (testgrupp + sidindelning) → rollval → valet → utfall -->
    <div v-if="!entreDone" class="app__single">
      <CrtScreen>
        <Entre :rollval="ROLLVAL" @start="entered = true" @done="onEntreDone">
          <template #attract="{ start }"><AttractScreen @start="start" /></template>
        </Entre>
      </CrtScreen>
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
      <div v-if="!onboarded && store.onbStage !== 'identify'" class="app__practice" role="status">
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

      <!-- Avslöjande: en gemensam vy. Samma result-genomgång som efter testet
           (steg 9) — stegar vinnaren/varför på det riktiga resultat-UI:t. -->
      <div v-else-if="showReveal" class="app__single">
        <CrtScreen><ResultWalkthrough mode="live" @finish="onLiveFinish" /></CrtScreen>
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
    </template>

    <!-- Rotationen: väntar / lek (overlay; "Testgrupp X — tryck" visas av entrén) -->
    <RotationScreens station-title="Förhandlingen" />
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
