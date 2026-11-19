<script setup lang="ts">
/**
 * Result-genomgång — fungerar EXAKT som tutorial-coach-marks fast över det
 * RIKTIGA resultat-UI:t: en spotlight/CoachMark belyser EN del i taget
 * (säkrad/ej säkrad livsviktig → pengar kvar=poäng → gissning rätt/fel ×2 →
 * vinnare), med en bubbla som säger HUR det gick och VARFÖR + en liten
 * animation (CoachAnim: stämpel, pengar→poäng, ×2 — samma vokabulär som introt).
 *
 * Används efter testomgången (mode='test' → till skarpt spel). Efter det SKARPA spelet
 * visas sedan 2026-11-19 i stället ForhandlingAvslut (station-kit/resultat: går av sig
 * självt, samma takter på båda skärmarna). mode='live' finns kvar men är inte inkopplad.
 *
 * Varje beat exponerar ett NAMNGIVET reveal-ögonblick: emit('reveal', <namn>)
 * + SFX-platshållare, så Agent 3 kan haka i röst utan att röra komponenten
 * (namn: secured | capital | guess | winner).
 *
 * Ljus/ljud på winner-beaten (XY-FEEDBACK-LJUS-LJUD §5.1/§6): skrivarfönstret sätter
 * utfallet på underglow (vinnarsidan `vinst`, den andra `forlorarsida`, oavgjort båda);
 * varje fönster spelar sin sidas ljud (vinst/neutral). Skarpt läge: sista knappen tidigast
 * 8 s efter winner-beaten, auto-avslut efter 45 s (useResultatTid) → done skickas alltid.
 * OBS: beat-indexet är fortfarande lokalt per skärm (ej synkat mellan fönstren).
 */
import { ref, computed, watch, onMounted } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { scoreAll } from '../engine/scoring'
import { resourceIcon } from '../resources'
import { useI18n } from '@/station-kit/i18n'
import { audio } from '@/station-kit/audio/AudioEngine'
import CoachMark from '@/station-kit/components/CoachMark.vue'
import CoachAnim from './CoachAnim.vue'
import { useLjus, useResultatTid } from '@/station-kit/ljus'
import { arSkrivare, resultatLjud, utfallForResultat } from '../ljus'

const props = defineProps<{ mode: 'test' | 'live' }>()
const emit = defineEmits<{ finish: []; reveal: [name: string] }>()
const store = useGameStore()
const { t } = useI18n()

const scores = computed(() => scoreAll(store.state))
const teams: TeamId[] = ['lag1', 'lag2']

const winner = computed<TeamId | 'draw'>(() => {
  const a = scores.value.lag1.teamScore
  const b = scores.value.lag2.teamScore
  if (a === b) return 'draw'
  return a > b ? 'lag1' : 'lag2'
})

function teamLabel(id: TeamId): string {
  return store.teamName(id)
}
function paidForCritical(id: TeamId): number | null {
  const crit = store.state.critical[id]
  const r = Object.values(store.state.results).find((x) => x.winner === id && x.resource === crit)
  return r ? r.price : null
}

// --- Beats: ett namngivet reveal-ögonblick som spotlightar ETT element ---
type AnimKind = 'critical' | 'capital' | 'guess'
interface Beat {
  name: string
  target: string
  title: string
  body: string
  anim: AnimKind | null
}
const BEATS: Beat[] = [
  { name: 'secured', target: '[data-tut="res-secured"]', title: 'walk.step_secured', body: 'walk.body_secured', anim: 'critical' },
  { name: 'capital', target: '[data-tut="res-capital"]', title: 'walk.step_capital', body: 'walk.body_capital', anim: 'capital' },
  { name: 'guess', target: '[data-tut="res-guess"]', title: 'walk.step_guess', body: 'walk.body_guess', anim: 'guess' },
  { name: 'winner', target: '[data-tut="res-winner"]', title: 'walk.step_winner', body: 'walk.body_winner', anim: null },
]
// winner: inget Sfx här — utfallets ljud (vinst/neutral) spelas via ljuset nedan.
const SFX = { secured: 'stamp', capital: 'blip', guess: 'confirm', winner: null } as const

