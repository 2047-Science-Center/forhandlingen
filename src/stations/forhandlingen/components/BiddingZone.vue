<script setup lang="ts">
/**
 * Budgivningen i STEG — ett fokuserat läge i taget:
 *   getready     → "Nu ska ni förhandla om X" + nedräkning "börjar om 10 …".
 *   negotiating  → "BUDGIVNING PÅGÅR" + bultande prick + nedräkning + resursen
 *                  i mitten + undertext. (KLAR avslutar i förtid.)
 *   entry_winner → (hos slumpad rapportör) "Vem vann?"
 *   entry_price  → (samma) slutpris via slider + "ingen köpte" + skicka.
 *   confirm      → (hos vinnaren) bekräfta / nej ändra.
 * Övriga konsoler visar ett tydligt vänteläge under inmatningen.
 */
import { ref, computed, watch } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { resourceIcon } from '../resources'
import { useI18n } from '@/station-kit/i18n'

const props = defineProps<{ team: TeamId }>()
const store = useGameStore()
const { t } = useI18n()

const s = computed(() => store.state)
const step = computed(() => store.step)
const entryTeam = computed(() => s.value.entryTeam)
const isEntry = computed(() => entryTeam.value === props.team)
const pending = computed(() => s.value.pending)
// Bekräftelsen skickas ALLTID till det andra valvet (inte den som matade in) —
// även om samma valv råkade vara både inmatare och vinnare.
const isConfirmer = computed(
  () => pending.value != null && props.team !== pending.value.enteredBy,
)
const opponent = computed<TeamId>(() => store.opponentOf(props.team))
const resource = computed(() => store.currentResource)
const countdown = computed(() => Math.max(0, store.secondsLeft ?? 0))

// Slutpris-slider
const price = ref(0)
const maxPrice = computed(() =>
  s.value.draftWinner ? s.value.capital[s.value.draftWinner] : s.value.capital[props.team],
)
watch(step, (v) => {
  if (v === 'entry_price') price.value = Math.min(20, maxPrice.value)
})

function label(id: TeamId): string {
  return store.teamName(id)
}
</script>

<template>
  <div class="bz">
    <!-- STEG: gör er redo, nedräkning -->
    <template v-if="step === 'getready'">
      <p class="bz__ready-label">{{ t('bidding.getready_title') }}</p>
      <div class="bz__resource" v-if="resource">
        <span class="bz__res-icon">{{ resourceIcon(resource) }}</span>
        <span class="bz__res-name">{{ t('resource.' + resource) }}</span>
      </div>
      <p class="bz__count-label">{{ t('bidding.getready_countdown') }}</p>
      <div class="bz__count mono">{{ store.secondsLeft == null ? '…' : countdown }}</div>
    </template>

    <!-- STEG: budgivning pågår (fokuserat) -->
    <template v-else-if="step === 'negotiating'">
      <div class="bz__talkrow">
        <span class="bz__talk">🗣<br />{{ t('bidding.talk_now') }}</span>
        <div class="bz__center">
          <div class="bz__live">
            <span class="bz__dot" aria-hidden="true"></span>
            <span class="bz__live-label">{{ t('bidding.in_progress') }}</span>
          </div>
          <div class="bz__timer mono">0:{{ countdown.toString().padStart(2, '0') }}</div>
          <div class="bz__resource bz__resource--big" v-if="resource">
            <span class="bz__res-icon">{{ resourceIcon(resource) }}</span>
            <span class="bz__res-name">{{ t('resource.' + resource) }}</span>
          </div>
          <p class="bz__sub">{{ t('bidding.in_progress_sub') }}</p>
        </div>
        <span class="bz__talk">🗣<br />{{ t('bidding.talk_now') }}</span>
      </div>
      <button class="bz__end" @click="store.finishNegotiation()">
        {{ t('bidding.done') }}
      </button>
    </template>

    <!-- STEG: vem vann -->
    <template v-else-if="step === 'entry_winner'">
      <template v-if="isEntry">
        <p class="bz__q">{{ t('bidding.who_won') }}</p>
        <div class="bz__choices">
          <button class="crt-button bz__choice" @click="store.chooseWinner(props.team)">
            {{ label(props.team) }}
          </button>
          <button class="crt-button bz__choice" @click="store.chooseWinner(opponent)">
            {{ label(opponent) }}
          </button>
        </div>
        <button class="crt-button bz__nobuy" @click="store.noBuy()">
          {{ t('bidding.no_buy') }}
        </button>
      </template>
      <p v-else class="bz__wait crt-caret">
        {{ t('bidding.entry_at', { team: label(entryTeam!) }) }}
      </p>
    </template>

    <!-- STEG: slutpris (slider) -->
    <template v-else-if="step === 'entry_price'">
      <template v-if="isEntry">
        <p class="bz__q">{{ t('bidding.price_for', { team: label(s.draftWinner!) }) }}</p>
        <div class="bz__price mono ink-strong">{{ price }} kr</div>
        <input
          class="bz__slider"
          type="range"
          min="0"
          :max="maxPrice"
          step="1"
          v-model.number="price"
        />
        <div class="bz__slider-ends mono">
          <span>0</span><span>{{ maxPrice }} kr</span>
        </div>
        <div class="bz__actions">
          <button class="crt-button crt-button--strong" @click="store.enterPrice(price)">
            {{ t('bidding.submit') }}
          </button>
          <button class="crt-button bz__nobuy" @click="store.noBuy()">
            {{ t('bidding.no_buy') }}
          </button>
        </div>
      </template>
      <p v-else class="bz__wait crt-caret">
        {{ t('bidding.entry_at', { team: label(entryTeam!) }) }}
      </p>
    </template>

    <!-- STEG: bekräfta (hos vinnaren) -->
    <template v-else-if="step === 'confirm' && pending">
      <template v-if="isConfirmer">
        <p class="bz__q">
          {{
            t('bidding.confirm_prompt', {
              team: label(pending.winner),
              resource: t('resource.' + pending.resource),
              price: pending.price,
            })
          }}
        </p>
        <div class="bz__actions">
          <button class="crt-button crt-button--strong bz__big" @click="store.confirmPurchase()">
            {{ t('common.confirm') }}
          </button>
          <button class="crt-button crt-button--danger" @click="store.cancelEntry()">
            {{ t('common.cancel') }}
          </button>
        </div>
      </template>
      <p v-else class="bz__wait crt-caret">{{ t('bidding.awaiting_confirm') }}</p>
    </template>
  </div>
