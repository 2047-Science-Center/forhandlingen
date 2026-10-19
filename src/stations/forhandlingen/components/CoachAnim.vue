<script setup lang="ts">
/**
 * Små, loopande illustrationer för coach-marks & result-genomgången — porterade
 * ur det borttagna introt (OverviewPopups.vue + intro/IntroStage.vue) så
 * rörelsevokabulären återanvänds:
 *   critical · resurskort som STÄMPLAS "LIVSVIKTIG" (stamp-keyframe)
 *   capital  · pengar som tickar ner + mynt flyger upp → "KVAR = POÄNG"
 *   guess    · gissning RÄTT → ×2-dubbling (pop)
 *   market   · båda valven budar om samma kort (bud ◀ ▶)
 *
 * Självgående klocka (requestAnimationFrame) som LOOPAR, så animationen syns så
 * länge bubblan visas. Reduced-motion: visa slutläget statiskt, ingen rörelse.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { resourceIcon } from '../resources'
import { useI18n } from '@/station-kit/i18n'

const props = withDefaults(
  defineProps<{
    kind: 'market' | 'critical' | 'capital' | 'guess'
    /** Resurs-id för kort-ikonen (default: en representativ resurs per kind). */
    resource?: string
  }>(),
  {},
)
const { t } = useI18n()

const CYCLE = 4
const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const elapsed = ref(reduceMotion ? CYCLE : 0)
const cycle = ref(0)
let raf = 0
let t0 = 0
function tick(now: number) {
  const raw = (now - t0) / 1000
  cycle.value = Math.floor(raw / CYCLE)
  elapsed.value = raw % CYCLE
  raf = requestAnimationFrame(tick)
}
onMounted(() => {
  if (reduceMotion) return
  t0 = performance.now()
  raf = requestAnimationFrame(tick)
})
onUnmounted(() => cancelAnimationFrame(raf))

const at = (s: number) => elapsed.value >= s
const res = computed(() => props.resource ?? 'insulin')
const oppRes = computed(() => props.resource ?? 'membranfilter')

// capital: 100 → 60 mellan 0.4 och 1.2
const wallet = computed(() => {
  if (reduceMotion) return 60
  const e = elapsed.value
  if (e < 0.4) return 100
  if (e > 1.2) return 60
  return Math.round(100 - 40 * ((e - 0.4) / 0.8))
})
const marketBid = computed(() => (Math.floor(elapsed.value * 2) % 2 === 0))
</script>

<template>
  <div class="ca" :class="`ca--${kind}`">
    <!-- ===== critical: stämpel ===== -->
    <template v-if="kind === 'critical'">
      <div class="ca__card amber-frame">
        <span class="ca__icon">{{ resourceIcon(res) }}</span>
        <span v-if="at(0.5)" :key="'st' + cycle" class="ca__stamp">LIVSVIKTIG</span>
      </div>
    </template>

    <!-- ===== capital: pengar → poäng ===== -->
    <template v-else-if="kind === 'capital'">
      <div class="ca__wallet">
        <span class="ca__coin-label">💰</span>
        <span class="ca__num mono ink-strong">{{ wallet }}<small> kr</small></span>
        <span v-if="at(0.5) && !at(1.3)" :key="'coin' + cycle" class="ca__coins mono">🪙 −40</span>
      </div>
      <div class="ca__eq" :class="{ 'ca__eq--show': at(1.7) }">
        <span>{{ t('overview.kept') }}</span>
        <span class="ca__eq-sign">=</span>
        <span class="ink-strong">{{ t('res.points') }}</span>
      </div>
    </template>

    <!-- ===== guess: rätt → ×2 ===== -->
    <template v-else-if="kind === 'guess'">
      <div class="ca__card amber-frame" :class="{ 'ca__card--hit': at(0.6) }">
        <span class="ca__icon">{{ resourceIcon(oppRes) }}</span>
        <span v-if="at(1.2)" :key="'x2' + cycle" class="ca__x2">×2</span>
      </div>
      <span v-if="at(0.6)" class="ca__right">{{ t('overview.right') }}</span>
    </template>

    <!-- ===== market: båda budar ===== -->
    <template v-else>
      <span class="ca__bid" :class="{ 'ca__bid--on': marketBid }">◀ {{ t('overview.bid') }}</span>
      <div class="ca__card amber-frame"><span class="ca__icon">{{ resourceIcon(res) }}</span></div>
      <span class="ca__bid" :class="{ 'ca__bid--on': !marketBid }">{{ t('overview.bid') }} ▶</span>
    </template>
  </div>
