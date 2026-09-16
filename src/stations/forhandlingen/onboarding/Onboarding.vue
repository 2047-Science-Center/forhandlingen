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
import { TRIAL_DATASET, TEST1_DATASET, ROUND_TIMERS } from '@/config'
import { useI18n } from '@/station-kit/i18n'

import CrtScreen from '@/station-kit/components/CrtScreen.vue'
import VoiceWaveform from './anim/VoiceWaveform.vue'
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

// --- Headset ---
const voiced = ref(false)
function begin() {
  store.onbGoto('block1', Date.now())
}

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
watch(stage, () => {
  popupsDone.value = false
  resDone.value = false
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
    <!-- HEADSET -->
    <div v-if="stage === 'headset'" class="ob__headset">
      <VoiceWaveform @voiced="voiced = true" />
      <button class="crt-button crt-button--strong ob__begin" :disabled="!voiced" @click="begin">
        {{ t('intro.begin') }} ▸
      </button>
    </div>

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
