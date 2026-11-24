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
import type { HatchCell } from '../store/gameStore'

// allowGuess=false i tutorialen: där får gissningen bara ske i det dedikerade
// gissnings-steget, aldrig i budgivnings-konsolen. Motorn går till fasen
// 'guessing' redan när budgivningen är klar; utan denna grind skulle konsolen
// visa en gissningsruta där.
//
// demo: tutorial-läge (coach-marks). Renderar grund-UI:t i ett LUGNT demo-
// tillstånd BAKOM coach-mark-overlayn — riktiga header-elementen (kapital,
// livsviktig) med data-tut-ankare som spotlighten pekar på, plus en lugn mitt
// (aktuell resurs ELLER förvald gissning). Driver INGET spel-state.
const props = withDefaults(
  defineProps<{
    team: TeamId
    allowGuess?: boolean
    demo?: 'resource' | null
    demoCritical?: string
    demoCapital?: number
    demoResource?: string
    /** Antal luckor i demo-raden (default 3; intro-3D visar skarpa rundans 5). */
    demoHatches?: number
  }>(),
  { allowGuess: true, demo: null, demoHatches: 5 },
)
const store = useGameStore()
const { t } = useI18n()

const critical = computed(() => (props.demo ? (props.demoCritical ?? '') : store.state.critical[props.team]))
const capital = computed(() => (props.demo ? (props.demoCapital ?? 0) : store.state.capital[props.team]))

// Statiska demo-luckor (lugn progress-rad bakom coach-marks): en aktiv + två kvar.
const demoCells = computed<HatchCell[]>(() =>
  Array.from({ length: props.demoHatches }, (_, i) => ({
    index: i,
    hatch: i + 1,
    kind: i === 0 ? ('active' as const) : ('upcoming' as const),
    winner: null,
    resource: null,
  })),
)


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

    <!-- === DEMO-tillstånd (bakom coach-marks): lugnt, icke-interaktivt === -->
    <template v-if="demo">
      <div class="console__header">
        <div class="stat" data-tut="capital">
          <span class="stat__label">{{ t('common.capital') }}</span>
          <span class="stat__big mono ink-strong">{{ capital }}<small> kr</small></span>
        </div>
        <div v-if="critical" class="crit" data-tut="critical">
          <span class="crit__label">{{ t('critical.header') }}</span>
          <span class="crit__main">
            <span class="crit__icon">{{ resourceIcon(critical) }}</span>
            <span class="crit__name ink-strong">{{ t('resource.' + critical) }}</span>
          </span>
        </div>
      </div>

      <div data-tut="luckor" class="console__luckor"><HatchRow :cells="demoCells" /></div>

      <!-- Mitt: aktuell resurs på marknaden ELLER förvald gissning -->
      <div v-if="demo === 'resource'" class="console__rescard" data-tut="resource">
        <span class="console__res-icon">{{ resourceIcon(demoResource ?? '') }}</span>
        <span class="console__res-name ink-strong">{{ t('resource.' + demoResource) }}</span>
      </div>

    </template>

    <!-- Innan första luckan (ett ögonblick, tills ledaren startat): bara gör er redo -->
    <div v-else-if="store.phase === 'intro'" class="intro">
      <p class="intro__vanta crt-caret">{{ t('intro.get_ready') }}</p>
    </div>

    <!-- === Spel === -->
    <template v-else>
      <!-- Header: kapital + kritisk resurs -->
      <div class="console__header">
        <div class="stat" data-tut="capital">
          <span class="stat__label">{{ t('common.capital') }}</span>
          <span class="stat__big mono ink-strong" :class="{ 'stat__big--pulse': capitalPulse }"
            >{{ capital }}<small> kr</small></span
          >
        </div>
        <div v-if="critical" class="crit" data-tut="critical">
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
      <BiddingZone v-if="store.phase === 'bidding'" :team="team" />
      <GuessView v-else-if="store.phase === 'guessing' && allowGuess" :team="team" />
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
.intro__vanta {
  font-family: var(--font-retro);
  font-size: 1.6rem;
  color: var(--color-ink-muted);
  margin: 0;
}

/* Luckraden som coach-mark-mål: tajt runt prickarna, inte hela bredden. */
.console__luckor {
  align-self: center;
  padding: 0.3rem 0.8rem;
}

/* Demo-mitt: aktuell resurs på marknaden */
.console__rescard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
}
.console__res-icon {
  font-size: 4rem;
  line-height: 1;
}
.console__res-name {
  font-size: 2.6rem;
  text-shadow: var(--glow-soft);
}
.console__guesswrap {
  margin-top: 1rem;
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
