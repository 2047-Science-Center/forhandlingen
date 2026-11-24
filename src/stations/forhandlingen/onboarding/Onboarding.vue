<script setup lang="ts">
/**
 * Förhandlingens väg från entrén till skarpt läge (per skärm, synkat mellan sidorna).
 *
 *   'lage'     båda skärmarna samlas ("Väntar på sida B …", auto-vidare efter VANTA_MAX_SEKUNDER)
 *   'lagekort' spellägeskortet TÄVLING (HyperFrames-film med VALdi), samma epoch på båda skärmarna
 *   'regler'   de tre bildreglerna (Måste ha · Kvar = poäng · Rätt gissning ×2, BildRegler.vue), självtempo
 *              per skärm med NÄSTA/TILLBAKA → väntar in andra sidan (auto-vidare)
 *   'exempel'  EXEMPELFÖRHANDLINGEN (~1 min, exempel/Exempel.vue): en förinspelad runda som visar hur man
 *              tänker — bluffen, samrådet och rapportörens gissning. Samma epoch på båda skärmarna.
 *   'redo'     "Er tur": sändebud headset på, rapportören sköter skärmen → VI ÄR REDO (auto-vidare)
 *   'prov'     (bara om PROVLUCKA) EN provlucka på den riktiga konsolen, kvittens + KÖR SKARPT
 *   'live'     → skarpt (appen kör nedräkningen).
 * Exemplet kommer EFTER reglerna, som "så här ser det ut" (Josef 2026-11-24); det ersätter 3D-luckan och coach-marken.
 */
import { ref, computed, watch } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { TRIAL_DATASET, TEAMS, VANTA_MAX_SEKUNDER, ROTATION, PROVLUCKA } from '@/config'
import { useI18n } from '@/station-kit/i18n'
import { audio } from '@/station-kit/audio/AudioEngine'
import { useLjus } from '@/station-kit/ljus'
import { useRotation, DEFAULT_ORDER } from '@/station-kit/rotation/rotation'
import { kortFil } from '@/station-kit/spellage/spellage'

import SpellageKort from '@/station-kit/spellage/SpellageKort.vue'
import SidFigur from '../components/SidFigur.vue'
import Exempel from '../exempel/Exempel.vue'
import BildRegler from './BildRegler.vue'
import manus from '../exempel/manus.json'
import ReporterConsole from '../components/ReporterConsole.vue'
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
const minSida = computed<'A' | 'B'>(() => (me.value === 'lag2' ? 'B' : 'A'))
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
  kortKlartTill()
}

// ---------- 'regler': tre bildregler, självtempo → exemplet ----------
function kortKlartTill() {
  if (stage.value === 'lagekort') store.onbGoto('regler', null)
}
const REGEL_ANTAL = 3
const regelSteg = ref(0)
/** Samma varor som i exemplet: A:s livsviktiga (insulin) och den B gissas ha (styrkortet). */
const regelVara = manus.livsviktig.A
const regelMotVara = manus.livsviktig.B
function regelNasta() {
  audio.play('blip')
  if (regelSteg.value < REGEL_ANTAL - 1) regelSteg.value += 1
  else jagArRedo()
}
function regelTillbaka() {
  audio.play('blip')
  if (regelSteg.value > 0) regelSteg.value -= 1
}
watch(stage, (s) => {
  if (s === 'regler') regelSteg.value = 0
})
vidareNar('regler', 'exempel', () => Date.now() + 600)

// ---------- 'exempel' → 'redo' ----------
function exempelKlart() {
  if (stage.value === 'exempel') store.onbGoto('redo', null)
}
function redo() {
  audio.play('headset')
  ljus.gest('kvitto', egnaSidor(store.view), { tyst: true })
  jagArRedo()
}
vidareNar('redo', PROVLUCKA ? 'prov' : 'live')

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

    <!-- ============ BILDREGLERNA ============ -->
    <template v-else-if="stage === 'regler'">
      <BarrierWait v-if="iAmReady" :sida="otherSida" :sekunder="vantaKvar" />
      <BildRegler
        v-else
        :aktiv="regelSteg"
        :steg="regelSteg"
        :antal="REGEL_ANTAL"
        :vara="regelVara"
        :mot-vara="regelMotVara"
        @next="regelNasta"
        @back="regelTillbaka"
      />
    </template>

    <!-- ============ EXEMPELFÖRHANDLINGEN ============ -->
    <Exempel
      v-else-if="stage === 'exempel'"
      :start-at="store.onbEpoch ?? Date.now()"
      :leader="leader"
      :min-sida="minSida"
      @done="exempelKlart"
      @skip="exempelKlart"
    />

    <!-- ============ ER TUR ============ -->
    <template v-else-if="stage === 'redo'">
      <BarrierWait v-if="iAmReady" :sida="otherSida" :sekunder="vantaKvar" />
      <div v-else class="ob__redo">
        <p class="ob__redo-rubrik">{{ t('redo.rubrik') }}</p>
        <div class="ob__roller">
          <div class="ob__roll">
            <SidFigur :sida="minSida" :size="130" pratar />
            <b>{{ t('redo.sandebud') }}</b>
            <span>{{ t('redo.sandebud_text') }}</span>
          </div>
          <div class="ob__roll">
            <SidFigur :sida="minSida" :size="130" :headset="true" />
            <b>{{ t('redo.rapportor') }}</b>
            <span>{{ t('redo.rapportor_text') }}</span>
          </div>
        </div>
        <button class="crt-button crt-button--strong ob__kor" @click="redo">{{ t('opening.ready') }} ▸</button>
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
.ob__redo {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.6rem;
}
.ob__redo-rubrik {
  margin: 0;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 3rem;
  color: var(--color-primary);
}
.ob__roller {
  display: flex;
  gap: 4rem;
}
.ob__roll {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  max-width: 18rem;
  text-align: center;
}
.ob__roll b {
  font-family: var(--font-rubrik);
  font-size: 1.8rem;
  color: var(--color-ink-strong);
}
.ob__roll span {
  font-family: var(--font-retro);
  font-size: 1.3rem;
  color: var(--color-ink-muted);
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
