<script setup lang="ts">
/**
 * Förhandlingens väg från entrén till skarpt läge (per skärm, synkat mellan sidorna).
 * ANALYS-FLODE-2026-11 förslag 1, 3, 4, 5 och 6:
 *
 *   'lage'     båda skärmarna samlas ("Väntar på sida B …", auto-vidare efter VANTA_MAX_SEKUNDER)
 *   'lagekort' spellägeskortet TÄVLING (HyperFrames-film med VALdi), samma epoch på båda skärmarna
 *   'intro'    instruktionen i fem steg, självtempo per skärm, NÄSTA och TILLBAKA:
 *                1–3 bildreglerna (Måste ha · Kvar = poäng · Rätt gissning ×2, BildRegler.vue)
 *                4 "Så går en lucka" i 3D · 5 luckväggen: ni budar på riktigt → VI ÄR REDO
 *              → väntar in andra sidan (auto-vidare)
 *   'prov'     EN provlucka på den riktiga konsolen. Handlingen är spärren: när luckan är
 *              klubbad visas kvittensen och KÖR SKARPT (auto-vidare).
 *   'live'     → skarpt (appen kör nedräkningen).
 */
import { ref, computed, watch } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { TRIAL_DATASET, TEAMS, VANTA_MAX_SEKUNDER, ROTATION } from '@/config'
import { useI18n } from '@/station-kit/i18n'
import { audio } from '@/station-kit/audio/AudioEngine'
import { useLjus } from '@/station-kit/ljus'
import { useRotation, DEFAULT_ORDER } from '@/station-kit/rotation/rotation'
import { kortFil } from '@/station-kit/spellage/spellage'

import CoachMark from '@/station-kit/components/CoachMark.vue'
import SpellageKort from '@/station-kit/spellage/SpellageKort.vue'
import RoleIcon from '../components/RoleIcon.vue'
import CoachAnim from '../components/CoachAnim.vue'
import ReporterConsole from '../components/ReporterConsole.vue'
import Lucka3D from './Lucka3D.vue'
import BildRegler from './BildRegler.vue'
import BarrierWait from './BarrierWait.vue'
import { resourceIcon } from '../resources'
import { egnaSidor } from '../ljus'

const props = defineProps<{ team: TeamId }>()
const emit = defineEmits<{ complete: [] }>()
const store = useGameStore()
const { t } = useI18n()
const ljus = useLjus()
const rotation = useRotation()

const me = computed(() => props.team)
const shared = computed(() => store.view === 'shared')
const leader = computed(() => shared.value || me.value === 'lag1')
const stage = computed(() => store.onbStage)
const other = computed<TeamId>(() => (me.value === 'lag1' ? 'lag2' : 'lag1'))
const otherSida = computed(() => TEAMS[other.value].name)
const iAmReady = computed(() => store.onbReady[me.value])
const bothReady = computed(() => iAmReady.value && (shared.value || store.onbReady[other.value]))

// ---------- Väntpunkter med auto-vidare (förslag 6) ----------
/** När den här skärmen blev klar i aktuell väntpunkt (epoch-ms), annars null. */
const redoSedan = ref<number | null>(null)
const vantaKvar = computed(() =>
  redoSedan.value == null ? null : Math.max(0, VANTA_MAX_SEKUNDER - Math.floor((store.now - redoSedan.value) / 1000)),
)
function jagArRedo() {
  if (redoSedan.value == null) redoSedan.value = Date.now()
  store.onbMarkReady(me.value)
}
/** Båda klara, eller tiden ute → nästa stage (vilken skärm som helst; onbGoto är idempotent). */
function vidareNar(fran: string, till: string, epoch: () => number | null = () => null) {
  watch([bothReady, vantaKvar, stage], () => {
    if (stage.value !== fran || !iAmReady.value) return
    if (bothReady.value || vantaKvar.value === 0) store.onbGoto(till, epoch())
  })
}

// ---------- 'lage': samling → spellägeskortet ----------
watch(
  stage,
  (s) => {
    redoSedan.value = null
    if (s === 'lage') jagArRedo()
  },
  { immediate: true },
)
vidareNar('lage', 'lagekort', () => Date.now() + 600)
const kortSrc = computed(
  () => `${import.meta.env.BASE_URL}media/spellage/${kortFil(ROTATION.stationN, rotation.state.round, DEFAULT_ORDER)}`,
)
function kortKlart() {
  if (stage.value === 'lagekort') store.onbGoto('intro', null)
}

