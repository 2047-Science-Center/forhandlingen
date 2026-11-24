<script setup lang="ts">
/**
 * En sidas skärm — RENODLAD (Josef 2026-11-24): bara det som avgör spelet syns.
 *
 *   ┌ PENGAR ┐  ┌──── marknaden ────┐  ┌ LIVSVIKTIG ┐
 *   │ mynt   │  │ luckväggen        │  │ varan      │
 *   │ 100 kr │  │ aktuell lucka     │  │ namnet     │
 *   └────────┘  └───────────────────┘  └────────────┘
 *
 * Ingen topppanel, inga namn eller roller. Påminnelser pekar på det som gäller just då:
 *   - före första luckan: först "det här är er livsviktiga — ni måste få tag på den",
 *     sedan "era pengar — slösa inte, det som är kvar blir poäng";
 *   - när er livsviktiga kommer upp: rött, "den här måste ni ta";
 *   - inför sista luckan: pengarna igen.
 */
import { computed } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { useI18n } from '@/station-kit/i18n'

import MarknadsVagg from './MarknadsVagg.vue'
import VaraBild from './VaraBild.vue'
import MyntStapel from './MyntStapel.vue'
import BiddingZone from './BiddingZone.vue'
import GuessView from './GuessView.vue'
import type { HatchCell } from '../store/gameStore'

// allowGuess=false i provluckan: ingen gissning där.
// demo: lugnt demo-tillstånd bakom instruktionens coach-mark (luckväggen); driver inget spel-state.
const props = withDefaults(
  defineProps<{
    team: TeamId
    allowGuess?: boolean
    demo?: 'resource' | null
    demoCritical?: string
    demoCapital?: number
    demoResource?: string
    demoHatches?: number
  }>(),
  { allowGuess: true, demo: null, demoHatches: 5 },
)
const store = useGameStore()
const { t } = useI18n()
/** Miljöbilden (bergrummet med luckväggen, bildgen) svagt bakom konsolen, så skärmen känns som en plats. */
const miljo = { '--miljo': `url("${import.meta.env.BASE_URL}marknad/miljo.jpg")` }

const critical = computed(() => (props.demo ? (props.demoCritical ?? '') : store.state.critical[props.team]))
const capital = computed(() => (props.demo ? (props.demoCapital ?? 0) : store.state.capital[props.team]))

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

// --- Påminnelserna ---
const s = computed(() => store.state)
const iLucka = computed(() => s.value.phase === 'bidding')
const forstaGetready = computed(() => iLucka.value && s.value.currentHatch === 0 && store.step === 'getready')
const sistaGetready = computed(
  () => iLucka.value && s.value.order.length > 1 && s.value.currentHatch === s.value.order.length - 1 && store.step === 'getready',
)
/** Före första luckan, de sista 8 sekunderna: 8–5 den livsviktiga, 4–1 pengarna
 *  (i skarpt läge är nedräkningen längre så att NU GÄLLER DET hinner försvinna först). */
const kvar = computed(() => store.secondsLeft ?? 99)
const pekLivsForst = computed(() => !props.demo && forstaGetready.value && kvar.value > 4 && kvar.value <= 8)
const pekPengar = computed(() => !props.demo && ((forstaGetready.value && kvar.value <= 4) || sistaGetready.value))
/** Er livsviktiga är ute på marknaden just nu. */
const livsUppe = computed(
  () => !props.demo && iLucka.value && !!critical.value && store.currentResource === critical.value && store.step !== 'sald',
)
const pengarText = computed(() => (sistaGetready.value ? t('pek.pengar_sista') : t('pek.pengar')))
const livsText = computed(() => (livsUppe.value ? t('pek.livs_uppe') : t('pek.livs')))
</script>

