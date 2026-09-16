<script setup lang="ts">
/**
 * Popupar innan en omgång.
 *  - Skarpt spel: TIMAT (härlett ur synkad reveal-timer, ~5 s + 5 s): livsviktig
 *    resurs → flyger till headern → "Här är era pengar". Båda skärmar samtidigt.
 *  - Trial (§7): KLICK-IGENOM i TRE steg man klickar sig igenom:
 *      1) regler (förhandla muntligt, skriv in pris),
 *      2) startkapital 60 kr (flyger upp till kapitalet i headern),
 *      3) er livsviktiga resurs (får ni inte tag på den förlorar ni).
 *    finishReveal på sista klicket.
 */
import { ref, computed } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { resourceIcon } from '../resources'
import { config } from '@/config'
import { useI18n } from '@/station-kit/i18n'

const props = defineProps<{ team: TeamId }>()
const store = useGameStore()
const { t } = useI18n()

const critical = computed(() => store.state.critical[props.team])
const capital = computed(() => store.state.capital[props.team])

// Klick-igenom (trial): ingen reveal-timer satt.
const clickMode = computed(() => store.state.hatchTimerEndsAt == null)
const clickStage = ref<'rules' | 'money' | 'critical'>('rules')

function nextClick() {
  if (clickStage.value === 'rules') clickStage.value = 'money'
  else if (clickStage.value === 'money') clickStage.value = 'critical'
  else store.finishReveal()
}

// Timat (skarpt spel): härled steg ur klockan.
const total = config.revealSeconds ?? 11
const remaining = computed(() => store.secondsLeft ?? total)
const elapsed = computed(() => total - remaining.value)
const FLY_END = total - 5
const CRITICAL_END = total - 6
const showMoney = computed(() => elapsed.value >= FLY_END)
const flying = computed(() => elapsed.value >= CRITICAL_END && !showMoney.value)
</script>

<template>
  <div class="reveal">
    <!-- ===== TRIAL: tre klick-igenom-steg ===== -->
    <template v-if="clickMode">
      <!-- 1. Regler -->
      <div v-if="clickStage === 'rules'" class="reveal__card reveal__card--in">
        <span class="reveal__label">{{ t('reveal.trial_rules_title') }}</span>
        <span class="reveal__bigicon">🎙</span>
        <p class="reveal__copy">{{ t('reveal.trial_rules') }}</p>
        <button class="crt-button crt-button--strong reveal__next" @click="nextClick">
          {{ t('onboarding.next') }} ▸
        </button>
      </div>

      <!-- 2. Startkapital (flyger upp till kapitalet) -->
      <div v-else-if="clickStage === 'money'" class="reveal__card reveal__card--in">
        <span class="reveal__label">{{ t('reveal.startkapital') }}</span>
        <div class="reveal__money mono ink-strong">{{ capital }}<small> kr</small></div>
        <span class="reveal__coin mono" aria-hidden="true">🪙 {{ capital }} kr</span>
        <span class="reveal__point">⤒ {{ t('reveal.money_here') }}</span>
        <button class="crt-button crt-button--strong reveal__next" @click="nextClick">
          {{ t('onboarding.next') }} ▸
        </button>
      </div>

      <!-- 3. Livsviktig resurs -->
      <div v-else class="reveal__card reveal__card--in">
        <span class="reveal__label">{{ t('reveal.your_critical_is') }}</span>
        <div class="reveal__res">
          <span class="reveal__icon">{{ resourceIcon(critical) }}</span>
          <span class="reveal__name ink-strong">{{ t('resource.' + critical) }}</span>
        </div>
        <p class="reveal__copy">{{ t('reveal.critical_lose') }}</p>
        <button class="crt-button crt-button--strong reveal__next" @click="nextClick">
          {{ t('reveal.start_trial') }} ▸
        </button>
      </div>
    </template>

    <!-- ===== SKARPT SPEL: timat livsviktig → pengar ===== -->
    <template v-else>
      <div v-if="!showMoney" class="reveal__card" :class="{ 'reveal__card--fly': flying }">
        <span class="reveal__label">{{ t('reveal.your_critical_is') }}</span>
        <div class="reveal__res">
          <span class="reveal__icon">{{ resourceIcon(critical) }}</span>
          <span class="reveal__name ink-strong">{{ t('resource.' + critical) }}</span>
        </div>
        <p class="reveal__copy">{{ t('critical.copy.' + critical) }}</p>
      </div>
      <div v-else class="reveal__card reveal__card--in">
        <span class="reveal__label">{{ t('reveal.here_is_money') }}</span>
        <div class="reveal__money mono ink-strong">{{ capital }}<small> kr</small></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.reveal {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 2rem;
}
.reveal__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  max-width: 42ch;
  transition:
    transform 0.85s cubic-bezier(0.5, 0, 0.4, 1),
    opacity 0.85s ease;
}
.reveal__label {
  font-size: 1.3rem;
  letter-spacing: 0.12em;
  color: var(--color-primary);
  text-shadow: var(--glow-soft);
}
.reveal__bigicon {
  font-size: 3.5rem;
  line-height: 1;
}
.reveal__point {
  font-size: 0.95rem;
  color: var(--color-ink-muted);
  letter-spacing: 0.05em;
}
.reveal__res {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
.reveal__icon {
  font-size: 4.5rem;
  line-height: 1;
}
.reveal__name {
  font-size: 4rem;
  text-shadow: var(--glow-strong);
}
.reveal__copy {
  margin: 0.3rem 0 0;
  font-size: 1.3rem;
  line-height: 1.5;
  color: var(--color-ink-muted);
}
.reveal__money {
  font-size: 5.5rem;
  line-height: 1;
  text-shadow: var(--glow-strong);
}
.reveal__money small {
  font-size: 1.6rem;
}
.reveal__next {
  margin-top: 0.6rem;
  font-size: 1.2rem;
}

/* Myntet flyger upp mot kapitalet i headern (loop-hint). */
.reveal__coin {
  font-size: 1.4rem;
  color: var(--color-primary);
  animation: coin-fly 1.6s ease-in infinite;
}
@keyframes coin-fly {
  0% { transform: translateY(0); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translateY(-42vh); opacity: 0; }
}

/* Flyger upp mot sin plats i headern (skarpt spel). */
.reveal__card--fly {
  transform: translate(35%, -60vh) scale(0.25);
  opacity: 0;
}
@keyframes reveal-in {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
.reveal__card--in {
  animation: reveal-in 0.5s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .reveal__card {
    transition: none;
  }
  .reveal__card--fly {
    opacity: 0;
  }
  .reveal__card--in,
  .reveal__coin {
    animation: none;
  }
}
</style>