</template>

<style scoped>
.bz {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  align-items: center;
  text-align: center;
  padding-top: 1.5rem;
}

/* --- getready --- */
.bz__ready-label {
  margin: 0;
  font-size: 1.2rem;
  letter-spacing: 0.05em;
  color: var(--color-ink-muted);
}
.bz__count-label {
  margin: 0.5rem 0 0;
  color: var(--color-ink-muted);
  letter-spacing: 0.05em;
}
.bz__count {
  font-size: 4.5rem;
  line-height: 1;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-strong);
}

/* --- resource block --- */
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
  font-size: 4rem;
}
.bz__resource--big .bz__res-name {
  font-size: 3.6rem;
}

/* --- negotiating (fokuserat) --- */
.bz__talkrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
}
.bz__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}
.bz__talk {
  border: 1px solid var(--color-primary);
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  font-family: var(--font-retro);
  font-size: 1rem;
  line-height: 1.3;
  text-align: center;
  color: var(--color-ink-strong);
  background: var(--color-background-2);
  animation: bz-talk-throb 1.1s ease-in-out infinite;
}
.bz__talk :first-child {
  font-size: 1.6rem;
}
@keyframes bz-talk-throb {
  0%, 100% { transform: scale(1); box-shadow: 0 0 6px rgba(255, 149, 0, 0.3); }
  50% { transform: scale(1.08); box-shadow: 0 0 20px rgba(255, 149, 0, 0.6); }
}
@media (prefers-reduced-motion: reduce) {
  .bz__talk { animation: none; }
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
  0%,
  100% {
    transform: scale(0.8);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.4);
    opacity: 1;
  }
}
.bz__timer {
  font-size: 3.4rem;
  line-height: 1;
  color: var(--color-ink-strong);
}
.bz__sub {
  margin: 0.2rem 0 0;
  max-width: 34ch;
  color: var(--color-ink-muted);
  font-size: 1.05rem;
}
.bz__end {
  margin-top: 0.8rem;
  font-family: var(--font-retro);
  font-size: 0.95rem;
  color: var(--color-ink-muted);
  background: transparent;
  border: 1px solid var(--color-primary-dim);
  border-radius: 6px;
  padding: 0.3em 1em;
  cursor: pointer;
}
.bz__end:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* --- entry / confirm --- */
.bz__q {
  margin: 0;
  font-size: 1.5rem;
  color: var(--color-primary);
}
.bz__big {
  font-size: 1.8rem;
  padding: 0.5em 2em;
}
.bz__choices {
  display: flex;
  gap: 1rem;
}
.bz__choice {
  font-size: 1.6rem;
  padding: 0.5em 1.6em;
}
.bz__nobuy {
  color: var(--color-ink-muted);
  border-color: var(--color-primary-dim);
  box-shadow: none;
}
.bz__price {
  font-size: 3rem;
  line-height: 1;
  color: var(--color-ink-strong);
}
.bz__slider {
  width: min(28rem, 80%);
  accent-color: var(--color-primary);
  height: 2.2rem;
}
.bz__slider-ends {
  width: min(28rem, 80%);
  display: flex;
  justify-content: space-between;
  color: var(--color-ink-muted);
  font-size: 0.9rem;
  margin-top: -0.3rem;
}
.bz__actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}
.bz__wait {
  margin: 0;
  font-size: 1.3rem;
  color: var(--color-ink-strong);
}
</style>
