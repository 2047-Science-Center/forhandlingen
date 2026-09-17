<script setup lang="ts">
/**
 * Avslöjande & resultat (§4.5.5): båda kritiska visas; poäng = kapital kvar,
 * dubblat vid rätt gissning; "säkrade sin kritiska?"-status.
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

function teamLabel(id: TeamId): string {
  return store.teamName(id)
}
</script>

<template>
  <div class="result">
    <h2 class="result__title ink-strong">{{ t('reveal.title') }}</h2>

    <div class="result__teams">
      <section
        v-for="id in teams"
        :key="id"
        class="result__team amber-frame"
      >
        <header class="result__head">{{ teamLabel(id) }}</header>

        <p class="result__crit">
          <span class="result__icon">{{ resourceIcon(store.state.critical[id]) }}</span>
          {{ t('reveal.critical_was', { team: teamLabel(id), resource: t('resource.' + store.state.critical[id]) }) }}
        </p>

        <p
          class="result__secured"
          :class="scores[id].securedCritical ? 'is-ok' : 'is-bad'"
        >
          {{ scores[id].securedCritical ? t('reveal.secured') : t('reveal.not_secured') }}
        </p>

        <!-- Gissning + kapital räknas bara när livsviktig är säkrad; annars är
             poängen alltid 0 och de raderna vore förvirrande. -->
        <template v-if="scores[id].securedCritical">
          <p class="result__guess">
            {{ scores[id].guessedRight ? t('reveal.guess_right') : t('reveal.guess_wrong') }}
          </p>
          <p class="result__capital mono">{{ t('reveal.capital_left', { n: scores[id].capitalLeft }) }}</p>
        </template>

        <p class="result__score mono ink-strong">
          {{ t('reveal.team_score', { n: scores[id].teamScore }) }}
        </p>

        <p v-if="!scores[id].securedCritical" class="result__lost">
          {{ t('reveal.round_lost') }}
        </p>
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
  gap: 1.25rem;
  align-items: center;
}
.result__title {
  font-size: 2rem;
  margin: 0;
  letter-spacing: 0.08em;
}
.result__teams {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 1rem;
  width: 100%;
}
.result__team {
  border-top: 4px solid var(--color-primary);
  padding: 1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.result__head {
  color: var(--color-primary);
  font-size: 1.4rem;
  text-shadow: var(--glow-soft);
}
.result__crit {
  font-size: 1.2rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.result__icon {
  font-size: 1.6rem;
}
.result__secured {
  font-size: 1.2rem;
  margin: 0;
}
.result__secured.is-ok {
  color: var(--color-ink-strong);
}
.result__secured.is-bad {
  color: var(--color-danger);
}
.result__guess,
.result__capital {
  margin: 0;
  color: var(--color-ink-muted);
}
.result__score {
  font-size: 1.6rem;
  margin: 0.2rem 0 0;
}
.result__lost {
  color: var(--color-danger);
  margin: 0;
}
.result__again {
  margin-top: 0.5rem;
}
</style>
