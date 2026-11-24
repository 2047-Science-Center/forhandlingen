<script setup lang="ts">
/**
 * Budgivningen av EN lucka, ett läge i taget (engine/types BiddingStep):
 *   getready    → "Nu ska ni förhandla om X" + kort nedräkning.
 *   negotiating → "BUDGIVNING PÅGÅR" + nedräkning + resursen. VI ÄR KLARA avslutar i förtid.
 *   klubba      → KLUBBAN: samma ruta på BÅDA skärmarna — vem fick den (A/B/ingen) + pris
 *                 → KLUBBA. Den som står närmast trycker; första klubbslaget gäller.
 *   sald        → stämpeln "SÅLD · SIDA A · 30 KR" på båda skärmarna + ÅNGRA (n s).
 *                 Sedan bokförs köpet av sig självt och nästa lucka öppnas.
 * Ersätter det gamla vem vann → slutpris → bekräfta → andra sidan bekräftar.
 */
import { ref, computed, watch } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { resourceIcon } from '../resources'
import { useI18n } from '@/station-kit/i18n'
import { KLUBBA } from '@/config'

const props = defineProps<{ team: TeamId }>()
const store = useGameStore()
const { t } = useI18n()

const s = computed(() => store.state)
const step = computed(() => store.step)
const resource = computed(() => store.currentResource)
const countdown = computed(() => Math.max(0, store.secondsLeft ?? 0))
const opponent = computed<TeamId>(() => store.opponentOf(props.team))
/** Ordningen på skärmen: alltid A till vänster, B till höger (som rummet). */
const sidor: TeamId[] = ['lag1', 'lag2']

// --- Klubb-rutan (lokal per skärm tills KLUBBA trycks) ---
type Val = TeamId | 'ingen' | null
const val = ref<Val>(null)
const pris = ref<number>(KLUBBA.startpris)
const maxPris = computed(() => (val.value && val.value !== 'ingen' ? s.value.capital[val.value] : 0))
const kanKlubba = computed(() => val.value === 'ingen' || (val.value != null && pris.value <= maxPris.value))

function valj(v: Exclude<Val, null>) {
  val.value = v
  if (v !== 'ingen') pris.value = Math.min(pris.value, s.value.capital[v])
}
function andraPris(d: number) {
  pris.value = Math.max(0, Math.min(maxPris.value, pris.value + d))
}
function klubba() {
  if (!kanKlubba.value || !val.value) return
  store.klubba(val.value === 'ingen' ? null : val.value, val.value === 'ingen' ? 0 : pris.value, props.team)
}

// Ny lucka eller ångrat → börja om rutan (behåll valet efter ÅNGRA så det går fort att rätta).
watch(
  () => s.value.currentHatch,
  () => {
    val.value = null
    pris.value = KLUBBA.startpris
  },
)

const sald = computed(() => s.value.pending)
const saldText = computed(() =>
  sald.value?.winner
    ? t('klubba.sald', { sida: store.teamName(sald.value.winner), pris: sald.value.price })
    : t('klubba.ingen_kopte'),
)
</script>