const beat = ref(0)
const spec = computed(() => BEATS[beat.value])
const last = computed(() => beat.value >= BEATS.length - 1)

// Representativ resurs för animationen (en säkrad livsviktig resp. en gissning).
const animCritical = computed(
  () => store.state.critical.lag1 || store.state.critical.lag2 || 'insulin',
)
const animGuess = computed(
  () => store.state.critical.lag2 || store.state.critical.lag1 || 'membranfilter',
)
const animRes = computed(() => (spec.value.anim === 'guess' ? animGuess.value : animCritical.value))

// Resultatrutans tider (§6) — bara skarpt läge (testets genomgång leder vidare till skarpt).
const live = props.mode === 'live'
let finished = false
function finish() {
  if (finished) return
  finished = true
  rt.stop()
  emit('finish')
}
const rt = useResultatTid({ onAuto: finish })
const locked = computed(() => live && last.value && !rt.kanGaVidare.value)

const ctaLabel = computed(() => {
  if (!last.value) return undefined
  const label = props.mode === 'test' ? t('reveal.to_live') : t('reveal.play_again')
  return locked.value ? `⏳ ${label}` : label
})

const ljus = useLjus()
/** Winner-beaten visas: utfallet på underglow (skrivaren) + den här sidans ljud. */
function visaUtfall() {
  if (arSkrivare(store.view)) {
    for (const u of utfallForResultat(winner.value)) ljus.utfall(u.utfall, u.ids, { tyst: true })
  }
  ljus.ljud(resultatLjud(winner.value, store.view))
}

function fire(i: number) {
  const name = BEATS[i].name as keyof typeof SFX
  emit('reveal', name)
  const sfx = SFX[name]
  if (sfx) audio.play(sfx)
  if (name === 'winner') {
    visaUtfall()
    if (live) rt.start()
  }
}
onMounted(() => fire(0))
watch(beat, (i) => fire(i))

function next() {
  if (!last.value) beat.value += 1
  else if (!locked.value) finish()
}
</script>

<template>
  <div class="rw">
    <h2 class="rw__title ink-strong">{{ t('reveal.title') }}</h2>

    <!-- Vinnar-rubrik: avslöjas på sista beaten (spotlightas då). -->
    <div
      v-if="beat >= 3"
      class="rw__winner"
      :class="{ 'is-draw': winner === 'draw' }"
      data-tut="res-winner"
    >
      <template v-if="winner === 'draw'">{{ t('reveal.draw') }}</template>
      <template v-else>
        {{ t('reveal.winner_is', { team: teamLabel(winner) }) }}
        <span class="rw__winner-pts">{{ t('reveal.points', { n: scores[winner].teamScore }) }}</span>
      </template>
    </div>

    <div class="rw__teams">
      <section
        v-for="id in teams"
        :key="id"
        class="rw__team amber-frame"
        :class="{ 'is-winner': beat >= 3 && winner === id }"
      >
        <header class="rw__head">
          <span>{{ teamLabel(id) }}</span>
          <span v-if="beat >= 3 && winner === id" class="rw__crown">★</span>
        </header>

        <p class="rw__crit">
          <span class="rw__icon">{{ resourceIcon(store.state.critical[id]) }}</span>
          {{ t('reveal.critical_was', { team: teamLabel(id), resource: t('resource.' + store.state.critical[id]) }) }}
        </p>

        <ul class="rw__why">
          <!-- säkrad / ej säkrad -->
          <li class="rw__cond" :class="scores[id].securedCritical ? 'ok' : 'bad'" data-tut="res-secured">
            <span class="rw__mark">{{ scores[id].securedCritical ? '✓' : '✗' }}</span>
            <span>{{ scores[id].securedCritical ? t('reveal.cond_secured') : t('reveal.cond_not_secured') }}</span>
          </li>

          <template v-if="scores[id].securedCritical">
            <!-- pengar kvar = poäng (paid + kept grupperat) -->
            <li class="rw__cond rw__cond--group" data-tut="res-capital">
              <span v-if="paidForCritical(id) != null" class="rw__subline neutral">
                <span class="rw__mark">💰</span>
                <span>{{ t('reveal.paid_for_critical', { n: paidForCritical(id) }) }}</span>
              </span>
              <span class="rw__subline ok">
                <span class="rw__mark">✓</span>
                <span>{{ t('reveal.cond_capital', { n: scores[id].capitalLeft }) }}</span>
              </span>
            </li>

            <!-- gissning → ×2 -->
            <li class="rw__cond" :class="scores[id].guessedRight ? 'ok' : 'bad'" data-tut="res-guess">
              <span class="rw__mark">{{ scores[id].guessedRight ? '×2' : '✗' }}</span>
              <span>{{ scores[id].guessedRight ? t('reveal.cond_guess_right') : t('reveal.cond_guess_wrong') }}</span>
            </li>
          </template>
        </ul>

        <!-- Lagpoäng avslöjas med vinnaren (beat 3). -->
        <p v-if="beat >= 3" class="rw__score mono ink-strong">
          {{ t('reveal.points', { n: scores[id].teamScore }) }}
        </p>
      </section>
    </div>

    <!-- Spotlight-overlay: belyser EN del i taget med bubbla + animation. -->
    <CoachMark
      :target="spec.target"
      :title="t(spec.title)"
      :body="t(spec.body)"
      :cta="ctaLabel"
      :step="beat"
      :steps="BEATS.length"
      @next="next"
    >
      <template v-if="spec.anim" #visual>
        <CoachAnim :key="spec.anim" :kind="spec.anim" :resource="animRes" />
      </template>
    </CoachMark>
  </div>
