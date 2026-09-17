<script setup lang="ts">
/**
 * Onboarding-koordinator (per skärm/valv). Sekvens (synkad via storet):
 *   headset → block1 → test1 → block2 → test2 → test2res → block3 → test3
 *   → test3res → block4 → live.
 * Ljudblock startar synkat. Tester i egen takt med barriär ("väntar på andra
 * valvet"). Testernas popupar ligger som MODALER över grund-UI:t; getready-
 * nedräkningen är PAUSAD tills båda valv klickat klart popuparna (armas då).
 * Result-popuparna (test2res/test3res) visar säkrad-status/poäng resp. gissning/
 * totalpoäng. Inga roller i testerna. Vid 'live' → skarp körning.
 */
import { ref, computed, watch } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { TRIAL_DATASET, TEST1_DATASET, ROUND_TIMERS, TEAMS } from '@/config'
import { useI18n } from '@/station-kit/i18n'

import CrtScreen from '@/station-kit/components/CrtScreen.vue'
import TitleScreen from './opening/TitleScreen.vue'
import ParticipantsScreen from './opening/ParticipantsScreen.vue'
import OverviewPopups from './opening/OverviewPopups.vue'
import IntroBlock from '../intro/IntroBlock.vue'
import PopupSequence, { type PopupSpec } from './PopupSequence.vue'
import ResultPopups from './ResultPopups.vue'
import BarrierWait from './BarrierWait.vue'
import ReporterConsole from '../components/ReporterConsole.vue'
import GuessView from '../components/GuessView.vue'
import { BLOCKS } from './blocks'

const props = defineProps<{ team: TeamId }>()
const emit = defineEmits<{ complete: [] }>()
const store = useGameStore()
const { t } = useI18n()

const me = computed(() => props.team)
const shared = computed(() => store.view === 'shared')
const leader = computed(() => shared.value || me.value === 'lag1')
const stage = computed(() => store.onbStage)
const bothReady = computed(
  () => store.onbReady[me.value] && (shared.value || store.onbReady[me.value === 'lag1' ? 'lag2' : 'lag1']),
)

// --- Öppningssekvens (lokalt, självtempo per valv) medan delad stage = 'headset':
//   title → participants → overview → gate (klar-gate = sync-barriär till block1). ---
const openingStep = ref<'title' | 'participants' | 'overview' | 'gate'>('title')
const participantsMe = computed(() => (shared.value ? null : me.value))
const otherValvName = computed(() => TEAMS[me.value === 'lag1' ? 'lag2' : 'lag1'].name)
const iAmReady = computed(() => store.onbReady[me.value])

// Klar-gaten: markera redo (fri klick, ingen mic). Barriären startar block1.
function markReadyToStart() {
  store.onbMarkReady(me.value)
}

// När BÅDA valv klickat "Börja" → synkad start av block1 (leder sätter epoken).
watch([bothReady, stage], () => {
  if (bothReady.value && stage.value === 'headset' && leader.value) {
    store.onbGoto('block1', Date.now())
  }
})

// --- Block → nästa steg ---
function blockDone() {
  const map: Record<string, string> = {
    block1: 'test1',
    block2: 'test2',
    block3: 'test3',
    block4: 'live',
  }
  const next = map[stage.value]
  if (next) store.onbGoto(next, next === 'live' ? Date.now() : null)
}

// --- Lokala popup-flaggor (nollställs vid stage-byte) ---
const popupsDone = ref(false)
const resDone = ref(false)
watch(stage, (s) => {
  popupsDone.value = false
  resDone.value = false
  if (s === 'headset') openingStep.value = 'title'
})

// Test 1/2: klar med intro-popupar → markera redo (popup-barriär).
function onPopupsFinish() {
  popupsDone.value = true
  if (stage.value !== 'test3') store.onbMarkReady(me.value)
}
// Result-popupar klara → markera redo (result-barriär).
function onResFinish() {
  resDone.value = true
  store.onbMarkReady(me.value)
}

const myCritical = computed(() =>
  me.value === 'lag1' ? TRIAL_DATASET.kritisk_lag1 : TRIAL_DATASET.kritisk_lag2,
)
const test1Popups: PopupSpec[] = [
  { title: t('test1.pop1'), resource: 'styrkort' },
  { title: t('test1.pop2'), icon: '🤫' },
  { title: t('test1.pop3'), money: TEST1_DATASET.kapital },
]
const test2Popups = computed<PopupSpec[]>(() => [
  { title: t('reveal.your_critical_is'), resource: myCritical.value },
  { title: t('reveal.here_is_money'), money: TRIAL_DATASET.kapital },
])
const test3Popups: PopupSpec[] = [{ body: t('test3.instruction') }]

// --- Leder: starta testomgången (PAUSAD) vid stage-enter ---
watch(
  stage,
  (s) => {
    if (!leader.value) return
    if (s === 'test1' && store.state.datasetId !== 'test1') store.startTest1()
    else if (s === 'test2' && store.state.datasetId !== 'trial') store.startTest2()
  },
  { immediate: true },
)

// --- Leder: arma getready-nedräkningen när båda klickat klart popuparna ---
watch([bothReady, stage], () => {
  if (!bothReady.value || !leader.value) return
  if ((stage.value === 'test1' || stage.value === 'test2') && store.step === 'getready' && store.state.hatchTimerEndsAt == null) {
    const gf = stage.value === 'test1' ? ROUND_TIMERS.test1.getReadyFirst : ROUND_TIMERS.test2.getReadyFirst
    store.armGetReady(gf)
  }
})