<template>
  <div class="console" :style="miljo">
    <div v-if="!demo && store.phase === 'intro'" class="intro">
      <p class="intro__vanta crt-caret">{{ t('intro.get_ready') }}</p>
    </div>

    <div v-else class="k">
      <!-- PENGAR -->
      <aside class="k__sida k__pengar" :class="{ 'k__sida--fokus': pekPengar, 'k__sida--dampad': livsUppe }" data-tut="capital">
        <span class="k__etikett">{{ t('pek.pengar_etikett') }}</span>
        <MyntStapel :kr="capital" />
        <Transition name="k-pek"><p v-if="pekPengar" class="k__pek">{{ pengarText }}</p></Transition>
      </aside>

      <!-- MARKNADEN -->
      <main class="k__mitt">
        <div class="k__vagg" :data-tut="demo ? 'luckor' : undefined">
          <MarknadsVagg :cells="demo ? demoCells : store.hatchCells" liten />
        </div>
        <template v-if="demo">
          <div v-if="demo === 'resource'" class="k__demo" data-tut="resource">
            <VaraBild :vara="demoResource ?? ''" :size="140" />
            <span class="k__demonamn">{{ t('resource.' + demoResource) }}</span>
          </div>
        </template>
        <BiddingZone v-else-if="store.phase === 'bidding'" :team="team" :livsviktig="livsUppe" />
        <GuessView v-else-if="store.phase === 'guessing' && allowGuess" :team="team" />
      </main>

      <!-- LIVSVIKTIG -->
      <aside
        v-if="critical"
        class="k__sida k__livs"
        :class="{ 'k__sida--fokus': pekLivsForst || livsUppe, 'k__sida--dampad': pekPengar }"
        data-tut="critical"
      >
        <span class="k__tagg">{{ t('critical.tagg') }}</span>
        <VaraBild :vara="critical" :size="120" />
        <span class="k__namn">{{ t('resource.' + critical) }}</span>
        <Transition name="k-pek"><p v-if="pekLivsForst || livsUppe" class="k__pek k__pek--livs">{{ livsText }}</p></Transition>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.console {
  height: 100%;
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(5, 16, 11, 0.82), rgba(5, 16, 11, 0.94) 45%),
    var(--miljo) center 30% / cover no-repeat;
}
.intro {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.intro__vanta {
  font-family: var(--font-retro);
  font-size: 1.6rem;
  color: var(--color-ink-muted);
  margin: 0;
}

.k {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(180px, 17%) 1fr minmax(180px, 17%);
  gap: 1rem;
  padding: 0.6rem;
}
.k__mitt {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 1.4rem;
}
.k__vagg {
  align-self: center;
}

/* Sidokolumnerna: pengarna och den livsviktiga — det enda som avgör spelet */
.k__sida {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1rem 0.6rem;
  border-radius: 16px;
  border: 2px solid transparent;
  transition: border-color 300ms, box-shadow 300ms, opacity 300ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.k__sida--fokus {
  border-color: var(--color-primary);
  box-shadow: 0 0 34px rgba(var(--mode-accent-rgb), 0.35);
  transform: scale(1.04);
}
.k__livs.k__sida--fokus {
  border-color: var(--color-danger);
  box-shadow: 0 0 40px rgba(255, 90, 60, 0.45);
}
.k__sida--dampad {
  opacity: 0.45;
}
.k__etikett {
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.14em;
  color: var(--color-ink-muted);
}
.k__tagg {
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.08em;
  color: #fff;
  background: var(--color-danger);
  padding: 0.05em 0.6em;
  border-radius: 6px;
  transform: rotate(-4deg);
}
.k__namn {
  font-family: var(--font-retro);
  font-size: 1.6rem;
  color: var(--color-ink-strong);
}
/* Påminnelsen: en kort rad i kolumnen den gäller */
.k__pek {
  margin: 0.4rem 0 0;
  padding: 0.5em 0.7em;
  border-radius: 10px;
  background: rgba(var(--mode-accent-rgb), 0.14);
  border: 1px solid var(--color-primary);
  font-family: var(--font-retro);
  font-size: 1.25rem;
  line-height: 1.2;
  text-align: center;
  color: var(--color-ink-strong);
}
.k__pek--livs {
  background: rgba(255, 90, 60, 0.16);
  border-color: var(--color-danger);
}
.k-pek-enter-active {
  transition: opacity 220ms ease-out, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}
.k-pek-leave-active {
  transition: opacity 140ms ease-in;
}
.k-pek-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.k-pek-leave-to {
  opacity: 0;
}
.k__demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1rem;
}
.k__demonamn {
  font-family: var(--font-retro);
  font-size: 1.6rem;
  color: var(--color-ink-strong);
}
@media (prefers-reduced-motion: reduce) {
  .k__sida { transition: none; }
  .k__sida--fokus { transform: none; }
}
</style>