<template>
  <div class="bz">
    <!-- STEG: gör er redo -->
    <template v-if="step === 'getready'">
      <p class="bz__label">{{ t('bidding.getready_title') }}</p>
      <div v-if="resource" class="bz__resource">
        <span class="bz__res-icon">{{ resourceIcon(resource) }}</span>
        <span class="bz__res-name">{{ t('resource.' + resource) }}</span>
      </div>
      <div class="bz__count mono">{{ store.secondsLeft == null ? '…' : countdown }}</div>
    </template>

    <!-- STEG: budgivning pågår -->
    <template v-else-if="step === 'negotiating'">
      <div class="bz__live">
        <span class="bz__dot" aria-hidden="true"></span>
        <span class="bz__live-label">{{ t('bidding.in_progress') }}</span>
      </div>
      <div class="bz__timer mono" :class="{ 'bz__timer--slut': countdown <= 5 }">
        0:{{ countdown.toString().padStart(2, '0') }}
      </div>
      <div v-if="resource" class="bz__resource bz__resource--big">
        <span class="bz__res-icon">{{ resourceIcon(resource) }}</span>
        <span class="bz__res-name">{{ t('resource.' + resource) }}</span>
      </div>
      <p class="bz__sub">🎧 {{ t('bidding.talk_now') }}</p>
      <button class="bz__end" @click="store.finishNegotiation()">{{ t('bidding.done') }}</button>
    </template>

    <!-- STEG: KLUBBAN (båda skärmarna) -->
    <template v-else-if="step === 'klubba'">
      <p class="bz__label">{{ t('klubba.over') }}</p>
      <h3 class="bz__q">
        <span class="bz__q-icon">{{ resourceIcon(resource ?? '') }}</span>
        {{ t('klubba.vem', { resurs: t('resource.' + resource) }) }}
      </h3>
      <div class="kl__val">
        <button
          v-for="sida in sidor"
          :key="sida"
          class="kl__sida"
          :class="{ 'kl__sida--vald': val === sida, 'kl__sida--min': sida === team }"
          @click="valj(sida)"
        >
          <span class="kl__bokstav">{{ store.teamConfig(sida).name }}</span>
          <span class="kl__sidtext">{{ store.teamName(sida) }}</span>
          <small v-if="sida === team" class="kl__ni">{{ t('klubba.ni') }}</small>
          <small v-else class="kl__ni">{{ s.capital[sida] }} kr kvar</small>
        </button>
        <button class="kl__sida kl__sida--ingen" :class="{ 'kl__sida--vald': val === 'ingen' }" @click="valj('ingen')">
          <span class="kl__bokstav">–</span>
          <span class="kl__sidtext">{{ t('klubba.ingen') }}</span>
        </button>
      </div>

      <div v-if="val && val !== 'ingen'" class="kl__pris">
        <button class="kl__steg" :disabled="pris <= 0" :aria-label="t('bidding.price_dec')" @click="andraPris(-KLUBBA.steg[1])">−{{ KLUBBA.steg[1] }}</button>
        <button class="kl__steg kl__steg--liten" :disabled="pris <= 0" @click="andraPris(-KLUBBA.steg[0])">−{{ KLUBBA.steg[0] }}</button>
        <div class="kl__belopp mono">{{ pris }}<small> kr</small></div>
        <button class="kl__steg kl__steg--liten" :disabled="pris >= maxPris" @click="andraPris(KLUBBA.steg[0])">+{{ KLUBBA.steg[0] }}</button>
        <button class="kl__steg" :disabled="pris >= maxPris" :aria-label="t('bidding.price_inc')" @click="andraPris(KLUBBA.steg[1])">+{{ KLUBBA.steg[1] }}</button>
      </div>
      <p v-else class="kl__hint">{{ t('klubba.hint') }}</p>

      <button class="crt-button crt-button--strong kl__klubba" :disabled="!kanKlubba" @click="klubba">
        {{ t('klubba.knapp') }}
      </button>
    </template>

    <!-- STEG: SÅLD (båda skärmarna) + ÅNGRA -->
    <template v-else-if="step === 'sald' && sald">
      <div class="kl__stampel-yta">
        <span class="kl__res">{{ resourceIcon(sald.resource) }} {{ t('resource.' + sald.resource) }}</span>
        <div class="kl__stampel" :class="{ 'kl__stampel--ingen': !sald.winner, 'kl__stampel--vi': sald.winner === team, 'kl__stampel--de': sald.winner === opponent }">
          {{ saldText }}
        </div>
      </div>
      <button class="kl__angra" @click="store.angra()">{{ t('klubba.angra', { n: countdown }) }}</button>
    </template>
  </div>
</template>