</template>

<style scoped>
.ca {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  min-height: 4.5rem;
}
.ca__card {
  position: relative;
  width: 3.4rem;
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 16, 11, 0.8);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}
.ca__card--hit {
  transform: scale(1.1);
  box-shadow: 0 0 18px rgba(var(--mode-accent-rgb), 0.8);
  border-color: var(--color-primary);
}
.ca__icon {
  font-size: 1.8rem;
}
/* stämpel (port från IntroStage) */
.ca__stamp {
  position: absolute;
  top: 48%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  border: 2px solid var(--color-danger);
  color: var(--color-danger);
  font-family: var(--font-retro);
  font-size: 0.6rem;
  letter-spacing: 0.04em;
  padding: 0.1em 0.3em;
  border-radius: 4px;
  white-space: nowrap;
  animation: ca-stamp 0.4s cubic-bezier(0.4, 1.6, 0.5, 1) both;
}
@keyframes ca-stamp {
  from { transform: translate(-50%, -50%) rotate(-12deg) scale(2.6); opacity: 0; }
  to { transform: translate(-50%, -50%) rotate(-12deg) scale(1); opacity: 1; }
}
/* capital (port från OverviewPopups) */
.ca__wallet {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.ca__coin-label { font-size: 1.6rem; }
.ca__num { font-size: 1.9rem; }
.ca__num small { font-size: 0.8rem; }
.ca__coins {
  position: absolute;
  right: -2.4rem;
  font-size: 0.9rem;
  color: var(--color-primary);
  animation: ca-coinfly 0.8s ease-out forwards;
}
@keyframes ca-coinfly {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-3rem) translateX(0.6rem); opacity: 0; }
}
.ca__eq {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-retro);
  font-size: 1rem;
  letter-spacing: 0.06em;
  color: var(--color-primary);
  opacity: 0;
  transition: opacity 0.4s ease;
}
.ca__eq--show { opacity: 1; }
.ca__eq-sign { font-size: 1.3rem; color: var(--color-ink-strong); }
/* guess ×2 (port) */
.ca__x2 {
  position: absolute;
  top: -0.6rem;
  right: -0.6rem;
  font-family: var(--font-retro);
  font-size: 1.3rem;
  color: var(--color-ink-strong);
  background: var(--color-background-2);
  border: 1px solid var(--color-primary);
  border-radius: 999px;
  padding: 0.02em 0.4em;
  box-shadow: 0 0 12px rgba(var(--mode-accent-rgb), 0.6);
  animation: ca-pop 0.5s ease-out both;
}
@keyframes ca-pop {
  0% { transform: scale(0.3); opacity: 0; }
  60% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); }
}
.ca__right {
  font-family: var(--font-retro);
  font-size: 1.1rem;
  color: var(--color-primary);
  letter-spacing: 0.08em;
}
/* market bud */
.ca__bid {
  font-family: var(--font-retro);
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  color: var(--color-ink-muted);
  opacity: 0.5;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.ca__bid--on {
  opacity: 1;
  color: var(--color-primary);
  transform: scale(1.1);
}
@media (prefers-reduced-motion: reduce) {
  .ca__stamp,
  .ca__coins,
  .ca__x2 { animation: none; }
  .ca__coins { display: none; }
  .ca__eq { opacity: 1; transition: none; }
  .ca__bid { transition: none; }
}
</style>