// ---------- 'intro': instruktionen i fyra steg ----------
const introSteg = ref(0)
const ANTAL_STEG = 5
const DEMO_RESURS = 'styrkort'
const demoCritical = computed(() => (me.value === 'lag1' ? TRIAL_DATASET.kritisk_lag1 : TRIAL_DATASET.kritisk_lag2))

type AnimKind = 'market' | 'critical' | 'capital' | 'guess'
interface CoachSpec {
  target: string
  title: string
  body: string
  reinforce?: string
  role?: 'A' | 'B'
  anim: AnimKind
  animRes?: string
  cta?: string
}
const demoMotCritical = computed(() => (me.value === 'lag1' ? TRIAL_DATASET.kritisk_lag2 : TRIAL_DATASET.kritisk_lag1))
/** Steg 0–2 = bildreglerna, 3 = 3D-luckan, 4 = coach-mark på luckväggen + VI ÄR REDO. */
const visa = computed<'regler' | 'lucka3d' | 'coach'>(() => (introSteg.value <= 2 ? 'regler' : introSteg.value === 3 ? 'lucka3d' : 'coach'))
const coach = computed<CoachSpec>(() => ({
  target: '[data-tut="luckor"]',
  title: t('coach.market_title'),
  body: t('coach.market_body'),
  reinforce: t('coach.headset_line'),
  role: 'A',
  anim: 'market',
  animRes: DEMO_RESURS,
  cta: t('opening.ready'),
}))
function introNasta() {
  audio.play('blip')
  if (introSteg.value < ANTAL_STEG - 1) {
    introSteg.value += 1
    return
  }
  // Sista steget: headset på → klar → vänta in andra sidan.
  audio.play('headset')
  ljus.gest('kvitto', egnaSidor(store.view), { tyst: true })
  jagArRedo()
}
function introTillbaka() {
  audio.play('blip')
  if (introSteg.value > 0) introSteg.value -= 1
}
watch(stage, (s) => {
  if (s === 'intro') introSteg.value = 0
})
vidareNar('intro', 'prov')

// ---------- 'prov': en provlucka, handlingen är spärren ----------
watch(
  stage,
  (s) => {
    if (s === 'prov' && leader.value && store.state.datasetId !== TRIAL_DATASET.id) store.startProv()
  },
  { immediate: true },
)
const provResultat = computed(() =>
  stage.value === 'prov' && store.state.datasetId === TRIAL_DATASET.id ? (store.state.results[0] ?? null) : null,
)
const provKlarSedan = ref<number | null>(null)
watch(provResultat, (r) => {
  if (r && provKlarSedan.value == null) {
    provKlarSedan.value = Date.now()
    audio.play('positive')
  }
  if (!r) provKlarSedan.value = null
})
const PROV_AUTO_S = 10
const provKvar = computed(() =>
  provKlarSedan.value == null ? null : Math.max(0, PROV_AUTO_S - Math.floor((store.now - provKlarSedan.value) / 1000)),
)
watch(provKvar, (n) => {
  if (n === 0) korSkarpt()
})
function korSkarpt() {
  if (stage.value === 'prov') store.onbGoto('live', null)
}
const provText = computed(() => {
  const r = provResultat.value
  if (!r) return ''
  const resurs = t('resource.' + r.resource)
  return r.winner
    ? t('prov.kopte', { sida: store.teamName(r.winner), resurs, pris: r.price })
    : t('prov.ingen', { resurs })
})

// ---------- 'live' ----------
watch(
  stage,
  (s) => {
    if (s === 'live') emit('complete')
  },
  { immediate: true },
)
</script>

