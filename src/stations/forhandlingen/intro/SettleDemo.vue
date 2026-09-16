<script setup lang="ts">
/**
 * Skriptad visuell KOPIA av settle-UI:t (BiddingZone) för förhandlingsdemona.
 * Ej interaktiv — spelar manusets klick tajmat mot `elapsed`. Två paneler:
 * vänster = Valv Syd, höger = Valv Nord. Förloraren matar in (vinnare + slider
 * → skicka), sedan bekräftar vinnaren — precis som i det riktiga spelet.
 */
import { computed } from 'vue'
import type { SettleScript, Side } from './negotiateScripts'
import { useI18n } from '@/station-kit/i18n'

const props = defineProps<{ settle: SettleScript; elapsed: number }>()
const { t } = useI18n()

const SIDES: Side[] = ['vanster', 'hoger']
const nameOf = (s: Side) => (s === 'vanster' ? 'VALV SYD' : 'VALV NORD')

const phase = computed<'negotiate' | 'enter' | 'confirm'>(() => {
  if (props.elapsed >= props.settle.confirmAt) return 'confirm'
  if (props.elapsed >= props.settle.enterStart) return 'enter'
  return 'negotiate'
})

/** Har vinnaren valts än? (först väljer man valv, SEDAN drar man slidern.) */
const winnerChosen = computed(() => props.elapsed >= props.settle.chooseAt)

/** Slider-värde efter att vinnaren valts (0 → pris). */
const sliderValue = computed(() => {
  const s = props.settle
  if (props.elapsed < s.chooseAt) return 0
  const p = Math.min(1, (props.elapsed - s.chooseAt) / Math.max(0.1, s.enterEnd - s.chooseAt))
  return Math.round(p * s.price)
})

function panelState(side: Side): 'enter' | 'confirm' | 'wait' {
  const s = props.settle
  if (phase.value === 'enter' && side === s.loserSide) return 'enter'
  if (phase.value === 'confirm' && side === s.winnerSide) return 'confirm'
  return 'wait'
}
</script>

<template>
  <div class="settle">
    <div v-for="side in SIDES" :key="side" class="panel amber-frame">
      <span class="panel__name" :class="side === 'vanster' ? 'is-syd' : 'is-nord'">{{ nameOf(side) }}</span>

      <!-- Förhandling pågår -->
      <template v-if="phase === 'negotiate' || panelState(side) === 'wait'">
        <span class="panel__hint">{{ phase === 'negotiate' ? t('bidding.in_progress') : t('common.waiting') }}</span>
      </template>

      <!-- Förloraren matar in: FÖRST välj vinnare, SEDAN dra slidern -->
      <template v-else-if="panelState(side) === 'enter'">
        <span class="panel__q">{{ t('bidding.who_won') }}</span>
        <div class="panel__choices">
          <span
            class="panel__choice"
            :class="{ 'panel__choice--sel': winnerChosen && settle.winnerSide === 'vanster' }"
          >VALV SYD</span>
          <span
            class="panel__choice"
            :class="{ 'panel__choice--sel': winnerChosen && settle.winnerSide === 'hoger' }"
          >VALV NORD</span>
        </div>
        <template v-if="winnerChosen">
          <div class="panel__price mono ink-strong">{{ sliderValue }} kr</div>
          <div class="panel__track"><span class="panel__fill" :style="{ width: (sliderValue / settle.price) * 100 + '%' }" /></div>
          <button class="crt-button crt-button--strong panel__btn">{{ t('bidding.submit') }}</button>
        </template>
      </template>

      <!-- Vinnaren bekräftar -->
      <template v-else>
        <span class="panel__q">{{ t('bidding.your_turn_confirm') }}</span>
        <div class="panel__price mono ink-strong">{{ settle.price }} kr</div>
        <button class="crt-button crt-button--strong panel__btn panel__btn--hit">{{ t('common.confirm') }} ✓</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.settle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
  height: 100%;
  align-items: stretch;
}
.panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem;
  text-align: center;
}
.panel__name { font-size: 1rem; letter-spacing: 0.05em; }
.panel__name.is-syd { color: var(--color-primary); }
.panel__name.is-nord { color: var(--color-primary); }
.panel__hint { color: var(--color-ink-muted); font-size: 0.95rem; }
.panel__q { color: var(--color-primary); font-size: 0.95rem; }
.panel__choices { display: flex; gap: 0.4rem; }
.panel__choice {
  border: 1px solid var(--color-primary-dim);
  border-radius: 5px;
  padding: 0.15em 0.5em;
  font-size: 0.8rem;
  color: var(--color-ink-muted);
  transition: all 0.2s ease;
}
.panel__choice--sel {
  border-color: var(--color-ink-strong);
  color: var(--color-ink-strong);
  box-shadow: 0 0 10px rgba(245, 245, 240, 0.4);
}
.panel__price { font-size: 1.8rem; }
.panel__track {
  width: 85%; height: 0.55rem; border: 1px solid var(--color-primary);
  border-radius: 5px; overflow: hidden;
}
.panel__fill { display: block; height: 100%; background: var(--color-primary); transition: width 0.15s linear; }
.panel__btn { font-size: 0.9rem; padding: 0.25em 0.9em; }
.panel__btn--hit { background: rgba(255, 149, 0, 0.25); }
</style>
