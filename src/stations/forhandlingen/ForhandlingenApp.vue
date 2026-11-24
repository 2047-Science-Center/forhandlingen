<script setup lang="ts">
/**
 * Toppnivå för stationen Förhandlingen. Attract-skärm → konsol(er).
 * Vy styr layout: en konsol (lag1/lag2, en fysisk skärm per sida i drift)
 * eller båda (delad vy för soloprov i piloten). Avslöjandet visas en gång.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from './store/gameStore'
import { config, LIVE_DATASET_ID, ROLLVAL, ROLLVAL_OVERLAY_SETS, ROLLVAL_PORTRATT_SETS, ROTATION, ENTRE, BANDLOST, SIDE_TO_TEAM, LJUS } from '@/config'

import CrtScreen from '@/station-kit/components/CrtScreen.vue'
import AttractScreen from '@/station-kit/components/AttractScreen.vue'
import Entre from '@/station-kit/entre/Entre.vue'
import { initEntre } from '@/station-kit/entre/entre'
import ModeCountdown from '@/station-kit/components/ModeCountdown.vue'
import { useI18n } from '@/station-kit/i18n'
import { useStationMode } from '@/station-kit/mode/useStationMode'
import { audio } from '@/station-kit/audio/AudioEngine'
import RotationScreens from '@/station-kit/rotation/RotationScreens.vue'
import { initRotation, rotationOptions } from '@/station-kit/rotation/rotation'
import { initResultat, resultatOptions } from '@/station-kit/resultat'
import ForhandlingAvslut from './components/ForhandlingAvslut.vue'
import { initLjus, ljusOptions, lageFranRotation, LjusRemsa } from '@/station-kit/ljus'
import { initFilm, filmOptions, FilmOverlay } from '@/station-kit/film'
import { initIncheckning, incheckningOptions } from '@/station-kit/incheckning/incheckning'
import IncheckningScreen from '@/station-kit/incheckning/IncheckningScreen.vue'
import { spela, arSkrivare, appLage } from './ljus'
import SpellageSymbol from '@/station-kit/spellage/SpellageSymbol.vue'
import MikTest from './components/MikTest.vue'
import { MIK_LAGE } from './mik'

import ReporterConsole from './components/ReporterConsole.vue'
import PilotPanel from './components/PilotPanel.vue'
import FacilitatorControls from './components/FacilitatorControls.vue'
import PauseOverlay from './components/PauseOverlay.vue'
import IdleWarning from './components/IdleWarning.vue'
import Onboarding from './onboarding/Onboarding.vue'
import VemDarLek from './lek/VemDarLek.vue'
import LekStandalone from '@/station-kit/lek/LekStandalone.vue'
import { lekPreviewFromUrl } from '@/station-kit/lek/lekSync'
import type { VemPerson } from './lek/vemDar'
import type { TeamId } from './engine/types'

const store = useGameStore()
const { t } = useI18n()

/** Sessionen pågår (entréns attract lämnad). */
const entered = ref(false)