// --- Testomgång klar (fas 'guessing') → resultat/nästa steg ---
watch(
  () => store.phase,
  (p) => {
    if (p !== 'guessing' || !leader.value) return
    if (stage.value === 'test1') store.onbGoto('block2', null)
    else if (stage.value === 'test2') store.onbGoto('test2res', null)
  },
)

// --- Result-barriärer → nästa block ---
watch([bothReady, stage], () => {
  if (!bothReady.value || !leader.value) return
  if (stage.value === 'test2res') store.onbGoto('block3', null)
  else if (stage.value === 'test3res') store.onbGoto('block4', null)
})

// --- Test 3: gissning låst → barriär → test3res ---
const guessLocked = computed(() => store.state.guesses[me.value] != null)
watch(guessLocked, (v) => {
  if (v && stage.value === 'test3') store.onbMarkReady(me.value)
})
watch([bothReady, stage], () => {
  if (bothReady.value && stage.value === 'test3' && leader.value) store.onbGoto('test3res', null)
})

// --- Live ---
watch(stage, (s) => {
  if (s === 'live') emit('complete')
})

// Visar spel-konsolen (grund-UI bakom popuparna)?
const showConsole = computed(() =>
  ['test1', 'test2', 'test2res'].includes(stage.value) && store.phase !== 'intro',
)
const isTestPlay = computed(() => stage.value === 'test1' || stage.value === 'test2')
</script>

<template>
  <div class="ob">
    <!-- ÖPPNING: Titel → Deltagare → 3 pop-ups → Klar-gate -->
    <template v-if="stage === 'headset'">
      <TitleScreen v-if="openingStep === 'title'" @next="openingStep = 'participants'" />
      <ParticipantsScreen
        v-else-if="openingStep === 'participants'"
        :me="participantsMe"
        @next="openingStep = 'overview'"
      />
      <OverviewPopups v-else-if="openingStep === 'overview'" @finish="openingStep = 'gate'" />

      <!-- Klar-gate (modifierad headset-ruta: ingen mic, fri klick, sync-barriär) -->
      <div v-else class="ob__headset">
        <template v-if="!iAmReady">
          <span class="ob__headset-icon" aria-hidden="true">🎧</span>
          <p class="ob__headset-copy">{{ t('opening.headset_on') }}</p>
          <button class="crt-button crt-button--strong ob__begin" @click="markReadyToStart">
            {{ t('opening.begin') }} ▸
          </button>
        </template>
        <div v-else class="ob__waiting">
          <span class="ob__waiting-dot" aria-hidden="true"></span>
          <span class="ob__waiting-text">{{ t('opening.waiting_valv', { valv: otherValvName }) }}</span>
        </div>
      </div>
    </template>

    <!-- LJUDBLOCK -->
    <IntroBlock
      v-else-if="stage.startsWith('block')"
      :block="BLOCKS[stage as keyof typeof BLOCKS]"
      :start-epoch="store.onbEpoch ?? undefined"
      @done="blockDone"
    />

    <!-- TEST 1 / TEST 2 / RESULTAT: grund-UI bakom, popupar över -->
    <div v-else-if="showConsole" class="ob__stage">
      <div v-if="shared" class="ob__split">
        <CrtScreen><ReporterConsole team="lag1" /></CrtScreen>
        <CrtScreen><ReporterConsole team="lag2" /></CrtScreen>
      </div>
      <ReporterConsole v-else :team="me" />

      <!-- Test-popupar (över UI) -->
      <PopupSequence
        v-if="isTestPlay && !popupsDone"
        :popups="stage === 'test1' ? test1Popups : test2Popups"
        @finish="onPopupsFinish"
      />
      <BarrierWait v-else-if="isTestPlay && !bothReady" />

      <!-- Result-popupar efter test 2 -->
      <ResultPopups v-if="stage === 'test2res' && !resDone" mode="test2" :team="me" @finish="onResFinish" />
      <BarrierWait v-else-if="stage === 'test2res'" />
    </div>

    <!-- TEST 3: gissning + instruktions-popup -->
    <template v-else-if="stage === 'test3'">
      <PopupSequence v-if="!popupsDone" :popups="test3Popups" @finish="onPopupsFinish" />
      <BarrierWait v-else-if="guessLocked" />
      <template v-else>
        <div v-if="shared" class="ob__split">
          <CrtScreen><GuessView team="lag1" /></CrtScreen>
          <CrtScreen><GuessView team="lag2" /></CrtScreen>
        </div>
        <GuessView v-else :team="me" />
      </template>
    </template>

    <!-- TEST 3 RESULTAT -->
    <div v-else-if="stage === 'test3res'" class="ob__stage">
      <ResultPopups v-if="!resDone" mode="test3" :team="me" @finish="onResFinish" />
      <BarrierWait v-else />
    </div>
  </div>
</template>

<style scoped>
.ob {
  height: 100%;
  position: relative;
}
.ob__headset {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}
.ob__begin {
  font-size: 1.5rem;
  padding: 0.5em 2em;
}
.ob__headset-icon {
  font-size: 3.4rem;
  filter: drop-shadow(0 0 12px var(--color-primary));
}
.ob__headset-copy {
  font-family: var(--font-retro);
  font-size: 1.6rem;
  color: var(--color-ink-strong);
  margin: 0;
  text-align: center;
}
.ob__waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.ob__waiting-dot {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 14px var(--color-primary);
  animation: ob-throb 1s ease-in-out infinite;
}
.ob__waiting-text {
  font-family: var(--font-retro);
  font-size: 1.5rem;
  color: var(--color-ink-strong);
  text-align: center;
}
@keyframes ob-throb {
  0%, 100% { transform: scale(0.7); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .ob__waiting-dot { animation: none; }
}
.ob__stage {
  position: relative;
  height: 100%;
}
.ob__split {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}
</style>