<template>
  <div class="ob">
    <!-- ============ SAMLING + SPELLÄGESKORTET ============ -->
    <BarrierWait v-if="stage === 'lage'" :sida="otherSida" :sekunder="vantaKvar" />
    <SpellageKort
      v-else-if="stage === 'lagekort'"
      :src="kortSrc"
      :start-at="store.onbEpoch ?? Date.now()"
      :leader="leader"
      @done="kortKlart"
      @skip="kortKlart"
    />

    <!-- ============ INSTRUKTIONEN ============ -->
    <template v-else-if="stage === 'intro'">
      <BarrierWait v-if="iAmReady" :sida="otherSida" :sekunder="vantaKvar" />
      <BildRegler
        v-else-if="visa === 'regler'"
        :aktiv="introSteg"
        :steg="introSteg"
        :antal="ANTAL_STEG"
        :vara="demoCritical"
        :mot-vara="demoMotCritical"
        @next="introNasta"
        @back="introTillbaka"
      />
      <Lucka3D v-else-if="visa === 'lucka3d'" :step="introSteg" :steps="ANTAL_STEG" @next="introNasta" @back="introTillbaka" />
      <div v-else class="ob__stage">
        <ReporterConsole
          :team="me"
          demo="resource"
          :demo-capital="100"
          :demo-critical="demoCritical"
          :demo-resource="DEMO_RESURS"
        />
        <CoachMark
          :target="coach.target"
          :title="coach.title"
          :body="coach.body"
          :reinforce="coach.reinforce"
          :cta="coach.cta"
          :step="introSteg"
          :steps="ANTAL_STEG"
          :show-back="introSteg > 0"
          @next="introNasta"
          @back="introTillbaka"
        >
          <template #visual>
            <CoachAnim :key="coach.anim" :kind="coach.anim" :resource="coach.animRes" />
          </template>
          <template v-if="coach.role" #reinforce>
            <RoleIcon :role="coach.role" :size="40" />
          </template>
        </CoachMark>
      </div>
    </template>

    <!-- ============ PROVLUCKAN ============ -->
    <div v-else-if="stage === 'prov'" class="ob__stage">
      <div v-if="shared" class="ob__split">
        <ReporterConsole team="lag1" :allow-guess="false" />
        <ReporterConsole team="lag2" :allow-guess="false" />
      </div>
      <ReporterConsole v-else :team="me" :allow-guess="false" />

      <Transition name="ob-kv">
        <div v-if="provResultat" class="ob__kvitto" role="status">
          <p class="ob__kvitto-ovan">{{ t('prov.klar') }}</p>
          <p class="ob__kvitto-rad">
            <span class="ob__kvitto-ikon">{{ resourceIcon(provResultat.resource) }}</span>{{ provText }}
          </p>
          <ul class="ob__kvitto-lista">
            <li>{{ t('prov.skarpt1') }}</li>
            <li>{{ t('prov.skarpt2') }}</li>
          </ul>
          <button class="crt-button crt-button--strong ob__kor" @click="korSkarpt">
            {{ t('prov.kor') }} ▸ <small v-if="provKvar != null">{{ provKvar }}</small>
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.ob {
  height: 100%;
  position: relative;
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
.ob__kvitto {
  position: absolute;
  inset: 8% 10%;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
  background: rgba(4, 16, 14, 0.96);
  border: 2px solid var(--color-primary);
  border-radius: 16px;
  box-shadow: 0 0 40px rgba(var(--mode-accent-rgb), 0.35);
}
.ob__kvitto-ovan {
  margin: 0;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2.6rem;
  letter-spacing: 0.06em;
  color: var(--color-primary);
}
.ob__kvitto-rad {
  margin: 0;
  font-family: var(--font-retro);
  font-size: 2rem;
  color: var(--color-ink-strong);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.ob__kvitto-ikon {
  font-size: 2.4rem;
}
.ob__kvitto-lista {
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-retro);
  font-size: 1.4rem;
  line-height: 1.5;
  color: var(--color-ink-muted);
}
.ob__kor {
  font-size: 1.7rem;
  padding: 0.45em 2em;
  margin-top: 0.6rem;
}
.ob__kor small {
  opacity: 0.6;
  margin-left: 0.4em;
}
.ob-kv-enter-active {
  transition: opacity 220ms ease-out, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ob-kv-enter-from {
  opacity: 0;
  transform: scale(1.04);
}
@media (prefers-reduced-motion: reduce) {
  .ob-kv-enter-active { transition: none; }
}
</style>
