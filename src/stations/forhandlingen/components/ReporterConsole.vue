<script setup lang="ts">
/**
 * Rapportörskonsol — ett lags skärm (§4.6). Fokuserad, stegvis hierarki:
 *   START-skärm: superstort vem/vilka som är förhandlare respektive rapportör.
 *   HEADER: lagidentitet · stort KAPITAL (bultar när det dras) · kritisk resurs.
 *   MITTEN: ett fokuserat steg i taget — intro-popup (kritisk → pengar),
 *           getready-nedräkning, budgivning, avräkning.
 * Förhandlaren rör inte konsolen — bara rösten.
 */
import { ref, computed, watch } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { resourceIcon } from '../resources'
import { useI18n } from '@/station-kit/i18n'

import TeamIdentity from './TeamIdentity.vue'
import HatchRow from './HatchRow.vue'
import BiddingZone from './BiddingZone.vue'
import GuessView from './GuessView.vue'
import RevealSequence from './RevealSequence.vue'

const props = defineProps<{ team: TeamId }>()
const store = useGameStore()
const { t } = useI18n()

const critical = computed(() => store.state.critical[props.team])
const capital = computed(() => store.state.capital[props.team])
const members = computed(() => store.state.members[props.team])

function namesOf(role: 'A' | 'B'): string {
  return (
    members.value
      .filter((m) => m.assigned_role === role)
      .map((m) => m.name ?? m.band_id)
      .join(' & ') || '—'
  )
}

// Kapitalet bultar till när det dras (köp bekräftat).
const capitalPulse = ref(false)
watch(capital, (nv, ov) => {
  if (nv < ov) {
    capitalPulse.value = false
    requestAnimationFrame(() => {
      capitalPulse.value = true
    })
    setTimeout(() => {
      capitalPulse.value = false
    }, 650)
  }
})
</script>

<template>
  <div class="console">
    <TeamIdentity :team="team" />

    <!-- === START-skärm: superstora roller === -->
    <div v-if="store.phase === 'intro'" class="intro">
      <div class="intro__role">
        <span class="intro__label">{{ t('role.A') }}</span>
        <span class="intro__names ink-strong">{{ namesOf('A') }}</span>
        <span class="intro__goal">{{ t('intro.negotiator_goal') }}</span>
      </div>
      <div class="intro__role">
        <span class="intro__label">{{ t('role.B') }}</span>
        <span class="intro__names ink-strong">{{ namesOf('B') }}</span>
        <span class="intro__goal">{{ t('intro.reporter_goal') }}</span>
      </div>
      <button class="crt-button crt-button--strong intro__start" @click="store.startLive()">
        {{ t('intro.start_round') }}
      </button>
    </div>

    <!-- === Spel === -->
    <template v-else>
      <!-- Header: kapital + kritisk resurs -->
      <div class="console__header">
        <div class="stat">
          <span class="stat__label">{{ t('common.capital') }}</span>
          <span class="stat__big mono ink-strong" :class="{ 'stat__big--pulse': capitalPulse }"
            >{{ capital }}<small> kr</small></span
          >
        </div>
        <div v-if="critical" class="crit">
          <span class="crit__label">{{ t('critical.header') }}</span>
          <span class="crit__main">
            <span class="crit__icon">{{ resourceIcon(critical) }}</span>
            <span class="crit__name ink-strong">{{ t('resource.' + critical) }}</span>
          </span>
        </div>
      </div>

      <!-- Progress: hur många luckor kvar -->
      <HatchRow :cells="store.hatchCells" />

      <!-- Fokuserat steg -->
      <RevealSequence
        v-if="store.phase === 'bidding' && store.step === 'reveal'"
        :team="team"
      />
      <BiddingZone v-else-if="store.phase === 'bidding'" :team="team" />
      <GuessView v-else-if="store.phase === 'guessing'" :team="team" />
    </template>
  </div>
</template>

<style scoped>
.console {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

/* START-skärm: superstora roller */
.intro {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  margin-top: 1.5rem;
  align-items: flex-start;
}
.intro__role {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}
.intro__label {
  font-size: 1.1rem;
  letter-spacing: 0.12em;
  color: var(--color-primary);
}
.intro__names {
  font-size: 3.4rem;
  text-shadow: var(--glow-strong);
  margin-top: 0.1rem;
}
.intro__goal {
  font-size: 1.05rem;
  color: var(--color-ink-muted);
  margin-top: 0.25rem;
}
.intro__start {
  font-size: 1.6rem;
  padding: 0.5em 1.6em;
  margin-top: 0.6rem;
  align-self: stretch;
}

/* Header */
.console__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--color-primary-dim);
  padding-bottom: 0.6rem;
}
.stat {
  display: flex;
  flex-direction: column;
  line-height: 1;
}
.stat__label {
  font-size: 0.8rem;
  color: var(--color-ink-muted);
  letter-spacing: 0.06em;
}
.stat__big {
  font-size: 2.6rem;
  color: var(--color-primary);
  transform-origin: left center;
}
.stat__big small {
  font-size: 1rem;
}
.stat__big--pulse {
  animation: capital-pulse 0.6s ease-out;
}
@keyframes capital-pulse {
  0% {
    transform: scale(1);
    color: var(--color-primary);
  }
  30% {
    transform: scale(1.35);
    color: var(--color-danger);
    text-shadow: 0 0 16px var(--color-danger);
  }
  100% {
    transform: scale(1);
    color: var(--color-primary);
  }
}

/* Kritisk resurs — 1,5× större */
.crit {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
.crit__label {
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  color: var(--color-ink-muted);
}
.crit__main {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.2rem;
}
.crit__icon {
  font-size: 2.4rem;
  line-height: 1;
}
.crit__name {
  font-size: 2.25rem;
}

@media (prefers-reduced-motion: reduce) {
  .stat__big--pulse {
    animation: none;
  }
}
</style>
