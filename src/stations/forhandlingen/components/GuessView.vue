<script setup lang="ts">
/**
 * Gissningsfas (§4.5.4): varje rapportör pekar ut motståndarens kritiska
 * resurs. Rätt gissning dubblar lagets poäng.
 */
import { ref, computed } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { resourceIcon } from '../resources'
import { useI18n } from '@/station-kit/i18n'

const props = defineProps<{ team: TeamId }>()
const store = useGameStore()
const { t } = useI18n()

const pick = ref<string | null>(null)
const locked = computed(() => store.state.guesses[props.team] != null)

function submit() {
  if (pick.value) store.submitGuess(props.team, pick.value)
}
</script>

<template>
  <div class="guess">
    <h3 class="guess__title">{{ t('guess.title') }}</h3>

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
          <span class="guess__icon">{{ resourceIcon(res) }}</span>
          <span>{{ t('resource.' + res) }}</span>
        </button>
      </div>
      <button class="crt-button crt-button--strong" :disabled="!pick" @click="submit">
        {{ t('guess.submit') }}
      </button>
    </template>

    <p v-else class="guess__locked crt-caret">{{ t('guess.locked') }}</p>
  </div>
</template>

<style scoped>
.guess {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.guess__title {
  font-size: 1.6rem;
  margin: 0;
}
.guess__prompt {
  font-size: 1.2rem;
  margin: 0;
}
.guess__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
  gap: 0.6rem;
}
.guess__opt {
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
.guess__icon {
  font-size: 1.8rem;
}
.guess__locked {
  font-size: 1.3rem;
  color: var(--color-ink-strong);
}
</style>
