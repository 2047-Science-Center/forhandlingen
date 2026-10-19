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
import RoleIcon from './RoleIcon.vue'

// demoPick: tutorial-läge (coach-mark steg 6). Visar gissningsrutan som i det
// riktiga UI:t men med EN resurs förvald (mockup-tryck) och ×2-badge — ej
// interaktiv, skickar aldrig in något. Driver inget spel-state.
const props = defineProps<{
  team: TeamId
  demoPick?: string
  demoDouble?: boolean
  /** Alternativ att visa i demo-läget (store.order är tomt innan spelet). */
  demoOptions?: string[]
}>()
const store = useGameStore()
const { t } = useI18n()

const demo = computed(() => props.demoPick != null)
/** Rutnätets alternativ: riktiga auktionsordningen, eller demo-listan i demo-läget. */
const options = computed(() =>
  demo.value && props.demoOptions?.length ? props.demoOptions : store.state.order,
)
const pick = ref<string | null>(null)
const locked = computed(() => store.state.guesses[props.team] != null)

function submit() {
  if (pick.value) store.submitGuess(props.team, pick.value)
}
</script>

<template>
  <div class="guess">
    <h3 class="guess__title">{{ t('guess.title') }}</h3>

    <!-- Tydlig markör: det här är RAPPORTÖRENS jobb (syns i både tutorial och
         skarpt spel, så länge gissningen pågår). -->
    <div v-if="demo || !locked" class="guess__role">
      <RoleIcon role="B" :size="34" />
      <span class="guess__rolelabel">{{ t('guess.role_turn') }}</span>
    </div>

    <!-- DEMO (coach-mark): förvald rätt gissning + ×2-badge, ej interaktiv. -->
    <template v-if="demo">
      <p class="guess__prompt">{{ t('guess.prompt') }}</p>
      <div class="guess__grid">
        <div
          v-for="res in options"
          :key="res"
          class="guess__opt amber-frame"
          :class="{ 'guess__opt--sel': res === demoPick }"
        >
          <span class="guess__icon">{{ resourceIcon(res) }}</span>
          <span>{{ t('resource.' + res) }}</span>
          <span v-if="res === demoPick && demoDouble" class="guess__x2">×2</span>
        </div>
      </div>
    </template>

    <template v-else-if="!locked">
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
/* Explicit färg (ej ärvd från body) så läges-temat följer med: blått i
   tutorial, bärnsten i skarpt — annars ärvs body:s skarpa färg även i övning. */
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
.guess__x2 {
  position: absolute;
  top: -0.6rem;
  right: -0.6rem;
  font-family: var(--font-retro);
  font-size: 1.1rem;
  color: var(--color-ink-strong);
  background: var(--color-background-2);
  border: 1px solid var(--color-primary);
  border-radius: 999px;
  padding: 0.05em 0.5em;
  box-shadow: 0 0 12px rgba(var(--mode-accent-rgb), 0.6);
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
