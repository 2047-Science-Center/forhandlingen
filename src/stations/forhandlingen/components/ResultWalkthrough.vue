<script setup lang="ts">
/**
 * Result-genomgång — stegar EN beat i taget över det RIKTIGA resultat-UI:t
 * (samma kort/layout som förr låg i ResultView). Återanvänds på TVÅ ställen:
 *   - efter testomgången (mode="test" → knappen leder till skarpt spel),
 *   - efter det skarpa spelet (mode="live" → knappen nollställer stationen).
 *
 * Beats (ackumulerande — tidigare rader står kvar):
 *   0 · "Fick ni tag på er livsviktiga?"  → säkrad/ej säkrad (ej säkrad = 0 p)
 *   1 · "Hur mycket pengar har ni kvar?"  → kapital kvar = poäng
 *   2 · "Gissade ni rätt?"                → rätt/fel gissning (×2 vid rätt)
 *   3 · "Och vinnaren …"                  → vinnar-rubrik + lagpoäng
 *
 * Varje beat exponerar ett NAMNGIVET reveal-ögonblick för ljud: komponenten
 * emit:ar `reveal` med beat-namnet OCH spelar en SFX-platshållare. Agent 3 kan
 * lyssna på `@reveal` (namnen: 'secured' | 'capital' | 'guess' | 'winner') och
 * haka i röst/ljud utan att röra denna komponent.
 */
import { ref, computed, watch, onMounted } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { scoreAll } from '../engine/scoring'
import { resourceIcon } from '../resources'
import { useI18n } from '@/station-kit/i18n'
import { audio } from '@/station-kit/audio/AudioEngine'

defineProps<{ mode: 'test' | 'live' }>()
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

// --- Beats (ett namngivet reveal-ögonblick per steg) ---
const BEATS = ['secured', 'capital', 'guess', 'winner'] as const
const CAPTIONS = ['walk.step_secured', 'walk.step_capital', 'walk.step_guess', 'walk.step_winner']
const SFX = { secured: 'stamp', capital: 'blip', guess: 'confirm', winner: 'win' } as const

const beat = ref(0)
const last = computed(() => beat.value >= BEATS.length - 1)

function fire(i: number) {
  const name = BEATS[i]
  emit('reveal', name)
  audio.play(SFX[name])
}
onMounted(() => fire(0))
watch(beat, (i) => fire(i))

function next() {
  if (last.value) emit('finish')
  else beat.value += 1
}
</script>

<template>
  <div class="rw">
    <h2 class="rw__title ink-strong">{{ t('reveal.title') }}</h2>
    <p class="rw__caption">{{ t(CAPTIONS[beat]) }}</p>

    <!-- Vinnare: avslöjas sist (beat 3) -->
    <div v-if="beat >= 3" class="rw__winner" :class="{ 'is-draw': winner === 'draw' }">
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
          <!-- beat 0: säkrad / ej säkrad -->
          <li
            v-if="beat >= 0"
            class="rw__cond rw__cond--in"
            :class="scores[id].securedCritical ? 'ok' : 'bad'"
          >
            <span class="rw__mark">{{ scores[id].securedCritical ? '✓' : '✗' }}</span>
            <span>{{ scores[id].securedCritical ? t('reveal.cond_secured') : t('reveal.cond_not_secured') }}</span>
          </li>

          <template v-if="scores[id].securedCritical">
            <!-- beat 1: kapital kvar = poäng -->
            <template v-if="beat >= 1">
              <li v-if="paidForCritical(id) != null" class="rw__cond rw__cond--in neutral">
                <span class="rw__mark">💰</span>
                <span>{{ t('reveal.paid_for_critical', { n: paidForCritical(id) }) }}</span>
              </li>
              <li class="rw__cond rw__cond--in ok">
                <span class="rw__mark">✓</span>
                <span>{{ t('reveal.cond_capital', { n: scores[id].capitalLeft }) }}</span>
              </li>
            </template>

            <!-- beat 2: gissning → ×2 -->
            <li
              v-if="beat >= 2"
              class="rw__cond rw__cond--in"
              :class="scores[id].guessedRight ? 'ok' : 'bad'"
            >
              <span class="rw__mark">{{ scores[id].guessedRight ? '×2' : '✗' }}</span>
              <span>{{ scores[id].guessedRight ? t('reveal.cond_guess_right') : t('reveal.cond_guess_wrong') }}</span>
            </li>
          </template>
        </ul>

        <!-- Lagpoäng avslöjas med vinnaren (beat 3) -->
        <p v-if="beat >= 3" class="rw__score mono ink-strong rw__cond--in">
          {{ t('reveal.points', { n: scores[id].teamScore }) }}
        </p>
      </section>
    </div>

    <button class="crt-button crt-button--strong rw__btn" @click="next">
      <template v-if="!last">{{ t('onboarding.next') }} ▸</template>
      <template v-else-if="mode === 'test'">{{ t('reveal.to_live') }} ▸</template>
      <template v-else>{{ t('reveal.play_again') }}</template>
    </button>
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
.rw__caption {
  margin: 0;
  font-family: var(--font-retro);
  font-size: 1.4rem;
  letter-spacing: 0.04em;
  color: var(--color-primary);
  text-shadow: var(--glow-soft);
  text-align: center;
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
  animation: rw-in 0.4s ease-out;
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
}
.rw__cond--in {
  animation: rw-in 0.35s ease-out;
}
.rw__mark {
  flex: none;
  min-width: 1.6rem;
  font-family: var(--font-retro);
  text-align: center;
}
.rw__cond.ok {
  color: var(--color-ink-strong);
}
.rw__cond.ok .rw__mark {
  color: var(--color-primary);
}
.rw__cond.bad {
  color: var(--color-danger);
}
.rw__cond.bad .rw__mark {
  color: var(--color-danger);
}
.rw__cond.neutral {
  color: var(--color-ink-muted);
}
.rw__score {
  font-size: 1.8rem;
  margin: 0.2rem 0 0;
}
.rw__btn {
  margin-top: 0.5rem;
}
@keyframes rw-in {
  from { opacity: 0; transform: translateY(6px); }
}
@media (prefers-reduced-motion: reduce) {
  .rw__winner,
  .rw__cond--in {
    animation: none;
  }
}
</style>
