<script setup lang="ts">
/**
 * Onboarding-koordinator (per skärm/valv) — NY MODELL (härmar Eco Loco).
 *
 * Grund-UI:t (den riktiga ReporterConsole) syns så fort det lär ut något; en
 * coach-mark/spotlight-overlay dimmar allt utom det aktuella elementet och visar
 * en kort bubbla. Progressivt, en sak i taget, visa-gör-förklara, minimal text.
 * De gamla 4 ljudblocken + illustrationsscenerna är borta — bara förhandlings-
 * klippet (NegotiateClip, klipp #2) är kvar.
 *
 * Sekvens:
 *   Opening (självtempo per valv, onbStage='headset'):
 *     1 title → 2 participants → 3 "vem gör vad" (RolesSplit) →
 *     4 coach-marks över demo-konsolen (marknad → livsviktig → pengar → gissning)
 *     → 5 klipp #2 (NegotiateClip) → klar-gate (sync-barriär)
 *   Test (onbStage='test'): riktig budgivnings-övning på trial-datasetet, sedan
 *     gissning — allt på grund-UI:t.
 *   Testresultat (onbStage='testresult'): ResultWalkthrough (mode='test').
 *   → live.
 *
 * Steg-numreringen i uppdraget: 1=participants, 2=RolesSplit, 3–6=coach-marks,
 * 7=klipp, 8=test, 9=ResultWalkthrough.
 */
import { ref, computed, watch } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { TRIAL_DATASET, ROUND_TIMERS, TEAMS, RESOURCES } from '@/config'
import { useI18n } from '@/station-kit/i18n'
import { audio } from '@/station-kit/audio/AudioEngine'

import CrtScreen from '@/station-kit/components/CrtScreen.vue'
import CoachMark from '@/station-kit/components/CoachMark.vue'
import RoleIcon from '../components/RoleIcon.vue'
import TitleScreen from './opening/TitleScreen.vue'
import ParticipantsScreen from './opening/ParticipantsScreen.vue'
import RolesSplit from './opening/RolesSplit.vue'
import NegotiateClip from '../intro/NegotiateClip.vue'
import PopupSequence, { type PopupSpec } from './PopupSequence.vue'
import ResultWalkthrough from '../components/ResultWalkthrough.vue'
import BarrierWait from './BarrierWait.vue'
import ReporterConsole from '../components/ReporterConsole.vue'

const props = defineProps<{ team: TeamId }>()
const emit = defineEmits<{ complete: [] }>()
const store = useGameStore()
const { t } = useI18n()

const me = computed(() => props.team)
const shared = computed(() => store.view === 'shared')
const leader = computed(() => shared.value || me.value === 'lag1')
const stage = computed(() => store.onbStage)
const other = computed<TeamId>(() => (me.value === 'lag1' ? 'lag2' : 'lag1'))
const bothReady = computed(
  () => store.onbReady[me.value] && (shared.value || store.onbReady[other.value]),
)
const otherValvName = computed(() => TEAMS[other.value].name)
const iAmReady = computed(() => store.onbReady[me.value])

// ======================= OPENING (onbStage='headset') =======================
const openingStep = ref<'title' | 'participants' | 'roles' | 'coach' | 'clip' | 'gate'>('title')
const participantsMe = computed(() => (shared.value ? null : me.value))

// --- Coach-marks (steg 3–6): spotlight över demo-konsolen ---
const coachStep = ref(0)
// Demo-värden (driver INGET spel-state; bara en lugn kuliss bakom overlayn).
const demoCapital = 100
const demoResource = 'styrkort'
const demoCritical = computed(() =>
  me.value === 'lag1' ? TRIAL_DATASET.kritisk_lag1 : TRIAL_DATASET.kritisk_lag2,
)
const demoOppCritical = computed(() =>
  me.value === 'lag1' ? TRIAL_DATASET.kritisk_lag2 : TRIAL_DATASET.kritisk_lag1,
)
const demoOptions = RESOURCES.map((r) => r.id)

interface CoachSpec {
  target: string
  title: string
  body: string
  role?: 'A' | 'B'
  reinforce?: string
  demo: 'resource' | 'guess'
}
const coachSpecs = computed<CoachSpec[]>(() => [
  // 3 · marknad / aktuell resurs
  {
    target: '[data-tut="resource"]',
    title: t('coach.market_title'),
    body: t('coach.market_body'),
    role: 'A',
    reinforce: t('coach.mission_negotiator'),
    demo: 'resource',
  },
  // 4 · livsviktig resurs (övre höger)
  {
    target: '[data-tut="critical"]',
    title: t('coach.critical_title'),
    body: t('coach.critical_body'),
    demo: 'resource',
  },
  // 5 · pengar kvar = poäng
  {
    target: '[data-tut="capital"]',
    title: t('coach.capital_title'),
    body: t('coach.capital_body'),
    demo: 'resource',
  },
  // 6 · gissa motståndarens (GuessView, mockup-tryck + ×2)
  {
    target: '[data-tut="guess"]',
    title: t('coach.guess_title'),
    body: t('coach.guess_body'),
    role: 'B',
    reinforce: t('coach.mission_reporter'),
    demo: 'guess',
  },
])
const coach = computed(() => coachSpecs.value[coachStep.value])

