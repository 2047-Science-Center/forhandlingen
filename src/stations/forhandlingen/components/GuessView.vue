<script setup lang="ts">
/**
 * Gissningen efter sista luckan: varje sidas rapportör pekar ut motståndarens
 * livsviktiga resurs. Rätt gissning dubblar sidans poäng. Tidsgräns (ROUND_TIMERS.live.guess):
 * den som inte hunnit gissa har gissat fel, och stationen går vidare av sig själv.
 */
import { ref, computed } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import VaraBild from './VaraBild.vue'
import { useI18n } from '@/station-kit/i18n'
import { useLjus } from '@/station-kit/ljus'
import { SIDA_FOR_LAG } from '../ljus'

const props = defineProps<{ team: TeamId }>()
const store = useGameStore()
const { t } = useI18n()

const pick = ref<string | null>(null)
const locked = computed(() => store.state.guesses[props.team] != null)
const sekunder = computed(() => store.secondsLeft)

const ljus = useLjus()
function submit() {
  if (!pick.value) return
  store.submitGuess(props.team, pick.value)
  // Händer bara i det här fönstret → kvitto på egen sida, med ljud (§5.1).
  ljus.gest('kvitto', [SIDA_FOR_LAG[props.team]])
}
</script>

<template>
  <div class="guess">
    <div class="guess__head">
      <h3 class="guess__title">{{ t('guess.title') }}</h3>
      <span v-if="sekunder != null" class="guess__tid mono" :class="{ 'guess__tid--slut': sekunder <= 5 }">{{ sekunder }} s</span>
    </div>

    <template v-if="!locked">
      <p class="guess__prompt">{{ t('guess.prompt') }}</p>
      <div class="guess__grid">
        <button
          v-for="res in store.state.order"
          :key="res"
          class="guess__opt amber-frame"
          :class="{ 'guess__opt--sel': pick === res }"
          @click="pick = res"
        >
          <VaraBild :vara="res" :size="72" />
          <span>{{ t('resource.' + res) }}</span>
          <span v-if="pick === res" class="guess__x2">×2?</span>
        </button>
      </div>
      <button class="crt-button crt-button--strong" :disabled="!pick" @click="submit">
        {{ t('guess.submit') }}
      </button>
    </template>

    <div v-else class="guess__last">
      <span class="guess__lastkort"><VaraBild :vara="store.state.guesses[team] ?? ''" :size="110" /></span>
      <p class="guess__locked crt-caret">{{ t('guess.locked') }}</p>
    </div>
  </div>
</template>

<style scoped>
.guess {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
/* Explicit färg (ej ärvd från body) så läges-temat följer med: blått i
   tutorial, bärnsten i skarpt — annars ärvs body:s skarpa färg även i övning. */
.guess__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.guess__tid {
  font-size: 1.8rem;
  color: var(--color-ink-strong);
}
.guess__tid--slut {
  color: var(--color-danger);
}
.guess__title {
  font-size: 1.6rem;
  margin: 0;
  color: var(--color-primary);
}
.guess__prompt {
  font-size: 1.2rem;
  margin: 0;
  color: var(--color-ink-muted);
}
.guess__role {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  padding: 0.25em 0.8em;
  border: 1px solid var(--color-primary);
  border-radius: 999px;
  background: rgba(var(--mode-accent-rgb), 0.08);
}
.guess__rolelabel {
  font-family: var(--font-retro);
  font-size: 1rem;
  letter-spacing: 0.08em;
  color: var(--color-primary);
}
.guess__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
  gap: 0.6rem;
}
.guess__opt {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.8rem 0.4rem;
  cursor: pointer;
  color: var(--color-primary);
  font-family: var(--font-retro);
  font-size: 1.05rem;
}
.guess__opt--sel {
  border-color: var(--color-ink-strong);
  box-shadow: 0 0 14px rgba(245, 245, 240, 0.4);
  color: var(--color-ink-strong);
}
.guess__x2 {
  position: absolute;
  top: -0.6rem;
  right: -0.4rem;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.3rem;
  color: #fff;
  background: #ff3cc8;
  border-radius: 8px;
  padding: 0 0.35em;
}
.guess__last {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}
.guess__lastkort {
  padding: 0.6rem;
  border-radius: 14px;
  border: 2px solid #ff3cc8;
  box-shadow: 0 0 22px rgba(255, 60, 200, 0.35);
}
.guess__locked {
  font-size: 1.3rem;
  color: var(--color-ink-strong);
}
</style>