</template>

<style scoped>
.rw {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}
.rw__title {
  font-size: 2rem;
  margin: 0;
  letter-spacing: 0.08em;
}
.rw__winner {
  font-family: var(--font-retro);
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  letter-spacing: 0.06em;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-strong);
  padding: 0.3em 1.2em;
  border: 2px solid var(--color-primary);
  border-radius: 12px;
  background: var(--color-background-2);
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  flex-wrap: wrap;
  justify-content: center;
  text-align: center;
}
.rw__winner.is-draw {
  color: var(--color-ink-muted);
}
.rw__winner-pts {
  font-family: var(--font-mono);
  font-size: 1.2rem;
  color: var(--color-primary);
}
.rw__teams {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
  width: 100%;
}
.rw__team {
  border-top: 4px solid var(--color-primary-dim);
  padding: 1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.rw__team.is-winner {
  border-top-color: var(--color-primary);
  box-shadow: 0 0 22px rgba(var(--mode-accent-rgb), 0.3);
}
.rw__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-primary);
  font-size: 1.4rem;
  text-shadow: var(--glow-soft);
}
.rw__crown {
  color: var(--color-primary);
  text-shadow: var(--glow-strong);
}
.rw__crit {
  font-size: 1.1rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-ink-muted);
}
.rw__icon {
  font-size: 1.5rem;
}
.rw__why {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.rw__cond {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 1.05rem;
  line-height: 1.3;
  border-radius: 8px;
}
.rw__cond--group {
  flex-direction: column;
  gap: 0.2rem;
}
.rw__subline {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}
.rw__mark {
  flex: none;
  min-width: 1.6rem;
  font-family: var(--font-retro);
  text-align: center;
}
.rw__cond.ok,
.rw__subline.ok {
  color: var(--color-ink-strong);
}
.rw__cond.ok .rw__mark,
.rw__subline.ok .rw__mark {
  color: var(--color-primary);
}
.rw__cond.bad {
  color: var(--color-danger);
}
.rw__cond.bad .rw__mark {
  color: var(--color-danger);
}
.rw__subline.neutral {
  color: var(--color-ink-muted);
}
.rw__score {
  font-size: 1.8rem;
  margin: 0.2rem 0 0;
}
</style>