function enterCoach() {
  coachStep.value = 0
  openingStep.value = 'coach'
}
function coachNext() {
  audio.play('blip')
  if (coachStep.value >= coachSpecs.value.length - 1) openingStep.value = 'clip'
  else coachStep.value += 1
}

// --- Klar-gate (sync-barriär → test) ---
function markReadyToStart() {
  store.onbMarkReady(me.value)
}
watch([bothReady, stage], () => {
  if (bothReady.value && stage.value === 'headset' && leader.value) store.onbGoto('test', null)
})

// ======================= TEST (onbStage='test') =======================
// Leder startar trial-datasetet (PAUSAT) vid stage-enter.
watch(
  stage,
  (s) => {
    if (leader.value && s === 'test' && store.state.datasetId !== 'trial') store.startTest2()
  },
  { immediate: true },
)

const testPopupsDone = ref(false)
const myCritical = computed(() => store.state.critical[me.value])
const testPopups = computed<PopupSpec[]>(() => [
  { title: t('test.intro_title'), icon: '🎧' },
  { title: t('reveal.your_critical_is'), resource: myCritical.value },
  { title: t('reveal.here_is_money'), money: TRIAL_DATASET.kapital },
])
function onTestPopupsFinish() {
  testPopupsDone.value = true
  store.onbMarkReady(me.value)
}

// Leder: arma getready-nedräkningen när BÅDA valv klickat klart popuparna.
watch([bothReady, stage], () => {
  if (!bothReady.value || !leader.value) return
  if (stage.value === 'test' && store.step === 'getready' && store.state.hatchTimerEndsAt == null) {
    store.armGetReady(ROUND_TIMERS.test2.getReadyFirst)
  }
})

// Budgivning klar → gissningsfas (GuessView visas i konsolen). När BÅDA gissat
// (synkat state) → resultat-genomgången.
const bothGuessed = computed(
  () => store.state.guesses.lag1 != null && store.state.guesses.lag2 != null,
)
watch([bothGuessed, stage], () => {
  if (stage.value === 'test' && bothGuessed.value && leader.value) store.onbGoto('testresult', null)
})

// ======================= TESTRESULTAT (onbStage='testresult') =======================
function onTestResultFinish() {
  store.onbGoto('live', null)
}

// Nollställ lokala flaggor vid stage-byte.
watch(stage, (s) => {
  testPopupsDone.value = false
  if (s === 'headset') {
    openingStep.value = 'title'
    coachStep.value = 0
  }
})

// --- Live ---
watch(stage, (s) => {
  if (s === 'live') emit('complete')
})

// Visar budgivnings-konsolen (grund-UI) i testet?
const showTestConsole = computed(() => stage.value === 'test' && store.phase !== 'intro')
</script>

<template>
  <div class="ob">
    <!-- ================= OPENING ================= -->
    <template v-if="stage === 'headset'">
      <TitleScreen v-if="openingStep === 'title'" @next="openingStep = 'participants'" />
      <ParticipantsScreen
        v-else-if="openingStep === 'participants'"
        :me="participantsMe"
        @next="openingStep = 'roles'"
      />
      <RolesSplit v-else-if="openingStep === 'roles'" @next="enterCoach" />

      <!-- Steg 3–6: demo-konsol BAKOM + coach-mark-overlay -->
      <div v-else-if="openingStep === 'coach'" class="ob__stage">
        <ReporterConsole
          :team="me"
          :demo="coach.demo"
          :demo-capital="demoCapital"
          :demo-critical="demoCritical"
          :demo-resource="demoResource"
          :demo-guess-pick="demoOppCritical"
          :demo-options="demoOptions"
        />
        <CoachMark
          :target="coach.target"
          :title="coach.title"
          :body="coach.body"
          :reinforce="coach.reinforce"
          :step="coachStep"
          :steps="coachSpecs.length"
          @next="coachNext"
        >
          <template v-if="coach.role" #reinforce>
            <RoleIcon :role="coach.role" :size="40" />
          </template>
        </CoachMark>
      </div>

      <!-- Steg 7: förhandlingsklippet -->
      <NegotiateClip v-else-if="openingStep === 'clip'" @next="openingStep = 'gate'" />

      <!-- Klar-gate (sync-barriär) -->
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

    <!-- ================= TEST (steg 8) ================= -->
    <div v-else-if="showTestConsole" class="ob__stage">
      <div v-if="shared" class="ob__split">
        <CrtScreen><ReporterConsole team="lag1" :allow-guess="true" /></CrtScreen>
        <CrtScreen><ReporterConsole team="lag2" :allow-guess="true" /></CrtScreen>
      </div>
      <ReporterConsole v-else :team="me" :allow-guess="true" />

      <!-- Intro-popupar (livsviktig + pengar) → barriär → budgivning -->
      <PopupSequence v-if="!testPopupsDone" :popups="testPopups" @finish="onTestPopupsFinish" />
      <BarrierWait v-else-if="!bothReady" />
    </div>

    <!-- ================= TESTRESULTAT (steg 9) ================= -->
    <div v-else-if="stage === 'testresult'" class="ob__stage ob__stage--result">
      <ResultWalkthrough mode="test" @finish="onTestResultFinish" />
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
.ob__stage--result {
  overflow: auto;
}
.ob__split {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}
</style>
