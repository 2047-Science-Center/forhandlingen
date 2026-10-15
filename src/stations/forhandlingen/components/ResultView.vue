<script setup lang="ts">
/**
 * Avslöjande & resultat (§4.5.5). Åtgärdar "oklart vem som vann" från
 * testomgång 1: en tydlig VINNARE-rubrik överst, och per valv en "Varför?"-lista
 * som kopplar utfallet till de TRE vinstvillkoren (samma formulering som i
 * öppningens recap):
 *   1) livsviktig säkrad (annars 0 poäng), 2) kapital kvar = poäng,
 *   3) rätt gissning = dubbel poäng. Slutpris för egen livsviktig visas.
 */
import { computed } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { scoreAll } from '../engine/scoring'
import { resourceIcon } from '../resources'
import { useI18n } from '@/station-kit/i18n'

const store = useGameStore()
const { t } = useI18n()

const scores = computed(() => scoreAll(store.state))
const teams: TeamId[] = ['lag1', 'lag2']

/** Vinnare = högst lagpoäng; lika → oavgjort. */
const winner = computed<TeamId | 'draw'>(() => {
  const a = scores.value.lag1.teamScore
  const b = scores.value.lag2.teamScore
  if (a === b) return 'draw'
  return a > b ? 'lag1' : 'lag2'
})

function teamLabel(id: TeamId): string {
  return store.teamName(id)
}

/** Slutpris laget betalade för sin egen livsviktiga (null om ej säkrad). */
function paidForCritical(id: TeamId): number | null {
  const crit = store.state.critical[id]
  const r = Object.values(store.state.results).find(
    (x) => x.winner === id && x.resource === crit,
  )
  return r ? r.price : null
}
</script>

<template>
  <div class="result">
    <h2 class="result__title ink-strong">{{ t('reveal.title') }}</h2>

    <!-- Tydlig vinnare överst -->
    <div class="result__winner" :class="{ 'is-draw': winner === 'draw' }">
      <template v-if="winner === 'draw'">{{ t('reveal.draw') }}</template>
      <template v-else>
        {{ t('reveal.winner_is', { team: teamLabel(winner) }) }}
        <span class="result__winner-pts">{{ t('reveal.points', { n: scores[winner].teamScore }) }}</span>
      </template>
    </div>

    <div class="result__teams">
      <section
        v-for="id in teams"
        :key="id"
        class="result__team amber-frame"
        :class="{ 'is-winner': winner === id }"
      >
        <header class="result__head">
          <span>{{ teamLabel(id) }}</span>
          <span v-if="winner === id" class="result__crown">★</span>
        </header>

        <p class="result__score mono ink-strong">
          {{ t('reveal.points', { n: scores[id].teamScore }) }}
        </p>

        <p class="result__crit">
          <span class="result__icon">{{ resourceIcon(store.state.critical[id]) }}</span>
          {{ t('reveal.critical_was', { team: teamLabel(id), resource: t('resource.' + store.state.critical[id]) }) }}
        </p>

        <!-- Varför: kopplat till de tre vinstvillkoren -->
        <span class="result__whylabel">{{ t('reveal.why') }}</span>
        <ul class="result__why">
          <li class="result__cond" :class="scores[id].securedCritical ? 'ok' : 'bad'">
            <span class="result__mark">{{ scores[id].securedCritical ? '✓' : '✗' }}</span>
            <span>{{ scores[id].securedCritical ? t('reveal.cond_secured') : t('reveal.cond_not_secured') }}</span>
          </li>

          <template v-if="scores[id].securedCritical">
            <li v-if="paidForCritical(id) != null" class="result__cond neutral">
              <span class="result__mark">💰</span>
              <span>{{ t('reveal.paid_for_critical', { n: paidForCritical(id) }) }}</span>
            </li>
            <li class="result__cond ok">
              <span class="result__mark">✓</span>
              <span>{{ t('reveal.cond_capital', { n: scores[id].capitalLeft }) }}</span>
            </li>
            <li class="result__cond" :class="scores[id].guessedRight ? 'ok' : 'bad'">
              <span class="result__mark">{{ scores[id].guessedRight ? '×2' : '✗' }}</span>
              <span>{{ scores[id].guessedRight ? t('reveal.cond_guess_right') : t('reveal.cond_guess_wrong') }}</span>
            </li>
          </template>
        </ul>
      </section>
    </div>

    <button
      v-if="store.isTrial"
      class="crt-button crt-button--strong result__again"
      @click="store.startLive()"
    >
      {{ t('reveal.to_live') }} ▸
    </button>
    <button v-else class="crt-button crt-button--strong result__again" @click="store.reset()">
      {{ t('reveal.play_again') }}
    </button>
  </div>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  align-items: center;
}
.result__title {
  font-size: 2rem;
  margin: 0;
  letter-spacing: 0.08em;
}
.result__winner {
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
.result__winner.is-draw {
  color: var(--color-ink-muted);
}
.result__winner-pts {
  font-family: var(--font-mono);
  font-size: 1.2rem;
  color: var(--color-primary);
}
.result__teams {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
  width: 100%;
}
.result__team {
  border-top: 4px solid var(--color-primary-dim);
  padding: 1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.result__team.is-winner {
  border-top-color: var(--color-primary);
  box-shadow: 0 0 22px rgba(var(--mode-accent-rgb), 0.3);
}
.result__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-primary);
  font-size: 1.4rem;
  text-shadow: var(--glow-soft);
}
.result__crown {
  color: var(--color-primary);
  text-shadow: var(--glow-strong);
}
.result__score {
  font-size: 2rem;
  margin: 0;
  color: var(--color-ink-strong);
}
.result__crit {
  font-size: 1.1rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-ink-muted);
}
.result__icon {
  font-size: 1.5rem;
}
.result__whylabel {
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  color: var(--color-ink-muted);
  margin-top: 0.2rem;
}
.result__why {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.result__cond {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 1.05rem;
  line-height: 1.3;
}
.result__mark {
  flex: none;
  min-width: 1.6rem;
  font-family: var(--font-retro);
  text-align: center;
}
.result__cond.ok { color: var(--color-ink-strong); }
.result__cond.ok .result__mark { color: var(--color-primary); }
.result__cond.bad { color: var(--color-danger); }
.result__cond.bad .result__mark { color: var(--color-danger); }
.result__cond.neutral { color: var(--color-ink-muted); }
.result__again {
  margin-top: 0.5rem;
}
</style>