// --- Rotationen + entrén (station-kit): entréns attract visar "Testgrupp X — tryck"
//     + sidindelningen, sedan rollval-klipp → valet → ombalansering → "gå till sida A/B".
//     Sida A = lag1 (Sändebud), sida B = lag2 (Rapportör) — config ENTRE. ---
const rotation = initRotation(rotationOptions(ROTATION))
// Resultatet ut (station-kit/resultat): på när rotationen är på, överstyrs med ?result=1|0 / VITE_RESULT.
{
  const rot = rotationOptions(ROTATION)
  initResultat(resultatOptions({ stationN: ROTATION.stationN, enabled: rot.enabled, mqttUrl: rot.mqttUrl }))
}
const entre = initEntre({
  stationN: ROTATION.stationN,
  config: ENTRE,
  mqttUrl: rotationOptions(ROTATION).mqttUrl,
  bandlost: BANDLOST,
})
/** Pilot: ?hopp=lage|intro|prov|live hoppar förbi entrén direkt till ett steg (demo/test, aldrig i drift). */
const hopp = config.mode === 'pilot' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('hopp') : null
const entreDone = computed(() => entre.state.step === 'klar' || !!hopp)
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
        // Klippsetet ur DB (station<N>/group set_id + female_role) → hur den valda rollen presenterades.
        role_presented_as: entre.presentedAs(p),
      }))
  store.setRoster({ lag1: team('A'), lag2: team('B') })
}
// --- Lek-läget (lila, efter done): "Vem där?" — XY-VANTUPPGIFTER.md 1A. Sidorna ur
//     entrén (sida A = lag1, sida B = lag2); saknas de (t.ex. omladdning i
//     lek) gissar man bland hela gruppen. ?lek=1 visar leken direkt (förhandsvisning). ---
const lekPreview = lekPreviewFromUrl()
const lekPeople = computed<VemPerson[]>(() => {
  const ps = entre.personer.value
  if (ps.length) return ps.map((p) => ({ band_id: p.band_id, name: p.name, side: p.side }))
  return entre.members.value.map((m) => ({ band_id: m.band_id, name: m.name, side: null }))
})
const lekSide = computed(() => (store.view === 'lag1' ? 'A' : store.view === 'lag2' ? 'B' : null))
const lekLeader = computed(() => store.view !== 'lag2')

/** Onboardingen klar när koordinatorns stage nått 'live'. */
const onboarded = computed(() => store.onbStage === 'live')

// --- Stationsljus (station-kit/ljus, XY-FEEDBACK-LJUS-LJUD §5.1): underglow A (#lag1) /
//     B (#lag2). Skrivare = ledarfönstret (lag1/delad) — bara det publicerar basen och
//     gester för synkade händelser. Samma broker som rotationen; publicerar bara i drift. ---
const ljus = initLjus(
  ljusOptions({
    stationN: ROTATION.stationN,
    enabled: config.mode === 'production',
    mqttUrl: ROTATION.mqttUrl,
    valv: LJUS.valv,
    segment: LJUS.segment,
    skrivare: arSkrivare(store.view),
    spela,
  }),
)
// --- Regis filmer (station-kit/film, SOM.md "Filmer i riggen"): trailern helskärm i båda
//     fönstren medan regi står i trailerfasen, sedan tillbaka till stationen. ---
//     I reveal/syv visar overlayen broker-NUC:ens appar (SOM.md "Appar i riggen").
initFilm(
  filmOptions({
    enabled: config.mode === 'production',
    mqttUrl: ROTATION.mqttUrl,
    stationN: ROTATION.stationN,
    sida: store.view === 'lag1' ? 'A' : store.view === 'lag2' ? 'B' : null,
  }),
)
// --- Incheckningen (station-kit/incheckning, SOM.md "Incheckningen vid stationerna"): medan regi står i
//     incheckningen visar stationen gruppen som börjar här ("Ta ditt band") → "Alla har sina band på sig"
//     → station<N>/incheckad. Regi går till trailern när alla stationer kvitterat. ---
initIncheckning(
  incheckningOptions({
    stationN: ROTATION.stationN,
    enabled: config.mode === 'production',
    mqttUrl: rotationOptions(ROTATION).mqttUrl,
    bandlost: BANDLOST,
  }),
)

const ljusLage = computed(() =>
  appLage({
    rotationPa: rotation.state.phase !== 'off',
    franRotation: lageFranRotation(rotation.state.phase, rotation.state.mode),
    entered: entered.value,
    onboarded: onboarded.value,
  }),
)
watch(
  ljusLage,
  (l, old) => {
    // Skarpt slut → lila lek: `klar` (en gång; sätter själv basen lila). Gesten bara i
    // skrivaren; den andra skärmen spelar bara ljudet och följer basen lokalt.
    if (l === 'lek' && old !== 'lek') {
      if (arSkrivare(store.view)) ljus.gest('klar', ['A', 'B'])
      else {
        ljus.lage('lek')
        ljus.ljud('klar')
      }
    } else ljus.lage(l)
  },
  { immediate: true },
)

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

