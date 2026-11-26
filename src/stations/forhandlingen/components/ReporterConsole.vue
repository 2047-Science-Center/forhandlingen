<script setup lang="ts">
/**
 * En sidas skärm — RENODLAD (Josef 2026-11-24): bara det som avgör spelet syns.
 *
 *   ┌ PENGAR ┐  ┌──── marknaden ────┐  ┌ LIVSVIKTIG ┐
 *   │ mynt   │  │ luckväggen        │  │ varan      │
 *   │ 100 kr │  │ aktuell lucka     │  │ namnet     │
 *   └────────┘  └───────────────────┘  └────────────┘
 *
 * Ingen topppanel, inga namn eller roller. Reglerna står kvar hela tiden som en rad i sin kolumn
 * (pengar: kvar = poäng; livsviktig: måste köpas, och rätt gissning på motståndarens ×2).
 * Påminnelser pekar dessutom på det som gäller just då:
 *   - före första luckan: först "det här är er livsviktiga — ni måste få tag på den",
 *     sedan "era pengar — slösa inte, det som är kvar blir poäng";
 *   - när er livsviktiga kommer upp: rött, "den här måste ni ta";
 *   - inför sista luckan: pengarna igen.
 */
import { computed, watch } from 'vue'
import { audio } from '@/station-kit/audio/AudioEngine'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { useI18n } from '@/station-kit/i18n'

import MarknadsVagg from './MarknadsVagg.vue'
import VaraBild from './VaraBild.vue'
import MyntStapel from './MyntStapel.vue'
import BiddingZone from './BiddingZone.vue'
import GuessView from './GuessView.vue'

// allowGuess=false i provluckan: ingen gissning där.
const props = withDefaults(defineProps<{ team: TeamId; allowGuess?: boolean }>(), { allowGuess: true })
const store = useGameStore()
const { t } = useI18n()
/** Miljöbilden (bergrummet med luckväggen, bildgen) svagt bakom konsolen, så skärmen känns som en plats. */
const miljo = { '--miljo': `url("${import.meta.env.BASE_URL}marknad/miljo.jpg")` }

const critical = computed(() => store.state.critical[props.team])
const capital = computed(() => store.state.capital[props.team])

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
const pekLivsForst = computed(() => forstaGetready.value && kvar.value > 4 && kvar.value <= 8)
const pekPengar = computed(() => ((forstaGetready.value && kvar.value <= 4) || sistaGetready.value))
/** Er livsviktiga är ute på marknaden just nu. */
const livsUppe = computed(
  () => iLucka.value && !!critical.value && store.currentResource === critical.value && store.step !== 'sald',
)
// Larmet (Josef 2026-11-26): när er livsviktiga kommer upp ska det POCKA på uppmärksamheten — röd pulserande
// ram runt hela skärmen, blinkande banner och en varningssignal (en gång, bara på den sida det gäller).
watch(livsUppe, (v) => {
  if (v) audio.play('idlewarn')
})
const pengarText = computed(() => (sistaGetready.value ? t('pek.pengar_sista') : t('pek.pengar')))
const livsText = computed(() => (livsUppe.value ? t('pek.livs_uppe') : t('pek.livs')))
</script>

<template>
  <div class="console" :class="{ 'console--larm': livsUppe }" :style="miljo">
    <div v-if="livsUppe" class="larm" aria-hidden="true" />
    <div v-if="livsUppe" class="larm__banner" role="alert">⚠ {{ t('pek.livs_larm') }}</div>
    <div v-if="store.phase === 'intro'" class="intro">
      <p class="intro__vanta crt-caret">{{ t('intro.get_ready') }}</p>
    </div>

    <div v-else class="k">
      <!-- PENGAR -->
      <aside class="k__sida k__pengar" :class="{ 'k__sida--fokus': pekPengar, 'k__sida--dampad': livsUppe }" data-tut="capital">
        <span class="k__etikett">{{ t('pek.pengar_etikett') }}</span>
        <MyntStapel :kr="capital" />
        <p class="k__regel">{{ t('fast.pengar') }}</p>
        <Transition name="k-pek"><p v-if="pekPengar" class="k__pek">{{ pengarText }}</p></Transition>
      </aside>

      <!-- MARKNADEN -->
      <main class="k__mitt">
        <div class="k__vagg">
          <MarknadsVagg :cells="store.hatchCells" liten />
        </div>
        <BiddingZone v-if="store.phase === 'bidding'" :team="team" :livsviktig="livsUppe" />
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
        <p class="k__regel">{{ t('fast.livs') }}</p>
        <p class="k__regel k__regel--gissa"><b>×2</b>{{ t('fast.gissa') }}</p>
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
.console {
  position: relative;
}
/* Larmet när er livsviktiga är ute */
.larm {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  border-radius: 10px;
  border: 6px solid var(--color-danger);
  animation: larm-puls 0.9s ease-in-out infinite;
}
@keyframes larm-puls {
  0%, 100% { box-shadow: inset 0 0 30px rgba(255, 90, 60, 0.35), 0 0 20px rgba(255, 90, 60, 0.4); border-color: rgba(255, 90, 60, 0.55); }
  50% { box-shadow: inset 0 0 120px rgba(255, 90, 60, 0.6), 0 0 50px rgba(255, 90, 60, 0.8); border-color: rgba(255, 90, 60, 1); }
}
.larm__banner {
  position: absolute;
  z-index: 6;
  left: 50%;
  top: 0.6rem;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 0.2em 1em;
  border-radius: 10px;
  background: var(--color-danger);
  color: #fff;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2rem;
  letter-spacing: 0.06em;
  box-shadow: 0 0 30px rgba(255, 90, 60, 0.8);
  animation: larm-blink 0.9s steps(2, jump-none) infinite;
}
@keyframes larm-blink {
  0% { opacity: 1; }
  100% { opacity: 0.35; }
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
/* Regeln som står kvar hela tiden */
.k__regel {
  margin: 0;
  font-family: var(--font-retro);
  font-size: 1.1rem;
  line-height: 1.2;
  text-align: center;
  color: var(--color-ink-strong);
}
.k__regel--gissa {
  margin-top: 0.3rem;
  padding-top: 0.6rem;
  border-top: 1px dashed rgba(245, 245, 240, 0.3);
  font-size: 1rem;
  color: var(--color-ink-muted);
}
.k__regel--gissa b {
  display: block;
  font-family: var(--font-rubrik);
  font-size: 1.6rem;
  color: var(--color-primary);
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
@media (prefers-reduced-motion: reduce) {
  .larm, .larm__banner { animation: none; }
  .k__sida { transition: none; }
  .k__sida--fokus { transform: none; }
}
</style>
