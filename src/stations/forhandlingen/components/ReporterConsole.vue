<script setup lang="ts">
/**
 * Rapportörskonsol — ett lags skärm (§4.6). Fokuserad, stegvis hierarki:
 *   START-skärm: superstort vem/vilka som är förhandlare respektive rapportör.
 *   HEADER: lagidentitet · stort KAPITAL (bultar när det dras) · kritisk resurs.
 *   MITTEN: ett fokuserat steg i taget — intro-popup (kritisk → pengar),
 *           getready-nedräkning, budgivning, avräkning.
 * Förhandlaren rör inte konsolen — bara rösten.
 */
import { computed } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { useI18n } from '@/station-kit/i18n'

import TeamIdentity from './TeamIdentity.vue'
import MarknadsVagg from './MarknadsVagg.vue'
import VaraBild from './VaraBild.vue'
import MyntStapel from './MyntStapel.vue'
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
/** Miljöbilden (bergrummet med luckväggen, bildgen) svagt bakom konsolen, så skärmen känns som en plats. */
const miljo = { '--miljo': `url("${import.meta.env.BASE_URL}marknad/miljo.jpg")` }
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
    resource: i === 0 ? (props.demoResource ?? null) : null,
    price: null,
  })),
)


</script>

<template>
  <div class="console" :style="miljo">
    <!-- Huvudet: pengarna (mynt) · sidan · er livsviktiga vara -->
    <div v-if="demo || store.phase !== 'intro'" class="console__header">
      <div class="stat" data-tut="capital">
        <MyntStapel :kr="capital" liten />
      </div>
      <TeamIdentity :team="team" compact />
      <div v-if="critical" class="crit" data-tut="critical">
        <VaraBild :vara="critical" :size="54" />
        <span class="crit__text">
          <span class="crit__tagg">{{ t('critical.tagg') }}</span>
          <span class="crit__name ink-strong">{{ t('resource.' + critical) }}</span>
        </span>
      </div>
    </div>
    <TeamIdentity v-else :team="team" />

    <!-- === DEMO-tillstånd (bakom coach-marks): lugnt, icke-interaktivt === -->
    <template v-if="demo">
      <div data-tut="luckor" class="console__luckor"><MarknadsVagg :cells="demoCells" /></div>
      <div v-if="demo === 'resource'" class="console__rescard" data-tut="resource">
        <VaraBild :vara="demoResource ?? ''" :size="150" />
        <span class="console__res-name ink-strong">{{ t('resource.' + demoResource) }}</span>
      </div>
    </template>

    <!-- Innan första luckan (ett ögonblick, tills ledaren startat): bara gör er redo -->
    <div v-else-if="store.phase === 'intro'" class="intro">
      <p class="intro__vanta crt-caret">{{ t('intro.get_ready') }}</p>
    </div>

    <!-- === Spel === -->
    <template v-else>
      <div class="console__luckor"><MarknadsVagg :cells="store.hatchCells" liten /></div>
      <BiddingZone v-if="store.phase === 'bidding'" :team="team" />
      <GuessView v-else-if="store.phase === 'guessing' && allowGuess" :team="team" />
    </template>
  </div>
</template>

<style scoped>
.console {
  background:
    linear-gradient(180deg, rgba(5, 16, 11, 0.8), rgba(5, 16, 11, 0.94) 45%),
    var(--miljo) center 30% / cover no-repeat;
  border-radius: 10px;
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
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1.5rem;
  border-bottom: 1px solid var(--color-primary-dim);
  padding-bottom: 0.5rem;
}
.stat {
  display: flex;
}
/* Livsviktig: varan som bild + röd tagg (ersätter "Resursen ni måste få tag på") */
.crit {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0.8rem 0.3rem 0.4rem;
  border: 2px solid rgba(255, 90, 60, 0.7);
  border-radius: 12px;
  box-shadow: 0 0 18px rgba(255, 90, 60, 0.25);
}
.crit__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}
.crit__tagg {
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.08em;
  color: #fff;
  background: var(--color-danger);
  padding: 0.05em 0.5em;
  border-radius: 5px;
  transform: rotate(-4deg);
}
.crit__name {
  font-size: 1.6rem;
}

</style>