// Tutorial-loop (beat 2.2): låg bakgrundsbädd under instruktionen och provluckan (inte under
// spellägeskortet, där VALdi talar), tonas ut när skarpa rundan börjar. Eget HTMLAudio.
const ovar = computed(() => ['intro', 'prov'].includes(store.onbStage))
watch([stationMode, entered, ovar], ([m, isIn, o]) => {
  if (isIn && m === 'tutorial' && o) audio.bed('tutorial-loop.mp3', 0.18)
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
  if (hopp) {
    entered.value = true
    if (store.view !== 'lag2') store.onbGoto(hopp, Date.now() + 600)
  }
  window.addEventListener('contextmenu', onContextMenu)
  ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
})
onUnmounted(() => {
  window.removeEventListener('contextmenu', onContextMenu)
  ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
  audio.bedStop(0)
  store.dispose()
})
</script>

<template>
  <div class="app" :data-mode="stationMode">
    <!-- Entrén: attract (testgrupp + sidindelning) → rollval → valet → utfall -->
    <div v-if="!entreDone" class="app__single">
      <CrtScreen>
        <Entre :rollval="ROLLVAL" :overlay-sets="ROLLVAL_OVERLAY_SETS" :portratt-sets="ROLLVAL_PORTRATT_SETS" @start="entered = true" @done="onEntreDone">
          <template #attract="{ start }"><AttractScreen @start="start" /></template>
        </Entre>
      </CrtScreen>
    </div>

    <template v-else>
      <!-- Övningsmärkning: egen in-flow-rad högst upp (ALDRIG position:fixed över
           innehållet — det var därför lag-/valv-skyltar kunde täcka texten i test
           1). Syns HELA tutorialen och försvinner i samma stund spelet blir
           skarpt. Blå --mode-tutorial oavsett tema. -->
      <div v-if="!onboarded && ovar" class="app__practice" role="status">
        <span class="app__practice-dot" aria-hidden="true"></span>
        <span class="app__practice-main">{{ t('mode.testomgang') }}</span>
        <span class="app__practice-sub">{{ t('mode.practice_sub') }}</span>
      </div>

      <!-- Spelläget → instruktionen → provluckan före skarp körning -->
      <div v-if="!onboarded" class="app__single">
        <CrtScreen>
          <Onboarding :team="onboardTeam" />
        </CrtScreen>
      </div>

      <!-- Avslöjande: avslutet i fem takter (station-kit/resultat, XY-RESULTAT-OCH-VINST §2.3) —
           går av sig självt fram till vinnaren, samma takter på båda skärmarna. -->
      <div v-else-if="showReveal" class="app__single">
        <CrtScreen><ForhandlingAvslut @finish="onLiveFinish" /></CrtScreen>
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
      :under="t('mode.golive_under')"
      :from="3"
      @done="showGoLive = false"
    >
      <template #symbol><SpellageSymbol lage="tavling" :size="150" /></template>
    </ModeCountdown>

    <!-- Rotationen: väntar / lek (overlay; "Testgrupp X — tryck" visas av entrén) -->
    <RotationScreens station-title="Förhandlingen">
      <template #lek>
        <VemDarLek :people="lekPeople" :my-side="lekSide" :leader="lekLeader" :transport="store.transport()" />
      </template>
    </RotationScreens>
    <!-- Mikrofonsynkens testvy (bara med ?mik=visa) -->
    <MikTest v-if="MIK_LAGE === 'visa'" />
    <!-- Ljusförhandsvisning (renderar bara med ?ljus=visa) -->
    <LjusRemsa />
    <!-- Regis filmer (trailern) över allt, bara i filmens fas -->
    <!-- Incheckningen: "Ta ditt band" medan regi står i incheckningen -->
    <IncheckningScreen station-title="Förhandlingen" :side-labels="{ A: ENTRE.sides?.A?.label, B: ENTRE.sides?.B?.label }" />
    <FilmOverlay />
    <LekStandalone v-if="lekPreview && store.transport()">
      <VemDarLek :people="lekPeople" :my-side="lekSide" :leader="lekLeader" :transport="store.transport()" />
    </LekStandalone>
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