<style scoped>
.bz {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  text-align: center;
  padding-top: 0.3rem;
}
.bz__label {
  margin: 0;
  font-size: 1.15rem;
  letter-spacing: 0.08em;
  color: var(--color-ink-muted);
}
.bz__count {
  font-size: 4.5rem;
  line-height: 1;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-strong);
}
.bz__resource {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.bz__res-icon {
  font-size: 2.8rem;
  line-height: 1;
}
.bz__res-name {
  font-size: 2.6rem;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-soft);
}
.bz__resource--big .bz__res-icon {
  font-size: 4.4rem;
}
.bz__resource--big .bz__res-name {
  font-size: 3.8rem;
}
.bz__live {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.bz__live-label {
  font-size: 1.4rem;
  letter-spacing: 0.12em;
  color: var(--color-primary);
}
.bz__dot {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 50%;
  background: var(--color-danger);
  box-shadow: 0 0 10px var(--color-danger);
  animation: bz-throb 0.9s ease-in-out infinite;
}
@keyframes bz-throb {
  0%, 100% { transform: scale(0.8); opacity: 0.7; }
  50% { transform: scale(1.4); opacity: 1; }
}
.bz__timer {
  font-size: 3.6rem;
  line-height: 1;
  color: var(--color-ink-strong);
}
.bz__timer--slut {
  color: var(--color-danger);
  text-shadow: 0 0 18px rgba(255, 90, 60, 0.6);
}
.bz__sub {
  margin: 0.2rem 0 0;
  color: var(--color-ink-muted);
  font-size: 1.15rem;
}
.bz__end {
  margin-top: 0.6rem;
  font-family: var(--font-retro);
  font-size: 1.1rem;
  color: var(--color-ink-muted);
  background: transparent;
  border: 1px solid var(--color-primary-dim);
  border-radius: 6px;
  padding: 0.35em 1.2em;
  cursor: pointer;
}
.bz__end:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* --- Klubban --- */
.bz__q {
  margin: 0;
  font-family: var(--font-retro);
  font-size: 1.9rem;
  font-weight: normal;
  color: var(--color-ink-strong);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.bz__q-icon {
  font-size: 2rem;
}
.kl__val {
  display: grid;
  grid-template-columns: 1fr 1fr 0.8fr;
  gap: 0.8rem;
  width: min(44rem, 96%);
}
.kl__sida {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.35rem 0.4rem 0.45rem;
  font-family: var(--font-retro);
  color: var(--color-primary);
  background: var(--color-background-2);
  border: 2px solid var(--color-primary-dim);
  border-radius: 12px;
  cursor: pointer;
  transition: transform 120ms var(--ease-out, ease-out), border-color 120ms, background 120ms;
}
.kl__sida:active {
  transform: scale(0.97);
}
.kl__bokstav {
  font-size: 2.1rem;
  line-height: 1;
}
.kl__sidtext {
  font-size: 1.25rem;
  letter-spacing: 0.08em;
}
.kl__ni {
  font-size: 0.95rem;
  color: var(--color-ink-muted);
}
.kl__sida--ingen {
  color: var(--color-ink-muted);
}
.kl__sida--vald {
  border-color: var(--color-primary);
  background: rgba(var(--mode-accent-rgb), 0.16);
  box-shadow: 0 0 18px rgba(var(--mode-accent-rgb), 0.45);
  color: var(--color-ink-strong);
}
.kl__hint {
  margin: 0.4rem 0;
  color: var(--color-ink-muted);
  font-size: 1.1rem;
  min-height: 3rem;
  display: flex;
  align-items: center;
}
.kl__pris {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 3rem;
}
.kl__steg {
  font-family: var(--font-retro);
  font-size: 1.5rem;
  min-width: 3.6rem;
  padding: 0.25em 0.5em;
  color: var(--color-primary);
  background: transparent;
  border: 2px solid var(--color-primary);
  border-radius: 10px;
  cursor: pointer;
}
.kl__steg--liten {
  font-size: 1.15rem;
  min-width: 3rem;
  border-color: var(--color-primary-dim);
}
.kl__steg:disabled {
  opacity: 0.3;
  cursor: default;
}
.kl__belopp {
  min-width: 7ch;
  font-size: 2.6rem;
  line-height: 1;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-strong);
}
.kl__belopp small {
  font-size: 1.4rem;
}
.kl__klubba {
  font-size: 1.6rem;
  padding: 0.35em 2.4em;
  margin-top: 0.1rem;
}
.kl__klubba:disabled {
  opacity: 0.35;
  cursor: default;
}

/* Stämpeln slår ner (samma rörelse som spellägeskortet: power4.in, liten skakning). */
.kl__stampel-yta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-top: 1.2rem;
}
.kl__res {
  font-family: var(--font-retro);
  font-size: 1.8rem;
  color: var(--color-ink-muted);
}
.kl__stampel {
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 3.4rem;
  letter-spacing: 0.04em;
  line-height: 1;
  padding: 0.25em 0.6em 0.3em;
  color: var(--color-primary);
  border: 0.14em solid var(--color-primary);
  border-radius: 0.18em;
  transform: rotate(-4deg);
  animation: kl-slag 260ms cubic-bezier(0.55, 0, 1, 0.45) both, kl-skak 300ms 260ms ease-out;
  text-shadow: 0 0 20px rgba(var(--mode-accent-rgb), 0.45);
}
.kl__stampel--ingen {
  color: var(--color-ink-muted);
  border-color: var(--color-ink-muted);
  text-shadow: none;
}
@keyframes kl-slag {
  from { opacity: 0; transform: rotate(-10deg) scale(2.4); }
  to { opacity: 1; transform: rotate(-4deg) scale(1); }
}
@keyframes kl-skak {
  0%, 100% { translate: 0 0; }
  25% { translate: -6px 2px; }
  60% { translate: 4px -1px; }
}
@media (prefers-reduced-motion: reduce) {
  .kl__stampel { animation: none; }
  .bz__dot { animation: none; }
}
.kl__angra {
  margin-top: 1rem;
  font-family: var(--font-retro);
  font-size: 1.25rem;
  color: var(--color-ink-muted);
  background: transparent;
  border: 1px solid var(--color-primary-dim);
  border-radius: 8px;
  padding: 0.35em 1.4em;
  cursor: pointer;
}
</style>
